
import axios from "axios";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { WhatsappResponse } from "./dto/whatsapp-response";
import Message from "./dto/message";

export class WhatsappMetaMessageSender {
    constructor(private estacao: any, private msg: string, private contatos: any) {
        functions.logger.debug({
            message: 'New message sender',
            estacao, contatos

        });
    }
    async send() {
        const promises = this.contatos.map(async (contato: any) => {
            const { nome, numero } = contato;
            const sendTime = admin.firestore.Timestamp.now();
            const response = await this.httpSend(numero, nome, this.msg);
            return { ...contato, sendTime, response: response as WhatsappResponse };
        });
        const result = await Promise.all(promises);
        const resultMessages = await Promise.all(result.map(async ({ nome, numero, sendTime, response }: any) => {
            const { messages } = response;
            const message = messages?.[0] ?? {};
            const { id } = message;
            return {
                from: {
                    name: this.estacao?.descricao,
                    phone: {
                        phoneNumber: this.estacao?.numero
                    }
                },
                to: {
                    name: nome,
                    phone: {
                        phoneNumber: numero
                    }
                },
                content: this.msg,
                controlCode: id,
                response,
                when: sendTime,
            } as Message;
        }));
        return resultMessages;
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
            functions.logger.debug({
                message: 'response',
                responseData
            });
            return responseData;

        } catch (e) {
            if (axios.isAxiosError(e)) {
                functions.logger.error('httpSend Axios Error', e);
                return e.response?.data;
            } else {
                functions.logger.error('httpSend error', e);
                return e;
            }
        }
    }

}

