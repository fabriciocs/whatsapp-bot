
import axios from "axios";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { WhatsappResponse } from "./dto/whatsapp-response";

export class MessageSender {
    constructor(private estacao: any, private msg: string, private contatos: any) {
        functions.logger.debug(`message-sender`, {
            message: 'New message sender',
            json_payload: {
                estacao, contatos
            }
        });
    }
    async send() {
        const promises = this.contatos.map(async (contato: any) => {
            const { nome, numero } = contato;
            const sendTime = admin.firestore.Timestamp.now();
            const response = await this.httpSend(numero, nome, this.msg);
            return { ...contato, sendTime, response: response as WhatsappResponse };
        });
        return await Promise.all(promises);
    }
    async httpSend(toNumber: string, toName: string, msg: string) {

        const url = `https://graph.facebook.com/${this.estacao.cloudApiVersion}/${this.estacao.waPhoneNumberId}/messages`;
        const token = this.estacao.cloudApiAccessToken;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        try {
            const msgData = JSON.parse(msg);
            const data = { ...msgData, to: toNumber };
            const { data: responseData } = await axios.post(url!, data, { headers });
            functions.logger.debug('response', {
                message: 'response',
                json_payload: responseData
            });
            return responseData;

        } catch (e) {
            if (axios.isAxiosError(e)) {
                functions.logger.error(e.response?.data);
                return e.response?.data;
            } else {
                functions.logger.error('httpSend', {
                    message: 'httpSend error',
                    json_payload: e
                });
                return e;
            }
        }
    }

}

