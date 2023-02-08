
import axios from "axios";
import * as functions from "firebase-functions";
export const reply = async (to: string, content: string, id: string) => {
    const data = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "context": {
            "message_id": id
        },
        "type": "text",
        "text": {
            "preview_url": false,
            "body": content
        }
    };

    const url = 'https://graph.facebook.com/v15.0/107516842183777/messages';
    const FACEBOOK_TOKEN = (await functions.app.admin.database().ref("webhook").child("temp_token").once('value')).val();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FACEBOOK_TOKEN}`
    };
    try {
        await axios.post(url, data, { headers });
    } catch (e) {
        if (axios.isAxiosError(e)) {
            functions.logger.error(e.response?.data);
        } else {
            functions.logger.error(e);
        }
    }
}