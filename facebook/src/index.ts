import * as admin from 'firebase-admin';
import { DocumentReference } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import Message from './dto/message';
import { MessageSender } from './message-sender';
import { loadSecrets } from './secrets';

admin.initializeApp(functions.config().firebase);

const whatsMessageRef = 'whatsapp/{id}/entry/{entry}/changes/{change}/value';
const disparoRef = '/contrato/{contratoUuid}/disparos/{uuid}'
const contatoRef = '/contrato/{contratoUuid}/contato/{uuid}'
const phoneNumberBrasilianNormalizer = (phoneNumber: string) => {
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

type nomeNumero = {
    nome: string,
    numero: string
}


const filterContatosByCanTriggerMsg = async (contratoRef?: admin.firestore.DocumentReference, contatosFullList?: nomeNumero[]): Promise<nomeNumero[]> => {
    if (!contratoRef || !contatosFullList) {
        return [];
    }
    return await Promise.all(contatosFullList?.filter(async ({ numero }) => {
        const phoneNumberStatusRef = await contratoRef?.collection('phoneNumberStatus').doc(numero).get();
        const { canTriggerMsg } = phoneNumberStatusRef?.data() ?? {};
        return canTriggerMsg;
    }) ?? []);
}

const contatosToPhoneNumber = async (contatos: DocumentReference[]) => {
    const promises = contatos.map(async (contatoRef) => {
        const contatoSnap = await contatoRef.get();
        const { nome, phoneNumber } = contatoSnap.data() ?? {};
        return {
            nome,
            numero: phoneNumber?.normalized ?? phoneNumberBrasilianNormalizer(phoneNumber?.phoneNumber)
        } as nomeNumero;
    });
    return await Promise.all(promises);
};
export const normalizeContact = functions.runWith({
    timeoutSeconds: 540,
    memory: '2GB'
}).firestore.document(contatoRef).onWrite(async (changes, context) => {
    const logger = functions.logger;
    try {
        const contactSnap = changes.after;
        const contact = contactSnap?.data();
        const oldContactSnap = changes.before;
        const oldContact = oldContactSnap?.data();
        if (!contactSnap.exists) {
            logger.debug('contato', {
                message: 'contato deleted',
                json_payload: contactSnap.data()
            });
            return null;
        }

        if (oldContact?.phoneNumber?.normalized === contact?.phoneNumber?.normalized && !!contact?.phoneNumber?.normalized) {
            return;
        }
        if (!contact?.phoneNumber?.phoneNumber) {
            return;
        }
        const normalized = phoneNumberBrasilianNormalizer(contact.phoneNumber.phoneNumber);
        if (normalized === contact?.phoneNumber?.normalized) {
            return;
        }
        const contractRef = contactSnap.ref.parent.parent;
        const phoneNumberStatusRef = await contractRef?.collection('phoneNumberStatus').doc(normalized).get();
        if (!phoneNumberStatusRef?.exists) {
            await phoneNumberStatusRef?.ref.set({
                contato: contactSnap.ref,
                canTriggerMsg: true
            });
        }


        return contactSnap.ref.set({
            phoneNumber: { normalized }
        }, { merge: true });
    } catch (e) {
        logger.error('normalizeContact', {
            message: 'normalizeContact error',
            json_payload: e
        });
    }
    return;

});


export const runTriggering = functions.runWith({
    timeoutSeconds: 540,
    memory: '2GB'
}).firestore.document(disparoRef).onWrite(async (changes, context) => {
    const logger = functions.logger;
    const { contratoUuid, uuid } = context.params;
    logger.debug({
        message: 'disparo debug',
        json_payload: { contratoUuid, uuid }
    });
    const disparoSnap = changes.after;
    if (!disparoSnap.exists) {
        logger.debug({
            message: 'disparo deleted',
            json_payload: disparoSnap.data()
        });
        return null;
    }
    const disparo = disparoSnap.data();
    if (!disparo) {
        logger.error({
            message: 'disparo error, no data',
            json_payload: disparo
        });
        return null;
    }
    const shouldTrigger = disparo.status === 'pending';
    if (!shouldTrigger) {
        logger.debug({
            message: 'disparo not pending',
            json_payload: disparo
        });
        return null;
    }
    const campanhaRef = disparo.campanha as DocumentReference;
    const contatosRef = disparo.contatos as DocumentReference[];
    const estacoesRef = disparo.estacao as DocumentReference[];

    if (!campanhaRef || !contatosRef || !estacoesRef) {
        logger.error({
            message: 'without info error',
            json_payload: disparo
        });
        return null;
    }


    const campanhaSnap = await campanhaRef.get();
    const campanha = campanhaSnap.data();
    const contatosFullList = await contatosToPhoneNumber(contatosRef);
    const contatos = await filterContatosByCanTriggerMsg(disparoSnap?.ref?.parent?.parent ?? undefined, contatosFullList ?? []);
    if (contatos?.length > 0) {
        let status = 'completed'
        try {
            logger.debug('contatos', {
                contatos: contatos.length
            });
            const qttByEstacao = Math.ceil(contatos.length / estacoesRef.length);
            await Promise.all(estacoesRef.map(async (estacaoSnap, index) => {
                try {
                    const estacaoRef = await estacaoSnap.get();
                    const estacao = estacaoRef.data();
                    const start = index * qttByEstacao;
                    const end = start + qttByEstacao;
                    const estacaoContatos = contatos.slice(start, end);

                    const msgSender = new MessageSender(estacao, campanha?.message, estacaoContatos);
                    try {
                        const result = await msgSender.send();
                        const resultMessages = await Promise.all(result.map(async ({ nome, numero, sendTime, response }: any) => {
                            const { messages } = response;
                            const message = messages[0];
                            const { id } = message;
                            return {
                                from: {
                                    name: estacao?.name,
                                    phone: {
                                        phoneNumber: estacao?.numero
                                    }
                                },
                                to: {
                                    name: nome,
                                    phone: {
                                        phoneNumber: numero
                                    }
                                },
                                content: campanha?.message,
                                controlCode: id,
                                response,
                                when: sendTime,
                            } as Message;
                        }));
                        await estacaoSnap.update({
                            messages: admin.firestore.FieldValue.arrayUnion(...resultMessages)
                        });

                    } catch (e) {
                        logger.error('msgSender result', {
                            message: 'msgSender result error',
                            json_payload: e
                        });
                    }
                } catch (e) {
                    logger.error('msgSender', {
                        message: 'msgSender error',
                        json_payload: e
                    });
                }
                return estacaoSnap;
            }));

        } catch (e) {
            logger.error('triggering error', {
                message: 'triggering error',
                json_payload: e
            });

            status = 'failed'
        }
        return disparoSnap.ref.update({
            status
        });
    }
    return null;


});

export const processor = functions
    .runWith({
        secrets: ["INTEGRATION"]
    })
    .database
    .ref(whatsMessageRef)
    .onCreate(async (snapshot: any, context: any) => {
        const { messages, metadata } = snapshot.val() as any;
        const message = messages[0];
        const logger = functions.logger;
        const docDb = admin.firestore();

        try {

        } catch (e) {
            logger.error('fail to save msg to firestore', e)
        }
        if (!message?.text?.body) {
            logger.debug('message', {
                message
            });
            return null;
        }

        try {

            if (!metadata?.phone_number_id) return null;
            const { docs: estacaoDocs } = await docDb.collectionGroup('estacoes').where('status', '==', 'Ativo').where('waPhoneNumberId', '==', metadata?.phone_number_id).limit(1).get();
            if (!estacaoDocs.length) return null;
            const [estacaoSnap] = estacaoDocs ?? [];
            const estacao = estacaoSnap?.data();
            if (!estacao) {
                logger.debug('estacao não encontrada', {
                    message: 'estacao não encontrada',
                    json_payload: metadata
                });
                return null;
            }
            const contractRef = estacaoSnap.ref.parent.parent;
            const queryContatoSnap = await contractRef?.collection('contato').where('status', '==', 'Ativo').where('phoneNumber.normalized', '==', message?.profile?.wa_id).limit(1).get();
            const [contatoSnap] = queryContatoSnap?.docs ?? [];
            const contato = contatoSnap?.data();

            if (!contato) {
                logger.debug('contato não encontrado', {
                    message: 'contato não encontrado',
                    json_payload: message.from
                });
                const newContact = {
                    nome: message?.profile?.name,
                    phoneNumber: {
                        phoneNumber: message?.from,
                        normalized: message?.profile?.wa_id
                    },
                    status: 'Ativo'
                };
                contractRef?.collection('contato').add(newContact);

            }
            const receivedMessage = {
                from: {

                    name: contato.nome,
                    phone: {
                        phoneNumber: message.from
                    }
                },
                to: {
                    name: estacao?.name,
                    phone: {
                        phoneNumber: estacao?.numero
                    }
                },
                content: JSON.stringify(message),
                controlCode: message.id,
                when: message.timestamp,
            } as Message
            await estacaoSnap.ref.update({
                messages: admin.firestore.FieldValue.arrayUnion(receivedMessage)
            });
        } catch (e) {
            const {
                stack,
                message,
                name,
                ...error
            } = e as Error;
            functions.logger.error(context.params.id, 'error', name, message ?? 'no message', {
                stack,
                error
            });
        }

        return null;
    });



const actions: any = {
    'GET': async (request: functions.https.Request, response: functions.Response<any>) => {
        const token = loadSecrets(process.env.INTEGRATION!).facebook.verifyToken;
        if (
            request.query["hub.mode"] == "subscribe" &&
            request.query["hub.verify_token"] == token
        ) {
            response.send(request.query["hub.challenge"]);
        } else {
            response.sendStatus(400);
        }
    },
    'POST': async (request: functions.https.Request, response: functions.Response<any>) => {
        functions.logger.debug('msg received', {
            message: 'msg received',
            json_payload: request.body
        });
        const { object, entry } = request.body;
        const realtimeDb = admin.database();
        const pushed = await realtimeDb.ref("whatsapp").push(request.body);
        try {
            await Promise.all(entry?.map(async (entryItem: any) => {
                await Promise.all(entryItem?.changes?.map(async (change: any) => {
                    const { field, value } = change;
                    try {
                        await realtimeDb.ref("messages").child('whatsapp').child(object).child(field).child(pushed.key!).set(value);
                    } catch (e) {
                        functions.logger.error('error', {
                            message: 'error',
                            json_payload: e
                        });
                    }
                }));
            }
            ));
        } catch (e) {
            functions.logger.error('error', {
                message: 'error',
                json_payload: e
            });
        }
        response.sendStatus(200);
    }
};

export const receiver = functions.runWith({
    secrets: ["INTEGRATION"]
}).https.onRequest(async (req, res) => {
    actions.hasOwnProperty(req.method) ? await actions[req.method](req, res) : await res.status(405).send('Method Not Allowed');
});
