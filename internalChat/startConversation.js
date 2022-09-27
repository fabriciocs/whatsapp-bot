const { admin } = require('../db-config');

const startConversation = (msg) => {

    const db = admin.database();
    db.ref('bee-bot').child('internal-chat').push().set(prepared);
}