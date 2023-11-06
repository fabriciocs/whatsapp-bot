import * as admin from 'firebase-admin';
import { DocumentReference } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import { MessageSender } from './message-sender';
admin.initializeApp(functions.config().firebase);
// fetch('https://localhost:4040/api/tunnels').then((res) => res.json()).then(async ({ tunnels }) => {
//     const [tunnel] = tunnels;
//     const url = tunnel.public_url;
//     const remoteConfig = admin.remoteConfig();
//     const template = await remoteConfig.getTemplate();
//     template.parameters['localhost_address'] = {
//         defaultValue: {
//             value: url
//         }
//     };
//     await remoteConfig.publishTemplate(template);


// });

// const whatsMessageRef = 'whatsapp/{id}/entry/{entry}/changes/{change}/value/messages';
const disparoRef = '/contrato/{contratoUuid}/disparos/{uuid}'
// const contratoRef = '/contrato/{contratoUuid}'

const contatosToPhoneNumber = async (contatos: DocumentReference[]) => {
    const promises = contatos.map(async (contatoRef) => {
        const contatoSnap = await contatoRef.get();
        const { nome, phoneNumber } = contatoSnap.data() ?? {};
        return {
            nome,
            numero: `${phoneNumber?.phoneNumber}`.replace(/\D/g, ``)
        }
    });
    return await Promise.all(promises);
};


// const createDisparo = async (contratoRef: DocumentReference) => {
//     const campanha = await contratoRef.collection('campanha').add({
//         message: `{
//             "messaging_product": "whatsapp",
//             "type": "text",
//             "text": {
//                 "preview_url": true,
//                 "body": "Conheça o poder da Inteligência Artificial (IA) ao seu dispor, https://site.luau.tech"
//             }
//         }`,
//         trigger: `trigger`,
//         name: `campanha 001`
//     });
//     const contato = await contratoRef.collection('contato').add({
//         nome: `padrao`,
//         phoneNumber: {
//             phoneNumber: `5564992469064`
//         }
//     });

//     const estacao = await contratoRef.collection('estacoes').add({
//         cloudApiAccessToken: process.env.CLOUD_API_ACCESS_TOKEN,
//         cloudApiVersion: 'v18.0',
//         waPhoneNumberId: process.env.WA_PHONE_NUMBER_ID,
//         descricao: 'estacao de teste'
//     });
//     await contratoRef.collection('disparos').add({
//         estacao: [
//             estacao
//         ],
//         contatos: [
//             contato
//         ],
//         campanha
//     });
// }
// export const runTriggerContrato = functions.runWith({
//     timeoutSeconds: 540
// }).firestore.document(contratoRef).onCreate(async (contratoSnap, context) => {
//     await createDisparo(contratoSnap.ref);
// });

export const runTrigger = functions.runWith({
    timeoutSeconds: 540,
    memory: '2GB'
}).firestore.document(disparoRef).onWrite(async (changes, context) => {
    const logger = functions.logger;
    const { contratoUuid, uuid } = context.params;
    logger.debug('disparo', {
        contratoUuid, uuid
    });
    const disparoSnap = changes.after;
    if (!disparoSnap.exists) {
        logger.debug('disparo', {
            message: 'disparo deleted',
            json_payload: disparoSnap.data()
        });
        return null;
    }
    const disparo = disparoSnap.data();
    if (!disparo) {
        logger.error('disparo', {
            message: 'disparo error, no data',
            json_payload: disparo
        });
        return null;
    }
    const shouldTrigger = disparo.status === 'pending';
    if (!shouldTrigger) {
        logger.debug('disparo', {
            message: 'disparo not pending',
            json_payload: disparo
        });
        return null;
    }
    const campanhaRef = disparo.campanha as DocumentReference;
    const contatosRef = disparo.contatos as DocumentReference[];
    const estacoesRef = disparo.estacao as DocumentReference[];

    if (!campanhaRef || !contatosRef || !estacoesRef) {
        logger.error('disparo', {
            message: 'disparo error',
            json_payload: disparo
        });
        return null;
    }


    const campanhaSnap = await campanhaRef.get();
    const campanha = campanhaSnap.data();
    const contatos = await contatosToPhoneNumber(contatosRef);
    if (contatos?.length > 0) {
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
                await msgSender.send();
            } catch (e) {
                logger.error('msgSender', {
                    message: 'msgSender error',
                    json_payload: e
                });
            }
            return estacaoSnap;
        }));
    }
    return null;
});