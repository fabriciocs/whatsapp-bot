
import axios from "axios";
import * as functions from "firebase-functions";
import { loadSecrets } from "./secrets";

export const httpSend = async (toNumber: string, toName: string, msg: any) => {
    const data = { ...msg, to: toNumber };

    const url = process.env.FACEBOOK_MESSAGES_URL;
    const token = loadSecrets(process.env.INTEGRATION!).facebook.accessToken;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    try {
        functions.logger.debug('httpSend', { url, data, headers });
        await axios.post(url!, data, { headers });
    } catch (e) {
        if (axios.isAxiosError(e)) {
            functions.logger.error(e.response?.data);
        } else {
            functions.logger.error(e);
        }
        functions.logger.error(data);
    }
}

