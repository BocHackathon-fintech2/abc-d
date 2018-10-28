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
const paymentSignBaseUrl = 'https://sandbox-apis.bankofcyprus.com/df-boc-org-sb/sb/jwssignverifyapi/sign'

process.env.DEBUG = 'dialogflow:debug';

const client_id = 'ee73f1b1-6ed4-4825-a27a-c944239f9cbe'
const client_secret = 'D8vI6kX3kV7rP2gV4mO0pD2oB4oP4qQ6jA8vV7vX4bO4xP4rC6'
const tppid = 'singpaymentdata'
const originUserId = '50520218'
const journeyId = 'abc'
const redirectURI = 'https://us-central1-chatbank-a2cdf.cloudfunctions.net/authenticate'

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

    let response2 = await axios(options)

    let access_token = response2.data.access_token

    await admin.firestore().collection('users').doc('boc1').update({
        'access_token_complete_oauth': access_token
    })

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

async function refreshTokenCode() {
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

    await admin.firestore().collection('users').doc('boc1').update({
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

    let sub = await patchSubscription(user_doc.data().subscriptionId, accounts, access_token)

    response.send('<html><body>Login successful!<script>window.close();</script></body></html>')
})

// Step 3 - Transfer Money
exports.transferMoney = functions.https.onRequest(async (request, response) => {
    if (!request.query.transferee) {
        response.send({ error: 'Transferee not set!' })
    }

    if (!request.query.transferor) {
        response.send({ error: 'Transferor not set!' })
    }

    if (!request.query.amount) {
        response.send({ error: 'Amount not set!' })
    }


    response.send(await transferMoneyTo(request.query.transferee, request.query.transferor, request.query.amount))
})
async function transferMoneyTo(transferee, transferor, amount) {
    let user_doc = await admin.firestore().collection('users').doc('boc1').get()

    let payload = await signPayment(transferee, transferor, amount)

    let paymentId = await createPayment(payload, user_doc.data().access_token, user_doc.data().subscriptionId)

    let refNumber = await approvePayment(paymentId, user_doc.data().access_token, user_doc.data().subscriptionId)

    return refNumber
}
async function signPayment(transferee, transferor, amount) {

    const headers = {
        'Content-Type': 'application/json',
        'tppId': tppid
    };

    const data = {
        "debtor": {
            "bankId": "",
            "accountId": transferor
        },
        "creditor": {
            "bankId": "",
            "accountId": transferee
        },
        "transactionAmount": {
            "amount": amount,
            "currency": "EUR",
            "currencyRate": "string"
        },
        "endToEndId": "string",
        "paymentDetails": "test sandbox ",
        "terminalId": "string",
        "branch": "",
        "executionDate": "",
        "valueDate": ""
    }

    const options = {
        method: 'POST',
        headers: headers,
        data: data,
        url: paymentSignBaseUrl,
    };

    let response = await axios(options)

    let payload = response.data

    return payload
}

async function createPayment(payload, access_token, subscriptionId) {

    const url = baseUrl + '/v1/payments?client_id=' + client_id + '&client_secret=' + client_secret

    const headers = {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'application/json',
        'tppid': tppid,
        'originUserId': originUserId,
        'timeStamp': + new Date(),
        'journeyId': journeyId,
        'subscriptionId': subscriptionId,
        'lang': 'en',
        'correlationId': 'xyz'
    };

    const options = {
        method: 'POST',
        headers: headers,
        data: payload,
        url,
    };

    let response = await axios(options)

    let paymentId = response.data.payment.paymentId

    return paymentId
}

async function approvePayment(paymentId, access_token, subscriptionId) {

    const url = baseUrl + '/v1/payments/' + paymentId + '/authorize?client_id=' + client_id + '&client_secret=' + client_secret

    const headers = {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'application/json',
        'tppid': tppid,
        'originUserId': originUserId,
        'timeStamp': + new Date(),
        'journeyId': journeyId,
        'subscriptionId': subscriptionId,
    };

    const data = {
        "transactionTime": '1515051381394',
        "authCode": "123456"
    }

    const options = {
        method: 'POST',
        headers: headers,
        data: data,
        url,
    };

    let response = await axios(options)

    let refNumber = response.data.refNumber

    return refNumber
}

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

    // await admin.
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

function getAccountIdByName(name) {
    return '351012345672'
}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });
    // console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    // console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    async function transfer(agent) {
        await refreshTokenCode()
        let amount = request["body"]["queryResult"]["parameters"]["unit-currency"]["amount"]
        let name = request["body"]["queryResult"]["parameters"]["given-name"]

        let transferor = (await admin.firestore().collection('users').doc('boc1').get()).data().accounts[0].accountId

        let transferee = await getAccountIdByName(name)

        let refNumber = await transferMoneyTo(transferee, transferor, amount)

        agent.add('Your transfer of ' + amount + 'euros to account number '
            + transferee + ' has been completed successfully! Your receipt number is #' + refNumber)
    }

    async function balance(agent) {
        await refreshTokenCode()
        let user_doc = await admin.firestore().collection('users').doc('boc1').get()

        let access_token = user_doc.data().access_token
        let ourUser = (await getOurUser(user_doc.data().subscriptionId, access_token))

        let balance = await getBalanceForAccountId(ourUser.accountId, user_doc.data().subscriptionId, access_token)
        agent.add('Your balance on account ' + ourUser.accountId + ' is ' + balance + ' euros.');
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
        await refreshTokenCode()

        agent.add('Token refreshed!')
    }

    async function goOut(agent) {
        agent.add('You should not spend more than 500 or less than 200')
    }

    let intentMap = new Map();
    intentMap.set('Balance', balance);
    intentMap.set('Transfer', transfer);
    intentMap.set('Go Out', goOut);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('Login', login)
    intentMap.set('RefreshToken', refreshToken)

    agent.handleRequest(intentMap);
});