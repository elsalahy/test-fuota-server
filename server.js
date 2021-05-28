/**
 * ------------- DISCLAIMER & WARNING and  -------------
 * This FUOTA test server should only be used for prototyping and testing.
 * This server should not be used in production.
 * Again, Please use this server for testing and prototyping only.
 * Please contact The Things Industries for scalable deployments.
 */

const mqtt = require('mqtt');
const gpsTime = require('gps-time');
const fs = require('fs');
const path = require('path');
const rp = require('request-promise');

//----------- Start of config area ----------------//

// MQTT config, see https://www.thethingsindustries.com/docs/integrations/mqtt/
var HOST = '';
var APP_ID = '';
var PORT = 1883 ; // 1883 or 8883 for TLS
var API_KEY = '';
// var KEY = fs.readFileSync(path.join(__dirname, '/key.pem')); // Uncomment if you are using TLS
// var CERT = fs.readFileSync(path.join(__dirname, '/cert.pem')); //Uncomment if you are using TLS
var options = {
    username: APP_ID,
    password: API_KEY,
    port: PORT,
    host: HOST,
    //key: KEY,
    //cert: CERT,
    rejectUnauthorized: false,
    protocol: 'mqtts'
}

// Device IDs and EUIs config
var TENANT_ID = ''; //For The Things Stack Cloud
var GATEWAY_ID= '';

// Multicast group details config, see https://www.thethingsindustries.com/docs/devices/multicast/
var MULTICAST_APP_ID= '';
var MULTICAST_DEV_ID= '';

// Devices EUIs config with no spaces, Example: `FA23A01E61AE4F65`
// These are the Devices that will open a class C session and receive the multicast fragments
const devices = [
    ''
];

// Script config
const CLASS_C_WAIT_S = 40;
var extra_info = 0; // Set to 1 to get more debug info

//----------- End of config area ----------------//

const client = mqtt.connect(options);
const PACKET_FILE = process.argv[2];
const DATARATE = process.env.LORA_DR || 5; //@user, please adjust here
if (!PACKET_FILE) throw 'Syntax: PACKET_FILE Not Provided';
const mcDetails = {
    application_id: MULTICAST_APP_ID,
    device_id: MULTICAST_DEV_ID,
};
let classCStarted = false;

let deviceMap = devices.reduce((curr, eui) => {
    curr[eui] = { clockSynced: false, fragSessionAns: false, mcSetupAns: false, mcStartAns: false, applicationID: null, msgWaiting: null };
    return curr;
}, {});

let startTime = null;

client.on('error', err => console.error('Error on MQTT subscriber', err));
client.on('connect', function () {
    console.log('MQTT client connected!');
    client.subscribe('#', function (err) { //subscribed to all topics
        if (err) {
            return console.error('Failed to subscribe', err);
        }
        console.log('Subscribed to all application events');
    });
});

client.on('message', async function (topic, message) {
    if (extra_info)
        console.log('msg', message.toString('utf-8'));
    // only interested in uplink messages
    if (!/\/up$/.test(topic)) return;

    // message is Buffer
    let m = JSON.parse(message.toString('utf-8'));

        // device that we don't care about
        if (!deviceMap[m.end_device_ids.dev_eui]) {
            console.log(m.end_device_ids.dev_eui);
            console.log("Unhandled device EUI");
            return;
        }

        if (m.uplink_message.f_port === 202 /* clock sync */) {
            let body = Buffer.from(m.uplink_message.frm_payload, 'base64');
            if (body[0] === 0x1 /* CLOCK_APP_TIME_REQ */) {
                let deviceTime = body[1] + (body[2] << 8) + (body[3] << 16) + (body[4] << 24);
                let serverTime = gpsTime.toGPSMS(Date.now()) / 1000 | 0;
                console.log('deviceTime', deviceTime, 'serverTime', serverTime);

                let adjust = serverTime - deviceTime | 0;
                let resp = [ 1, adjust & 0xff, (adjust >> 8) & 0xff, (adjust >> 16) & 0xff, (adjust >> 24) & 0xff, 0b0000 /* tokenAns */ ];
                let responseMessage = {
                    "downlinks": [{
                        "priority": "NORMAL",
                        "f_port": 202,
                        "frm_payload": Buffer.from(resp).toString('base64')
                    }]
                };

                deviceMap[m.end_device_ids.dev_eui].msgWaiting = responseMessage;

                deviceMap[m.end_device_ids.dev_eui].clockSynced = true;
                deviceMap[m.end_device_ids.dev_eui].applicationID = m.end_device_ids.application_ids.application_id;

                console.log('Clock sync for device', m.end_device_ids.dev_eui, adjust, 'seconds');

                if (devices.every(eui => deviceMap[eui].clockSynced)) {
                    console.log('All devices have had their clocks synced, setting up mc group...');
                    setTimeout(sendMcGroupSetup, 1000);
                }
            }
            else {
                console.warn('Could not handle clock sync request', body);
            }
        }
        if (m.uplink_message.f_port === 200 /* mc group cmnds */) {
            let body = Buffer.from(m.uplink_message.frm_payload, 'base64');
            if (body[0] === 0x2) { // McGroupSetupAns
                if (body[1] === 0x0) {
                    deviceMap[m.end_device_ids.dev_eui].mcSetupAns = true;
                }
                else {
                    console.warn('Unexpected answer for McGroupSetupAns from', m.end_device_ids.dev_eui, body)
                }

                if (devices.every(eui => deviceMap[eui].mcSetupAns)) {
                    console.log('All devices have received multicast group, setting up fragsession...');
                    setTimeout(sendFragSessionSetup, 1000);
                }
            }
            else if (body[0] === 0x4) { // McClassCSessionAns
                if (body[1] !== 0x0) return console.warn('Unexpected byte[1] for McClassCSessionAns', m.end_device_ids.dev_eui, body);

                let tts = body[2] + (body[3] << 8) + (body[4] << 16);
                console.log(m.end_device_ids.dev_eui, 'time to start', tts, 'startTime is', startTime, 'currtime is', gpsTime.toGPSMS(Date.now()) / 1000 | 0);

                deviceMap[m.end_device_ids.dev_eui].mcStartAns = true;

                // so this app cannot properly check the delta, as we don't know when the network is gonna send
                // should be calculated at that very moment, so now there can be a few seconds delay
                let delta = (gpsTime.toGPSMS(Date.now()) / 1000 | 0) + tts - startTime;
                if (Math.abs(delta) > 6) {
                    console.log('Delta is too big for', m.end_device_ids.dev_eui, Math.abs(delta));
                }
                else {
                    console.log('Delta is OK', m.end_device_ids.dev_eui, delta);
                }
            }
            else {
                console.warn('Could not handle Mc Group command', body);
            }
        }
        if (m.uplink_message.f_port === 201 /* frag session */) {
            let body = Buffer.from(m.uplink_message.frm_payload, 'base64');
            if (body[0] === 0x2) { // FragSessionSetupAns
                if (body[1] === 0x0) {
                    deviceMap[m.end_device_ids.dev_eui].fragSessionAns = true;
                }
                else {
                    console.warn('Unexpected answer for FragSessionSetupAns from', m.end_device_ids.dev_eui, body)
                }

                if (devices.every(eui => deviceMap[eui].fragSessionAns)) {
                    console.log('All devices have received frag session, sending mc start msg...');
                    setTimeout(sendMcClassCSessionReq, 1000);
                }
            }
            else if (body[0] === 0x5) { // DATA_BLOCK_AUTH_REQ
                let hash = '';
                for (let ix = 5; ix > 1; ix--) {
                    hash += body.slice(ix, ix+1).toString('hex');
                }
                console.log('Received DATA_BLOCK_AUTH_REQ', m.end_device_ids.dev_eui, hash);
            }
            else {
                console.warn('Could not handle Mc Group command', body);
            }
        }
        if (deviceMap[m.end_device_ids.dev_eui].msgWaiting) {
            let msgWaiting = deviceMap[m.end_device_ids.dev_eui].msgWaiting;
            console.log("publishing as",m.end_device_ids.application_ids.application_id+'@'+TENANT_ID,m.end_device_ids.device_id);
            client.publish(`v3/${m.end_device_ids.application_ids.application_id+'@'+TENANT_ID}/devices/${m.end_device_ids.device_id}/down/push`, Buffer.from(JSON.stringify(msgWaiting), 'utf8'));
            deviceMap[m.end_device_ids.dev_eui].msgWaiting = null;
        }
    });

    function sendMcGroupSetup() {
        if (classCStarted) return;

        console.log('sendMcGroupSetup');
        // mcgroupsetup
        //@user, please adjust here
        let mcGroupSetup = {
            "downlinks": [{
                "priority": "NORMAL",
                "f_port": 200,
                "frm_payload": Buffer.from([ 0x02, 0x00,
                    0xFF, 0xFF, 0xFF, 0x01, // McAddr
                    0x01, 0x5E, 0x85, 0xF4, 0xB9, 0x9D, 0xC0, 0xB9, 0x44, 0x06, 0x6C, 0xD0, 0x74, 0x98, 0x33, 0x0B, //McKey_encrypted
                    0x0, 0x0, 0x0, 0x0, // minFCnt
                    0xff, 0x0, 0x0, 0x0 // maxFCnt
                ]).toString('base64')
            }]
        };
    /**
     * [DBG ][LWUC]: handleMulticastSetupReq mcIx=0
[DBG ][LWUC]:   mcAddr:         0x01ffffff
[DBG ][LWUC]:   NwkSKey:
                 ff 70 1d 83 68 a4 c6 58 60 48 ff a2 9d 8a e0 10
[DBG ][LWUC]:   AppSKey:
                 f7 d9 66 7a cd 8e b1 dd e3 80 75 1a 85 93 ea ec
[DBG ][LWUC]:   minFcFCount:    0
[DBG ][LWUC]:   maxFcFCount:    255
     */
        devices.forEach(eui => {
            let dm = deviceMap[eui];
            if (dm.mcSetupAns) return;

            dm.msgWaiting = mcGroupSetup;
        });

        // retry
        setTimeout(() => {
            if (devices.some(eui => !deviceMap[eui].mcSetupAns)) {
                sendMcGroupSetup();
            }
        }, 20000);
    }

    function sendFragSessionSetup() {
        if (classCStarted) return;

        console.log('sendFragSessionSetup');
        let msg = {
            "downlinks": [{
            "priority": "NORMAL",
            "f_port": 201,
            "frm_payload": Buffer.from(parsePackets()[0]).toString('base64')
        }]
        };
        devices.forEach(eui => {
            let dm = deviceMap[eui];
            if (dm.fragSessionAns) return;

            dm.msgWaiting = msg;
        });

        // retry
        setTimeout(() => {
            if (devices.some(eui => !deviceMap[eui].fragSessionAns)) {
                sendFragSessionSetup();
            }
        }, 20000);
    }
    function sendMcClassCSessionReq() {
        if (classCStarted) return;

        console.log('sendMcClassCSessionReq');

        if (!startTime) {
            let serverTime = gpsTime.toGPSMS(Date.now()) / 1000 | 0;
            startTime = serverTime + CLASS_C_WAIT_S; // 60 seconds from now

            setTimeout(() => {
                startSendingClassCPackets();
            }, (CLASS_C_WAIT_S + 10) * 1000); // because the delta drift that we don't know (see above)
        }

        let msg = {
            "downlinks": [{
            "priority": "NORMAL",
            "f_port": 200,
            "frm_payload": Buffer.from([
                0x4,
                0x0, // mcgroupidheader
                startTime & 0xff, (startTime >> 8) & 0xff, (startTime >> 16) & 0xff, (startTime >> 24) & 0xff,
                0x07, // session timeout
                0xd2, 0xad, 0x84, // dlfreq
                DATARATE // dr
            ]).toString('base64')
        }]
        };
        devices.forEach(eui => {
            let dm = deviceMap[eui];
            if (dm.mcStartAns) return;

            dm.msgWaiting = msg;
        });

        // retry
        setTimeout(() => {
            if (devices.some(eui => !deviceMap[eui].mcStartAns)) {
                sendMcClassCSessionReq();
            }
        }, 20000);
    }

    function sleep(ms) {
        return new Promise((res, rej) => setTimeout(res, ms));
    }

    function parsePackets() {
        let packets = fs.readFileSync(PACKET_FILE, 'utf-8').split('\n').map(row => {
            return row.split(' ').map(c=>parseInt(c, 16))
        });
        return packets;
    }

    async function startSendingClassCPackets() {
        classCStarted = true;
        console.log('startSendingClassCPackets');
        console.log('All devices ready?', deviceMap);

        let packets = parsePackets();

        let counter = 0;

        for (let p of packets) {
            // first row is header, don't use that one
            if (counter === 0) {
                counter++;
                continue;
            }

            let msg = {
                "downlinks": [{
                "priority": "NORMAL",
                "f_port": 201,
                "frm_payload": Buffer.from(p).toString('base64'),
                "class_b_c": {
                    "gateways": [
                        {
                            "gateway_ids": {
                                "gateway_id": GATEWAY_ID
                              }
                        }
                    ]
                }
            }]
            };

            client.publish(`v3/${mcDetails.application_id+'@'+TENANT_ID}/devices/${mcDetails.device_id}/down/push`, Buffer.from(JSON.stringify(msg), 'utf8'));

            console.log('Sent packet', ++counter, mcDetails.application_id+'@'+TENANT_ID,mcDetails.device_id);

            await sleep(1200); // packet on SF12 is 2100 ms. so this should just work
        }

        console.log('Done sending all packets');
    }
