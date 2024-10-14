#!/usr/bin/env node

'use strict';

const https = require('https');

if (!process.argv[2] || !process.argv[3]) {
    console.log('Usage: npm run get-password-cloud <iRobot username> <iRobot password> [Gigya API Key]');
    process.exit();
}

const username = process.argv[2];
const password = process.argv[3];
const apiKey = '3_rWtvxmUKwgOzu3AUPTMLnM46lj-LxURGflmu5PcE_sGptTbD-wMeshVbLvYpq01K';

const gigyaURL = new URL('https://accounts.us1.gigya.com/accounts.login');
gigyaURL.search = new URLSearchParams({
    apiKey: apiKey,
    targetenv: 'mobile',
    loginID: username,
    password: password,
    format: 'json',
    targetEnv: 'mobile'
});

const gigyaLoginOptions = {
    hostname: gigyaURL.hostname,
    path: gigyaURL.pathname + gigyaURL.search,
    method: 'POST',
    headers: {
        'Connection': 'close'
    }
};

const req = https.request(gigyaLoginOptions, res => {
    let data = '';

    res.on('data', chunk => {
        data += chunk;
    });

    res.on('end', () => {
        loginGigyaResponseHandler(null, res, JSON.parse(data));
    });
});

req.on('error', error => {
    loginGigyaResponseHandler(error);
});

req.end();

function loginGigyaResponseHandler(error, response, body) {
    if (error) {
        console.error('Fatal error logging into Gigya API. Please check your credentials or Gigya API Key.', error);
        process.exit(0);
    }

    if ([401, 403].includes(response.statusCode)) {
        console.error('Authentication error. Check your credentials.', response);
        process.exit(0);
    } else if (response.statusCode === 400) {
        console.error(response);
        process.exit(0);
    } else if (response.statusCode === 200) {
        handleGigyaSuccess(body);
    } else {
        console.error('Unexpected response. Checking again...');
    }
}

function handleGigyaSuccess(body) {
    if (body.statusCode === 403) {
        console.error('Authentication error. Please check your credentials.', body);
        process.exit(0);
    }
    if (body.statusCode === 400) {
        console.error('Error logging into Gigya API.', body);
        process.exit(0);
    }
    if (body.statusCode === 200 && body.errorCode === 0 && body.UID && body.UIDSignature && body.signatureTimestamp && body.sessionInfo && body.sessionInfo.sessionToken) {
        loginToIRobot(body);
    } else {
        console.error('Error logging into iRobot account. Missing fields in login response.', body);
        process.exit(0);
    }
}

function loginToIRobot(body) {
    const iRobotLoginOptions = {
        hostname: 'unauth2.prod.iot.irobotapi.com',
        path: '/v2/login',
        method: 'POST',
        headers: {
            'Connection': 'close',
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(iRobotLoginOptions, res => {
        let data = '';

        res.on('data', chunk => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                loginIrobotResponseHandler(null, res, JSON.parse(data));
            } catch (e) {
                loginIrobotResponseHandler(e);
            }
        });
    });

    req.on('error', error => {
        loginIrobotResponseHandler(error);
    });

    req.write(JSON.stringify({
        'app_id': 'ANDROID-C7FB240E-DF34-42D7-AE4E-A8C17079A294',
        'assume_robot_ownership': 0,
        'gigya': {
            'signature': body.UIDSignature,
            'timestamp': body.signatureTimestamp,
            'uid': body.UID
        }
    }));

    req.end();
}

function loginIrobotResponseHandler(error, response, body) {
    if (error) {
        console.error('Fatal error logging into iRobot account. Please check your credentials or API Key.', error);
        process.exit(0);
    }
    if (body && body.robots) {
        printRobots(body.robots);
    } else {
        console.error('Fatal error logging into iRobot account. Please check your credentials or API Key.', body);
        process.exit(0);
    }
}

function printRobots(robots) {
    const robotEntries = Object.entries(robots).map(([id, robot]) => ({
        name: robot.name,
        blid: id,
        password: robot.password,
        ip: robot.ip
    }));
    console.log(JSON.stringify(robotEntries, null, 2));
}
