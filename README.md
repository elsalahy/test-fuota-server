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

An example configuration would be

Create a multicast device

```
//----------- Start of config area ----------------//

// MQTT config, see https://www.thethingsindustries.com/docs/integrations/mqtt/
var HOST = 'eu1.cloud.thethings.industries';
var APP_ID = 'fota@tti';
var API_KEY = 'NNSXS.G65HNVQYRDTSWH2RQSMTUGEZYUCD6DFPQGZYQOA.K7OF44K2QB2SP3RPWH3GD7HV7AFTEMRAJVV5QPU3JIYRKVZL2GSA';
var PORT = 1883 ; // 1883 or 8883 for TLS
// var KEY = fs.readFileSync(path.join(__dirname, '/key.pem')); // Uncomment if you are using TLS
// var CERT = fs.readFileSync(path.join(__dirname, '/cert.pem')); //Uncomment if you are using TLS
var options = {
    host: HOST,
    username: APP_ID,
    password: API_KEY,
    port: PORT,
    //key: KEY,
    //cert: CERT,
    rejectUnauthorized: false,
    protocol: 'mqtts'
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

`node server.js send.txt`

and you should see something like

```
MacBook-Pro:test-fuota-server ahmedelsalahy$ node server.js send.txt
MQTT client connected!
Subscribed to all application events
```


## Acknowledgment

This script is a fork of ARM Mbed team [LoRaWAN FUOTA example](https://github.com/ARMmbed/mbed-os-example-lorawan-fuota) server and it's modified to be compatible with The Things Stack.
