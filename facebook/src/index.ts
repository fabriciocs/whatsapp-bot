import * as admin from 'firebase-admin';
import { DocumentReference } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import Message from './dto/message';
import { WhatsappMetaMessageSender } from './message-sender';
import { loadSecrets } from './secrets';

admin.initializeApp(functions.config().firebase);

const whatsMessageRef = 'whatsapp/{id}/entry/{entry}/changes/{change}/value';
const disparoRef = '/contrato/{contratoUuid}/disparos/{uuid}'

type xContato = {
    nome: string,
    numero: string,
    sms: string,
    email: string
}


const filterContatosByCanTriggerMsg = async (contratoRef?: admin.firestore.DocumentReference, contatosFullList?: xContato[]): Promise<xContato[]> => {
    if (!contratoRef || !contatosFullList) {
        return [];
    }
    return await Promise.all(contatosFullList?.filter(async ({ numero }) => {
        const phoneNumberStatusRef = await contratoRef?.collection('phoneNumberStatus').doc(numero).get();
        const { canTriggerMsg = false } = phoneNumberStatusRef?.data() ?? {};
        return canTriggerMsg;
    }) ?? []);
}
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

const contatosToTriggering = async (contatos: DocumentReference[]) => {
    const promises = contatos.map(async (contatoRef) => {
        const contatoSnap = await contatoRef.get();
        const { nome, phoneNumber, smsNumber, email } = contatoSnap.data() ?? {};
        const numero = phoneNumber?.normalized ?? phoneNumberBrasilianNormalizer(phoneNumber?.phoneNumber)
        const sms = smsNumber ?? numero?.replace(/(55\d{2})(\d{8})/, `$19$2`)
        return {
            nome,
            numero,
            sms,
            email
        } as xContato;
    });
    return await Promise.all(promises);
};

export const runTriggering = functions.runWith({
    timeoutSeconds: 540,
    memory: '2GB'
}).firestore.document(disparoRef).onWrite(async (changes, context) => {
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
    const campanhaRef = disparo.campanha as DocumentReference;
    const contatosRef = disparo.contatos as DocumentReference[];
    const estacoesRef = disparo.estacao as DocumentReference[];

    if (!campanhaRef || !contatosRef || !estacoesRef) {
        logger.error('without info error',
            disparo);
        return null;
    }


    const campanhaSnap = await campanhaRef.get();
    const campanha = campanhaSnap.data();
    const contatosFullList = await contatosToTriggering(contatosRef);
    const contatos = await filterContatosByCanTriggerMsg(disparoSnap?.ref?.parent?.parent ?? undefined, contatosFullList ?? []);

    if (contatos?.length > 0) {
        let status = 'completed'
        try {
            const contatosWithMail = contatos.filter(c => !!c.email);


            logger.debug({
                contatos: contatos.length,
                contatosWithMail: contatosWithMail.length
            });
            try {
                const { emailMessage = null } = campanha ?? {};
                const { subject, text, html } = emailMessage ?? {};
                logger.debug({
                    message: 'Send Mail',
                    emailMessage
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
                        await Promise.all(mails.map(async mail => {
                            dbBatch.set(await firestoreDb.collection('email').doc(), mail);
                        }));
                    } catch (e) {
                        logger.error('send email error',e);
                    }
                    await dbBatch.commit();
                }
            } catch (e) {
                logger.error('send email error',
                    e
                );
            }
            const qttByEstacao = Math.ceil(contatos.length / estacoesRef.length);
            await Promise.all(estacoesRef.map(async (estacaoSnap, index) => {
                try {
                    const estacaoRef = await estacaoSnap.get();
                    const estacao = estacaoRef.data();
                    const start = index * qttByEstacao;
                    const end = start + qttByEstacao;
                    const estacaoContatos = contatos.slice(start, end);

                    const msgSender = new WhatsappMetaMessageSender(estacao, campanha?.whatsappMetaMessage, estacaoContatos);
                    try {
                        const resultMessages = await msgSender.send();
                        await estacaoSnap.update({
                            messages: admin.firestore.FieldValue.arrayUnion(...resultMessages)
                        });

                    } catch (e) {
                        logger.error('msgSender result error', e);
                    }
                } catch (e) {
                    logger.error('WhatsappMetaMessageSendererror', e);
                }
                return estacaoSnap;
            }));

        } catch (e) {
            logger.error('triggering error', e);

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
        const snapVal = snapshot.val() as any;
        const { messages, metadata } = snapVal;

        const message = messages?.[0];
        const logger = functions.logger;

        const docDb = admin.firestore();
        const realtimeDb = admin.database();

        try {
            if (!message) {
                logger.debug({
                    message: "no message",
                    messages,
                    metadata

                })
                return null;
            }
            await realtimeDb.ref("messages").child('whatsapp').child(message.from).push(snapVal);

        } catch (e) {
            logger.error('error', e);
        }

        if (!message?.text?.body) {
            logger.debug({
                message
            });
            return null;
        }

        try {

            if (!metadata?.phone_number_id) return null;
            const { docs: estacaoDocs } = await docDb.collectionGroup('estacoes').where('status', '==', 'Ativo').where('waPhoneNumberId', '==', metadata?.phone_number_id).limit(1).get();
            if (!estacaoDocs.length) return null;
            const [estacaoSnap = null] = estacaoDocs ?? [];
            const estacao = estacaoSnap?.data();
            if (!estacao) {
                logger.debug({
                    message: 'estacao não encontrada',
                    metadata
                });
                return null;
            }
            const contractRef = estacaoSnap?.ref.parent.parent;
            const queryContatoSnap = await contractRef?.collection('contato').where('status', '==', 'Ativo').where('phoneNumber.normalized', '==', message?.profile?.wa_id).limit(1).get();
            const [contatoSnap] = queryContatoSnap?.docs ?? [];
            const contato = contatoSnap?.data();

            if (!contato) {
                logger.debug({
                    message: 'contato não encontrado',
                    from: message.from
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
            await estacaoSnap?.ref.update({
                messages: admin.firestore.FieldValue.arrayUnion(receivedMessage)
            });
        } catch (e) {
            const {
                stack,
                message,
                name,
                ...error
            } = e as Error;
            functions.logger.error(message, {
                
                    id: context.params.id,
                    name,
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
        functions.logger.debug({
            message: 'msg received',
            body: request.body
        });
        const realtimeDb = admin.database();
        await realtimeDb.ref("whatsapp").push(request.body);

        response.sendStatus(200);
    }
};

export const receiver = functions.runWith({
    secrets: ["INTEGRATION"]
}).https.onRequest(async (req, res) => {
    actions.hasOwnProperty(req.method) ? await actions[req.method](req, res) : await res.status(405).send('Method Not Allowed');
});
