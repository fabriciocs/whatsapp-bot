"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappMetaMessageSender = void 0;
const axios_1 = require("axios");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
class WhatsappMetaMessageSender {
    constructor(estacao, msg, contatos) {
        this.estacao = estacao;
        this.msg = msg;
        this.contatos = contatos;
        functions.logger.debug({
            message: 'New message sender',
            estacao, contatos
        });
    }
    async send() {
        const promises = this.contatos.map(async (contato) => {
            const { nome, numero } = contato;
            const sendTime = admin.firestore.Timestamp.now();
            const response = await this.httpSend(numero, nome, this.msg);
            return Object.assign(Object.assign({}, contato), { sendTime, response: response });
        });
        const result = await Promise.all(promises);
        const resultMessages = await Promise.all(result.map(async ({ nome, numero, sendTime, response }) => {
            var _a, _b, _c;
            const { messages } = response;
            const message = (_a = messages === null || messages === void 0 ? void 0 : messages[0]) !== null && _a !== void 0 ? _a : {};
            const { id } = message;
            return {
                from: {
                    name: (_b = this.estacao) === null || _b === void 0 ? void 0 : _b.descricao,
                    phone: {
                        phoneNumber: (_c = this.estacao) === null || _c === void 0 ? void 0 : _c.numero
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
            };
        }));
        return resultMessages;
    }
    async httpSend(toNumber, toName, msg) {
        var _a;
        const url = `https://graph.facebook.com/${this.estacao.cloudApiVersion}/${this.estacao.waPhoneNumberId}/messages`;
        const token = this.estacao.cloudApiAccessToken;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        try {
            const msgData = JSON.parse(msg);
            const data = Object.assign(Object.assign({}, msgData), { to: toNumber });
            const { data: responseData } = await axios_1.default.post(url, data, { headers });
            functions.logger.debug({
                message: 'response',
                responseData
            });
            return responseData;
        }
        catch (e) {
            if (axios_1.default.isAxiosError(e)) {
                functions.logger.error('httpSend Axios Error', e);
                return (_a = e.response) === null || _a === void 0 ? void 0 : _a.data;
            }
            else {
                functions.logger.error('httpSend error', e);
                return e;
            }
        }
    }
}
exports.WhatsappMetaMessageSender = WhatsappMetaMessageSender;
//# sourceMappingURL=message-sender.js.map