# Test-fuota-server

## Description
A prototyping LoRaWAN® multicast and firmware update over the air test sever compatible with the
[The Things Stack](https://www.thethingsindustries.com/docs/).

## Disclaimer & Warning

This FUOTA test server should only be used for prototyping and testing.
This server **should not** be used in production.

**Again**, please use this server for testing and prototyping only.
This script is not beginner friendly and I only recommend it for advanced users familiar with LoRaWAN and FUOTA.

This is a personal effort and it's not a substitute for a FUOTA Server.

Please [contact The Things Industries](https://thethingsindustries.com/contact/) for scalable deployments.

## Requirements

- Install [The Things Network CLI](https://www.thethingsindustries.com/docs/getting-started/cli/installing-cli/)
- Install [Node.js 8 or higher](https://nodejs.org)
- Install mqtt client module `npm install mqtt`
- Install gps time module `npm install gps-time`

## Documentation

Please get familiar with how to create a multicast device and how to use The Things Stack MQTT integration

- [Multicast using the Things Stack](https://www.thethingsindustries.com/docs/devices/multicast/)
- [MQTT using The Things Stack](https://www.thethingsindustries.com/docs/integrations/mqtt/)


## Setup

- Create a normal device like this

```
ttn-lw-cli end-devices create fota dev1 \
  --dev-eui FA23a01e61ae4f65 \
  --app-eui FAB3D57ED00A7279 \
  --frequency-plan-id EU_863_870 \
  --root-keys.app-key.key FA97E0E0FC62AFE34B716F088169054E \
  --lorawan-version 1.0.3 \
  --lorawan-phy-version 1.0.3-a
```

- Create a multicast device like this

> The script is hard coded with `McKey_encrypted` but this is for testing so you can use the command below right away.

```
ttn-lw-cli end-devices create fota mcdev \
  --frequency-plan-id EU_863_870 \
  --lorawan-version 1.0.3 \
  --lorawan-phy-version 1.0.3-a \
  --session.dev-addr 01FFFFFF \
  --session.keys.app-s-key.key f7d9667acd8eb1dde380751a8593eaec \
  --session.keys.nwk-s-key.key ff701d8368a4c6586048ffa29d8ae010 \
  --multicast \
  --supports-class-c
```

## Configurations

Navigate to the config section of [server.js](./server.js) and adjust according to your setup.

An example configuration would be:

```
//----------- Start of config area ----------------//

// MQTT config, see https://www.thethingsindustries.com/docs/integrations/mqtt/
var HOST = 'eu1.cloud.thethings.industries';
var APP_ID = 'fota@tti';
var API_KEY = 'NNSXS.5GVFU6HQJJZ5JD7QUA4UOHUMR6T37MEY5ZQDUOA.TMSDZRZMNOQHD6VIJMJ3R276EY43XBP4W5TQ6PCMDOEU6FFZ46YA';
var PORT = 1883 ; // 1883 or 8883 for TLS
// var KEY = fs.readFileSync(path.join(__dirname, '/key.pem')); // Uncomment if you are using TLS
// var CERT = fs.readFileSync(path.join(__dirname, '/cert.pem')); //Uncomment if you are using TLS
var options = {
    host: HOST,
    username: APP_ID,
    password: API_KEY,
    port: PORT,
    //key: KEY, // Uncomment if you are using TLS
    //cert: CERT, // Uncomment if you are using TLS
    rejectUnauthorized: false,
    protocol: 'mqtt' //mqtts for TLS
}

// Device IDs and EUIs config
var TENANT_ID = 'tti'; // Tenant_ID On Things Stack Cloud
var GATEWAY_ID= 'multitech-70d9';

// Multicast group details config, see https://www.thethingsindustries.com/docs/devices/multicast/
var MULTICAST_APP_ID= 'fota';
var MULTICAST_DEV_ID= 'mcdev';

// Devices EUIs config with no spaces, Example: `FA23A01E61AE4F65`
// These are the Devices that will open a class C session and receive the multicast fragments
const devices = [
    'FA23A01E61AE4F65'
];

// Script config
const CLASS_C_WAIT_S = 40;
var extra_info = 0; // Set to 1 to get more debug info

//----------- End of config area ----------------//
```

## Run

Run the server using the command line

`node server.js interop-test-file-fragmented.txt ECB2A918`

and you should see something like

```
MacBook-Pro:test-fuota-server ahmedelsalahy$ node server.js interop-test-file-fragmented.txt ECB2A918
MQTT client connected!
Subscribed to all application events
deviceTime -315964790 serverTime 1308545912
Clock sync for device FA23A01E61AE4F65 1624510702 seconds
All devices have had their clocks synced, setting up mc group...
sendMcGroupSetup
publishing as fota@tti dev1
sendMcGroupSetup
All devices have received multicast group, setting up fragsession...
publishing as fota@tti dev1
sendFragSessionSetup
All devices have received multicast group, setting up fragsession...
publishing as fota@tti dev1
sendFragSessionSetup
All devices have received frag session, sending mc start msg...
publishing as fota@tti dev1
sendMcClassCSessionReq
All devices have received frag session, sending mc start msg...
publishing as fota@tti dev1
sendMcClassCSessionReq
FA23A01E61AE4F65 time to start 32 startTime is 1308545990 currtime is 1308545959
Delta is OK FA23A01E61AE4F65 1
publishing as fota@tti dev1
FA23A01E61AE4F65 time to start 26 startTime is 1308545990 currtime is 1308545964
Delta is OK FA23A01E61AE4F65 0
startSendingClassCPackets
All devices ready? { FA23A01E61AE4F65:
   { clockSynced: true,
     fragSessionAns: true,
     mcSetupAns: true,
     mcStartAns: true,
     applicationID: 'fota',
     msgWaiting: null } }
Sent packet 2 fota@tti mcdev
Sent packet 3 fota@tti mcdev
Sent packet 4 fota@tti mcdev
Sent packet 5 fota@tti mcdev
Sent packet 6 fota@tti mcdev
Sent packet 7 fota@tti mcdev
Sent packet 8 fota@tti mcdev
Sent packet 9 fota@tti mcdev
Sent packet 10 fota@tti mcdev
Sent packet 11 fota@tti mcdev
Sent packet 12 fota@tti mcdev
Sent packet 13 fota@tti mcdev
Sent packet 14 fota@tti mcdev
Sent packet 15 fota@tti mcdev
Sent packet 16 fota@tti mcdev
Sent packet 17 fota@tti mcdev
Sent packet 18 fota@tti mcdev
Sent packet 19 fota@tti mcdev
Sent packet 20 fota@tti mcdev
Sent packet 21 fota@tti mcdev
Sent packet 22 fota@tti mcdev
Sent packet 23 fota@tti mcdev
Sent packet 24 fota@tti mcdev
Sent packet 25 fota@tti mcdev
Sent packet 26 fota@tti mcdev
Sent packet 27 fota@tti mcdev
Done sending all packets
Received DATA_BLOCK_AUTH_REQ FA23A01E61AE4F65 ECB2A918
Received CRC32 checksum correctly matches input checksum ECB2A918
```


## Acknowledgment

This script is a fork of ARM Mbed team [LoRaWAN FUOTA example](https://github.com/ARMmbed/mbed-os-example-lorawan-fuota) server and it's modified to be compatible with The Things Stack.
