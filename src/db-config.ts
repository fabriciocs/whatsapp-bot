import * as admin from 'firebase-admin';

const app = admin.initializeApp({
    credential: admin.credential.cert(require('C:\\security\\bee-bot-auto-ans-1662763022379-firebase-adminsdk-s38r3-512e0c904c.json')),
    databaseURL: 'https://bee-bot-auto-ans-1662763022379-default-rtdb.firebaseio.com/',
    storageBucket: process.env.BUCKET_URL
});
export default { admin, app };
