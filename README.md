# OSTicket

Wrapper for OSTicket. At the moment you can only create tickets.

***ATTENTION/BREAKING CHANGES in version 2***
+ no supports for callbacks. Please use async/await
+ response is an object (for more flexibility) with property ticketId instead of a plain string

# Installation
```
  yarn add ac-osticket
  npm install ac-osticket --save
```

# Usage
Create API Key in OSTicket and instanciate OSTicket with your OSTicket URL and those API keys.

## Init
```
const ost = require('osticket')
ost.init({
  baseUrl: 'https://myOSTicketURL',
  apiKey: 'abc-123', 
  apiSecret: 'abc-secret' // optional if you have tweaked OSTicket
})

// see below for payload
let response = await ost.createTicket(ticket)
{ ticketId: 123456 }
```

### Init params
| Property | Type | Notes |
| --- | --- | --- |
| baseUrl | string | required base url of your OS ticket instance |
| apiKey | string | required API key |
| apiSecret | string | optional, see Tweak section below
| debugMode | boolean | If true, no real tickets are created
| keylock | object | Optional parameters for keylock (e.g. redis to use Redis instead of local memory) 


## Create a New Ticket
```
const ticket = {
    "name": "Jane Doe",
    "email": "jane.doe@admiralcloud.com",
    "subject": "I need help",
    "message": "This is my bug report"
}

let response = await ost.createTicket(ticket)
```

Optionally you can use our locking mechanism to block creating too many tickets.

```
let options = {
    key: 'ticketLock', // name for the key to use as lock key
    expires: 5 // time to block in seconds
}
let response = await ost.createTicket(ticket, options)
```

## Custom fields
You can also send custom fields to the OSTicket API. Make sure to add definitions (based on ac-sanitizer).

```
const ticket = {
    name: 'Jane Doe',
    email: 'jane.doe@admiralcloud.com',
    subject: 'I need help',
    message: 'This is my bug report',
    jobNumber: 'ABC-JobId-123'
}

const options = {
    fieldsToCheck: [
        { field: 'jobNumber', type: 'string', required: true },
    ]
}
let response = await ost.createTicket(ticket, options)

```

## Attaching files to a New Ticket
You can attach file to the OSTicket API. Adding text file is as simple as that.

```
const ticket = {
    name: 'Jane Doe',
    email: 'jane.doe@admiralcloud.com',
    subject: 'I need help',
    message: 'This is my bug report',
    attachments: [
        { 'filename.txt': 'contents of the file' },
    ]
}

const options = {
    fieldsToCheck: [
        { field: 'attachments', type: 'array', required: true },
    ]
}
let response = await ost.createTicket(ticket, options)
```

If you want to attach binary file (e.g. archive) - it needs a bit more processing
```
const readFileSync = require('fs').readFileSync
const fileContentsBuffer = Buffer.from(readFileSync('file.zip'))
const ticket = {
    name: 'Jane Doe',
    email: 'jane.doe@admiralcloud.com',
    subject: 'I need help',
    message: 'This is my bug report',
    attachments: [
        { 'filename.zip': `data:application/zip;base64,${fileContentsBuffer.toString('base64')}` },
    ]
}

const options = {
    fieldsToCheck: [
        { field: 'attachments', type: 'array', required: true },
    ]
}
let response = await ost.createTicket(ticket, options)
```
Crucial part is defining type of data correctly.

## Test mode
You can enable test mode, which will not create real tickets but instead return a random ID and debugMode true in the response

```
{
    ticketId: 123456,
    debugMode: true
}
```

Enable testmode globally by using init parameter "debugmode" to true or use it on per-function basis and create a ticket with option debug = true.

```
ost.init({
  baseUrl: 'https://myOSTicketURL',
  apiKey: 'abc-123', 
  apiSecret: 'abc-secret' // optional if you have tweaked OSTicket,
  debugMode: true
})

// OR
const ticket = {
    "name": "Jane Doe",
    "email": "jane.doe@admiralcloud.com",
    "subject": "I need help",
    "message": "This is my bug report"
}

let response = await ost.createTicket(ticket, { debug: true })
```

# OSTicket Tweaks
API Keys are currently bound to IP addresses. This might be a problem if you have more than one IP and - due to scaling - might always have several and different IPs. Therefore the OSTicket is slightly modified to handle this.

We are using a "secret" header to authenticate the API, additionally to the access key. 

Please go to  include/class.api.php in your OSTicket installation and scroll to the function requireApiKey(). Update this function and the function getApiKey() according to the code below. This is not a kryptographically safe approach, as the header is visible for everyone. But currently there is no "safe" approach. 

```
// Line 54 in include/class.api.php
function getSecret() {
    return $this->ht['apisecret'];
}
 

// Line 106 in include/class.api.php
function getIdByKey($key, $ip='', $secret='') {
    $sql='SELECT id FROM '.API_KEY_TABLE.' WHERE apikey='.db_input($key);
    if($ip)
        $sql.=' AND ipaddr='.db_input($ip);
    if($secret)
        $sql.=' AND apisecret='.db_input($secret);
    if(($res=db_query($sql)) && db_num_rows($res))
        list($id) = db_fetch_row($res);

    return $id;
}

// Line 178 in include/class.api.php
function requireApiKey() {
    # Validate the API key -- required to be sent via the X-API-Key
    # header
    # CHANGED: Mark Poepping/AdmiralCloud AG 2017-06-09
    # If APIsecret is sent, don't check requirement for IP

    if(!($key=$this->getApiKey()))
        return $this->exerr(401, __('Valid API key required'));
    else if (!$key->isActive())
        return $this->exerr(401, __('API key not active'));         
    else if (!$key->getSecret() && $key->getIPAddr()!=$_SERVER['REMOTE_ADDR'])
        return $this->exerr(401, __('API key - IP Restriction or API secret must be set'));

    return $key;
}
 
 
// Line 193 in include/class.api.php
function getApiKey() {
    if (!$this->apikey && isset($_SERVER['HTTP_X_API_KEY']) && isset($_SERVER['HTTP_X_API_AUTH']))
        $this->apikey = API::lookupByKey($_SERVER['HTTP_X_API_KEY'], '', $_SERVER['HTTP_X_API_AUTH']);
    else if (!$this->apikey && isset($_SERVER['HTTP_X_API_KEY']) && isset($_SERVER['REMOTE_ADDR']))
        $this->apikey = API::lookupByKey($_SERVER['HTTP_X_API_KEY'], $_SERVER['REMOTE_ADDR']);
         
    return $this->apikey;
}
 
 
// This pull request
// https://github.com/osTicket/osTicket/pull/4281/commits/a23e092941ab2c27bf0de4a1cfbbcd6976a5d423
```


# License & Contributing

## Links
- [Website](https://www.admiralcloud.com/)
- [Twitter (@admiralcloud)](https://twitter.com/admiralcloud)
- [Facebook](https://www.facebook.com/MediaAssetManagement/)

## License
[MIT License](https://opensource.org/licenses/MIT) Copyright © 2009-present, AdmiralCloud AG, Mark Poepping

## Contributing
If you want to contribute, please make sure to add tests and have code coverage of 100% when running *yarn run test*.

## Thanks
This module is inspired by https://github.com/hongkongkiwi/osticket-node and https://github.com/kumarharsh/node-freshdesk

