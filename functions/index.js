// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const { WebhookClient } = require('dialogflow-fulfillment');
const { Card, Suggestion } = require('dialogflow-fulfillment');
const axios = require('axios')
const qs = require('qs')
const admin = require('firebase-admin')

admin.initializeApp()

const settings = { timestampsInSnapshots: true };
admin.firestore().settings(settings);

const baseUrl = 'https://sandbox-apis.bankofcyprus.com/df-boc-org-sb/sb/psd2'
process.env.DEBUG = 'dialogflow:debug';

const client_id = 'ee73f1b1-6ed4-4825-a27a-c944239f9cbe'
const client_secret = 'D8vI6kX3kV7rP2gV4mO0pD2oB4oP4qQ6jA8vV7vX4bO4xP4rC6'
const tppid = 'singpaymentdata'
const originUserId = '50520218'
const journeyId = 'abc'
const redirectURI = 'https://us-central1-chatbank-a2cdf.cloudfunctions.net/authenticate'

exports.transferMoney = functions.https.onRequest((request, response) => {
    if (!request.transferee) {
        response.send({ error: 'Transferee not set!' })
    }
    if (!request.transferor) {
        response.send({ error: 'Transferor not set!' })
    }

    let auth = 'AAIRbpPRb-zp58SpQLqiBXWKN_Q_Epvbndge8Sr-pMCwCKcZQduy-jkHwT_YqS0YyDHQOrVVPBoLq0RTuSjB_areNysc9n0GisbFPp--oxGc9g'

    const url = baseUrl + '/oauth2/authorize?response_type=code' +
        '&redirect_uri=https://us-central1-chatbank-a2cdf.cloudfunctions.net/authenticate' +
        '&scope=UserOAuth2Security' +
        '&client_id=ee73f1b1-6ed4-4825-a27a-c944239f9cbe' +
        '&subscriptionid=Subid000001-1540638452780'
})

async function getCompleteToken(code) {

    let url = baseUrl + '/oauth2/token'

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = {
        'client_id': client_id,
        'client_secret': client_secret,
        'grant_type': 'authorization_code',
        'scope': 'UserOAuth2Security',
        'code': code
    };

    const options = {
        method: 'POST',
        headers: headers,
        data: qs.stringify(data),
        url,
    };

    let response2 = undefined
    try {
        response2 = await axios(options)
    } catch (e) {
        console.log('errorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr')
        console.log((e.response.data.error.additionalDetails))
        return 'error'
    }
    let access_token = response2.data.access_token

    console.log('sabing', access_token)
    await admin.firestore().collection('users').doc('boc1').update({
        'access_token_complete_oauth': access_token
    })

    console.log('testing saving')
    return access_token
}

async function retrieveSubscriptionAccounts(subscriptionId, access_token) {
    let url = baseUrl + '/v1/subscriptions/' + subscriptionId + '?client_id=' + client_id + '&client_secret=' + client_secret

    const headers = {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'application/json',
        'APIm-Debug-Trans-Id': true,
        'tppid': tppid,
        'originUserId': originUserId,
        'timeStamp': + new Date(),
        'journeyId': journeyId,
    };

    const options = {
        method: 'GET',
        headers: headers,
        url,
    };

    let response2;

    response2 = await axios(options)

    let accounts = response2.data[0].selectedAccounts

    await admin.firestore().collection('users').doc('boc1').update({
        'accounts': accounts
    })

    return accounts
}

async function patchSubscription(subscriptionId, accounts, access_token) {
    let url = baseUrl + '/v1/subscriptions/' + subscriptionId + '?client_id=' + client_id + '&client_secret=' + client_secret

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + access_token,
        'app_name': 'BOCtest',
        'tppid': tppid,
        'originUserId': originUserId,
        'timeStamp': + new Date(),
        'journeyId': journeyId,
    };

    const data = {
        "selectedAccounts": accounts,
        "accounts": {
            "transactionHistory": true,
            "balance": true,
            "details": true,
            "checkFundsAvailability": true
        },
        "payments": {
            "limit": 99999999,
            "currency": "EUR",
            "amount": 999999999
        }
    }

    const options = {
        method: 'PATCH',
        headers: headers,
        data: data,
        url,
    };

    let response = await axios(options)

    await admin.firestore().collection('users').doc('boc1').update({
        'status': 'active'
    })

    return response
}

async function getToken() {
    let url = baseUrl + '/oauth2/token'

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = {
        'client_id': client_id,
        'client_secret': client_secret,
        'grant_type': 'client_credentials',
        'scope': 'TPPOAuth2Security'
    };

    const options = {
        method: 'POST',
        headers: headers,
        data: qs.stringify(data),
        url,
    };

    let response2 = await axios(options)

    let access_token = response2.data.access_token

    await admin.firestore().collection('users').doc('boc1').set({
        'access_token': access_token,
        'status': 'pending'
    })

    return access_token
}

async function refreshToken() {
    let url = baseUrl + '/oauth2/token'

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = {
        'client_id': client_id,
        'client_secret': client_secret,
        'grant_type': 'client_credentials',
        'scope': 'TPPOAuth2Security'
    };

    const options = {
        method: 'POST',
        headers: headers,
        data: qs.stringify(data),
        url,
    };

    let response2 = await axios(options)

    let access_token = response2.data.access_token

    await admin.firestore().collection('users').doc('boc1').update({
        'access_token': access_token
    })

    return access_token
}

async function getSubscriptionId(token) {
    let url = baseUrl + '/v1/subscriptions?client_id=' + client_id + '&client_secret=' + client_secret

    const headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'APIm-Debug-Trans-Id': true,
        'app_name': 'myapp',
        'tppid': tppid,
        'originUserId': originUserId,
        'timeStamp': + new Date(),
        'journeyId': journeyId,
    };

    const data = {
        "accounts": {
            "transactionHistory": true,
            "balance": true,
            "details": true,
            "checkFundsAvailability": true
        },
        "payments": {
            "limit": 99999999,
            "currency": "EUR",
            "amount": 999999999
        }
    }

    const options = {
        method: 'POST',
        headers: headers,
        data: data,
        url,
    };

    let response = await axios(options)

    let subscriptionId = response.data.subscriptionId

    await admin.firestore().collection('users').doc('boc1').update({
        'subscriptionId': subscriptionId
    })

    return subscriptionId
}

async function storeUserLoginUrl(subscriptionId) {
    let loginUrl = baseUrl + '/oauth2/authorize?response_type=code&redirect_uri=' + redirectURI + '&scope=UserOAuth2Security&client_id=' + client_id + '&subscriptionid=' + subscriptionId

    await admin.firestore().collection('users').doc('boc1').update({
        'loginUrl': loginUrl
    })

    return loginUrl
}

async function getLoginUrl() {
    let token = await getToken()

    let subscriptionId = await getSubscriptionId(token)

    let loginUrl = await storeUserLoginUrl(subscriptionId)

    return loginUrl
}

exports.readPlates = functions.https.onRequest(async (request, response) => {
    let plate = request.query.plate

    await admin.firestore().collection('users').doc('boc1').set({
        'plates': plate
    })

    response.send('Success!')
})


//Step 1 - Login
exports.login = functions.https.onRequest(async (request, response) => {

    let loginUrl = await getLoginUrl()

    response.send(loginUrl)
})

// Step 2 - Authenticate after browser login
exports.authenticate = functions.https.onRequest(async (request, response) => {
    let code = request.query.code

    let access_token = await getCompleteToken(code)


    let user_doc = await admin.firestore().collection('users').doc('boc1').get()

    let accounts = await retrieveSubscriptionAccounts(user_doc.data().subscriptionId, user_doc.data().access_token)

    let aaaa = await patchSubscription(user_doc.data().subscriptionId, accounts, access_token)

    response.send('<html><body><script>window.close();</script></body></html>')
})


async function getOurUser(subscriptionId, access_token) {
    let url = baseUrl + '/v1/accounts?client_id=' + client_id + '&client_secret=' + client_secret

    const headers = {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'application/json',
        'tppid': tppid,
        'originUserId': originUserId,
        'timeStamp': + new Date(),
        'journeyId': journeyId,
        'subscriptionId': subscriptionId
    };

    const options = {
        method: 'GET',
        headers: headers,
        url,
    };

    let response2 = await axios(options)

    return response2.data[0]
}

async function getBalanceForAccountId(accountId, subscriptionId, access_token) {
    let url = baseUrl + '/v1/accounts/' + accountId + '/balance?client_id=' + client_id + '&client_secret=' + client_secret

    const headers = {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'application/json',
        'tppid': tppid,
        'originUserId': originUserId,
        'timeStamp': + new Date(),
        'journeyId': journeyId,
        'subscriptionId': subscriptionId
    };

    const options = {
        method: 'GET',
        headers: headers,
        url,
    };

    let response2 = await axios(options)

    return response2.data[0].balances[0].amount
}


exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    function transfer(agent) {
        let amount = request["body"]["queryResult"]["parameters"]["unit-currency"]["amount"]
        let name = request["body"]["queryResult"]["parameters"]["given-name"]
        // agent.add('Response from Cloud functions - Your balance is ' + Math.random());
        agent.add('Response from Cloud functions -' + 'Transfered ' + amount + ' to ' + name)
    }

    async function balance(agent) {
        let user_doc = await admin.firestore().collection('users').doc('boc1').get()

        console.log(user_doc)
        let access_token = user_doc.data().access_token
        let ourUser = (await getOurUser(user_doc.data().subscriptionId, access_token))
        console.log('ourUser', ourUser)

        let balance = await getBalanceForAccountId(ourUser.accountId, user_doc.data().subscriptionId, access_token)
        agent.add('Response from Cloud functions - Your balance is ' + balance);
    }

    function fallback(agent) {
        agent.add("I didn't understand");
        agent.add("I'm sorry, can you try again?");
    }

    async function login(agent) {
        let loginUrl = await getLoginUrl()

        agent.add(loginUrl)
    }

    async function refreshToken(agent) {
        await refreshToken()

        agent.add('Token refreshed!')
    }

    let intentMap = new Map();
    intentMap.set('Balance', balance);
    intentMap.set('Transfer', transfer);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('Login', login)
    intentMap.set('RefreshToken', refreshToken)

    agent.handleRequest(intentMap);
});