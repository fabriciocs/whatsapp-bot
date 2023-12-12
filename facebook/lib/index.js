"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiver = exports.processor = exports.runTriggering = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const message_sender_1 = require("./message-sender");
const secrets_1 = require("./secrets");
admin.initializeApp(functions.config().firebase);
const whatsMessageRef = 'whatsapp/{id}/entry/{entry}/changes/{change}/value';
const disparoRef = '/contrato/{contratoUuid}/disparos/{uuid}';
const filterContatosByCanTriggerMsg = async (contratoRef, contatosFullList) => {
    var _a;
    if (!contratoRef || !contatosFullList) {
        return [];
    }
    return await Promise.all((_a = contatosFullList === null || contatosFullList === void 0 ? void 0 : contatosFullList.filter(async ({ numero }) => {
        var _a;
        const phoneNumberStatusRef = await (contratoRef === null || contratoRef === void 0 ? void 0 : contratoRef.collection('phoneNumberStatus').doc(numero).get());
        const { canTriggerMsg = false } = (_a = phoneNumberStatusRef === null || phoneNumberStatusRef === void 0 ? void 0 : phoneNumberStatusRef.data()) !== null && _a !== void 0 ? _a : {};
        return canTriggerMsg;
    })) !== null && _a !== void 0 ? _a : []);
};
const phoneNumberBrasilianNormalizer = (phoneNumber) => {
    if (!phoneNumber) {
        return phoneNumber;
    }
    //remove non numeric chars
    let normalized = phoneNumber.replace(/\D/g, ``);
    if (normalized.length == 10 && !normalized.startsWith('55')) {
        return `55${normalized}`;
    }
    // if normalized is 13 chars long  take the groups of digits as countryCode with 2 digits, areaCode with 2 digits, fixCode with 1 digit and phoneNumber with 8 digits
    if (normalized.length === 13) {
        normalized = normalized.replace(/^(\d{2})(\d{2})(\d{1})(\d{8})$/, `$1$2$4`);
        return normalized;
    }
    // if normalized is 11 chars long  take the groups of digits as areaCode with 2 digits, fixCode with 1 digit and phoneNumber with 8 digits
    if (normalized.length === 11 && !normalized.startsWith('55')) {
        normalized = normalized.replace(/^(\d{2})(\d{1})(\d{8})$/, `55$1$3`);
        return normalized;
    }
    return normalized;
};
const contatosToTriggering = async (contatos) => {
    const promises = contatos.map(async (contatoRef) => {
        var _a, _b;
        const contatoSnap = await contatoRef.get();
        const { nome, phoneNumber, smsNumber, email } = (_a = contatoSnap.data()) !== null && _a !== void 0 ? _a : {};
        const numero = (_b = phoneNumber === null || phoneNumber === void 0 ? void 0 : phoneNumber.normalized) !== null && _b !== void 0 ? _b : phoneNumberBrasilianNormalizer(phoneNumber === null || phoneNumber === void 0 ? void 0 : phoneNumber.phoneNumber);
        const sms = smsNumber !== null && smsNumber !== void 0 ? smsNumber : numero === null || numero === void 0 ? void 0 : numero.replace(/(55\d{2})(\d{8})/, `$19$2`);
        return {
            nome,
            numero,
            sms,
            email
        };
    });
    return await Promise.all(promises);
};
exports.runTriggering = functions.runWith({
    timeoutSeconds: 540,
    memory: '2GB'
}).firestore.document(disparoRef).onWrite(async (changes, context) => {
    var _a, _b, _c;
    const logger = functions.logger;
    const { contratoUuid, uuid } = context.params;
    logger.debug({
        message: 'disparo debug',
        contratoUuid, uuid
    });
    const disparoSnap = changes.after;
    if (!disparoSnap.exists) {
        logger.debug({
            message: 'disparo deleted',
            data: disparoSnap.data()
        });
        return null;
    }
    const disparo = disparoSnap.data();
    if (!disparo) {
        logger.error({
            message: 'disparo error, no data',
            disparo
        });
        return null;
    }
    const shouldTrigger = disparo.status === 'pending';
    if (!shouldTrigger) {
        logger.debug({
            message: 'disparo not pending',
            disparo
        });
        return null;
    }
    const campanhaRef = disparo.campanha;
    const contatosRef = disparo.contatos;
    const estacoesRef = disparo.estacao;
    if (!campanhaRef || !contatosRef || !estacoesRef) {
        logger.error('without info error', disparo);
        return null;
    }
    const campanhaSnap = await campanhaRef.get();
    const campanha = campanhaSnap.data();
    const contatosFullList = await contatosToTriggering(contatosRef);
    const contatos = await filterContatosByCanTriggerMsg((_c = (_b = (_a = disparoSnap === null || disparoSnap === void 0 ? void 0 : disparoSnap.ref) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.parent) !== null && _c !== void 0 ? _c : undefined, contatosFullList !== null && contatosFullList !== void 0 ? contatosFullList : []);
    if ((contatos === null || contatos === void 0 ? void 0 : contatos.length) > 0) {
        let status = 'completed';
        try {
            const contatosWithMail = contatos.filter(c => !!c.email);
            logger.debug({
                contatos: contatos.length,
                contatosWithMail: contatosWithMail.length
            });
            try {
                const { emailMessage = null } = campanha !== null && campanha !== void 0 ? campanha : {};
                const { subject, text, html } = emailMessage !== null && emailMessage !== void 0 ? emailMessage : {};
                logger.debug({
                    message: 'Send Mail',
                    jsonPayload: emailMessage
                });
                if (subject && (text || html)) {
                    const firestoreDb = admin.firestore();
                    const mails = contatosWithMail.map(c => ({
                        to: c.email,
                        message: {
                            subject,
                            text,
                            html
                        }
                    }));
                    const dbBatch = firestoreDb.batch();
                    try {
                        await Promise.all(mails.map(async (mail) => {
                            dbBatch.set(await firestoreDb.collection('email').doc(), mail);
                        }));
                    }
                    catch (e) {
                        logger.error({
                            message: 'send email error',
                            e
                        });
                    }
                    await dbBatch.commit();
                }
            }
            catch (e) {
                logger.error({
                    message: 'send email error',
                    e
                });
            }
            const qttByEstacao = Math.ceil(contatos.length / estacoesRef.length);
            await Promise.all(estacoesRef.map(async (estacaoSnap, index) => {
                try {
                    const estacaoRef = await estacaoSnap.get();
                    const estacao = estacaoRef.data();
                    const start = index * qttByEstacao;
                    const end = start + qttByEstacao;
                    const estacaoContatos = contatos.slice(start, end);
                    const msgSender = new message_sender_1.WhatsappMetaMessageSender(estacao, campanha === null || campanha === void 0 ? void 0 : campanha.whatsappMetaMessage, estacaoContatos);
                    try {
                        const resultMessages = await msgSender.send();
                        await estacaoSnap.update({
                            messages: admin.firestore.FieldValue.arrayUnion(...resultMessages)
                        });
                    }
                    catch (e) {
                        logger.error('msgSender result error', e);
                    }
                }
                catch (e) {
                    logger.error('WhatsappMetaMessageSendererror', e);
                }
                return estacaoSnap;
            }));
        }
        catch (e) {
            logger.error('triggering error', e);
            status = 'failed';
        }
        return disparoSnap.ref.update({
            status
        });
    }
    return null;
});
exports.processor = functions
    .runWith({
    secrets: ["INTEGRATION"]
})
    .database
    .ref(whatsMessageRef)
    .onCreate(async (snapshot, context) => {
    var _a, _b, _c, _d, _e;
    const snapVal = snapshot.val();
    const { messages, metadata } = snapVal;
    const message = messages === null || messages === void 0 ? void 0 : messages[0];
    const logger = functions.logger;
    const docDb = admin.firestore();
    const realtimeDb = admin.database();
    try {
        if (!message) {
            logger.debug({
                message: "no message",
                messages,
                metadata
            });
            return null;
        }
        await realtimeDb.ref("messages").child('whatsapp').child(message.from).push(snapVal);
    }
    catch (e) {
        logger.error('error', e);
    }
    if (!((_a = message === null || message === void 0 ? void 0 : message.text) === null || _a === void 0 ? void 0 : _a.body)) {
        logger.debug({
            message
        });
        return null;
    }
    try {
        if (!(metadata === null || metadata === void 0 ? void 0 : metadata.phone_number_id))
            return null;
        const { docs: estacaoDocs } = await docDb.collectionGroup('estacoes').where('status', '==', 'Ativo').where('waPhoneNumberId', '==', metadata === null || metadata === void 0 ? void 0 : metadata.phone_number_id).limit(1).get();
        if (!estacaoDocs.length)
            return null;
        const [estacaoSnap = null] = estacaoDocs !== null && estacaoDocs !== void 0 ? estacaoDocs : [];
        const estacao = estacaoSnap === null || estacaoSnap === void 0 ? void 0 : estacaoSnap.data();
        if (!estacao) {
            logger.debug({
                message: 'estacao não encontrada',
                metadata
            });
            return null;
        }
        const contractRef = estacaoSnap === null || estacaoSnap === void 0 ? void 0 : estacaoSnap.ref.parent.parent;
        const queryContatoSnap = await (contractRef === null || contractRef === void 0 ? void 0 : contractRef.collection('contato').where('status', '==', 'Ativo').where('phoneNumber.normalized', '==', (_b = message === null || message === void 0 ? void 0 : message.profile) === null || _b === void 0 ? void 0 : _b.wa_id).limit(1).get());
        const [contatoSnap] = (_c = queryContatoSnap === null || queryContatoSnap === void 0 ? void 0 : queryContatoSnap.docs) !== null && _c !== void 0 ? _c : [];
        const contato = contatoSnap === null || contatoSnap === void 0 ? void 0 : contatoSnap.data();
        if (!contato) {
            logger.debug({
                message: 'contato não encontrado',
                from: message.from
            });
            const newContact = {
                nome: (_d = message === null || message === void 0 ? void 0 : message.profile) === null || _d === void 0 ? void 0 : _d.name,
                phoneNumber: {
                    phoneNumber: message === null || message === void 0 ? void 0 : message.from,
                    normalized: (_e = message === null || message === void 0 ? void 0 : message.profile) === null || _e === void 0 ? void 0 : _e.wa_id
                },
                status: 'Ativo'
            };
            contractRef === null || contractRef === void 0 ? void 0 : contractRef.collection('contato').add(newContact);
        }
        const receivedMessage = {
            from: {
                name: contato.nome,
                phone: {
                    phoneNumber: message.from
                }
            },
            to: {
                name: estacao === null || estacao === void 0 ? void 0 : estacao.name,
                phone: {
                    phoneNumber: estacao === null || estacao === void 0 ? void 0 : estacao.numero
                }
            },
            content: JSON.stringify(message),
            controlCode: message.id,
            when: message.timestamp,
        };
        await (estacaoSnap === null || estacaoSnap === void 0 ? void 0 : estacaoSnap.ref.update({
            messages: admin.firestore.FieldValue.arrayUnion(receivedMessage)
        }));
    }
    catch (e) {
        const _f = e, { stack, message, name } = _f, error = __rest(_f, ["stack", "message", "name"]);
        functions.logger.error({
            message,
            jsonPayload: {
                id: context.params.id,
                name,
                stack,
                error
            }
        });
    }
    return null;
});
const actions = {
    'GET': async (request, response) => {
        const token = (0, secrets_1.loadSecrets)(process.env.INTEGRATION).facebook.verifyToken;
        if (request.query["hub.mode"] == "subscribe" &&
            request.query["hub.verify_token"] == token) {
            response.send(request.query["hub.challenge"]);
        }
        else {
            response.sendStatus(400);
        }
    },
    'POST': async (request, response) => {
        functions.logger.debug({
            message: 'msg received',
            body: request.body
        });
        const realtimeDb = admin.database();
        await realtimeDb.ref("whatsapp").push(request.body);
        response.sendStatus(200);
    }
};
exports.receiver = functions.runWith({
    secrets: ["INTEGRATION"]
}).https.onRequest(async (req, res) => {
    actions.hasOwnProperty(req.method) ? await actions[req.method](req, res) : await res.status(405).send('Method Not Allowed');
});
//# sourceMappingURL=index.js.map