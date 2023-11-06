
import axios from "axios";
import * as functions from "firebase-functions";

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
            await this.httpSend(numero, nome, this.msg);
        });
        await Promise.all(promises);
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
        } catch (e) {
            if (axios.isAxiosError(e)) {
                functions.logger.error(e.response?.data);
            } else {
                functions.logger.error('httpSend', {
                    message: 'httpSend error',
                    json_payload: e
                });
            }
        }
    }

}

