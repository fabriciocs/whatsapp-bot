const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert(require('C:\\security\\bee-bot-auto-ans-1662763022379-firebase-adminsdk-s38r3-512e0c904c.json')),
    databaseURL: 'https://bee-bot-auto-ans-1662763022379-default-rtdb.firebaseio.com/'
});
module.exports = { admin };
