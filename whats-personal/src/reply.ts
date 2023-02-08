
import axios from "axios";
import * as functions from "firebase-functions";
export const reply = async (message: string, id: string) => {
    const data = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": "5564992026971",
        "context": {
            "message_id": id
        },
        "type": "text",
        "text": {
            "preview_url": false,
            "body": message
        }
    };

    const url = 'https://graph.facebook.com/v15.0/107516842183777/messages';
    const FACEBOOK_TOKEN = (await functions.app.admin.database().ref("webhook").child("temp_token").once('value')).val();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FACEBOOK_TOKEN}`
    };
    return axios.post(url, data, { headers });
}