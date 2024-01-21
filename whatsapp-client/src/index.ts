import { DocumentSnapshot } from '@google-cloud/firestore';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { EstacaoWhatsClientManager } from './estacao-whats-client';
import EstacaoManager, { Estacao } from './estacoes';
import { loadSecrets } from './secrets';
import { truncate } from 'fs/promises';
import ContratoManager, { Contrato } from './contratos';

dotenv.config();
admin.initializeApp();

const authenticate = async (estacaoDoc: DocumentSnapshot<admin.firestore.DocumentData>) => {
    try {
        const estacao = estacaoDoc.data();
       
        
    } catch (e) {
        console.error('start error', e);
    }
};




// (async() => {
//     const db = admin.firestore();
//     db.settings({ ignoreUndefinedProperties: true });
//     new AppManager(db).listenEstacoes(Filter.or(
//         Filter.where('autoInit', '==', true),
//         Filter.where('shouldInit', '==', true)
//     ), estacao => authenticate(estacao).catch(e => console.log(e)));
// })();


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

export const whatsappReceivers = functions.runWith({
    secrets: ["INTEGRATION"]
}).https.onRequest(async (req, res) => {
    const estacao = {
        "descricao": "Estacao 1",
        "numero": "001",
        "ultimaVezOnline": {
            "_seconds": 1642310400,
            "_nanoseconds": 0
        },
        "online": false,
        "autoInit": true,
        "authenticated": false,
        "hasSession": false,
        "shouldInit": true,
        "shouldAuthenticate": true,
        "tryAuthenticate": false,
        "heatingStage": {
            "id": "your_heating_stage_id_here",
            "path": "your_heating_stage_path_here"
        },
        "heatingStart": {
            "_seconds": 1642310500,
            "_nanoseconds": 0
        },
        "heatingCount": 3,
        "client": "Client ABC",
        "logMessage": "Estacao initialized successfully"
    };

    const contrato = {
        "contract_name": "Contract ABC",
        "contract_date": "2023-01-15T00:00:00Z",
        "contract_description": "This is a sample contract description.",
        "contract_status": "Active",
        "contract_type": "Service Agreement"
    };
    const db = admin.firestore();
    const contratoDoc = await db.collection(ContratoManager.COLLECTION_NAME).add(contrato);
    await contratoDoc.collection(EstacaoManager.COLLECTION_NAME).add(estacao);


    actions.hasOwnProperty(req.method) ? await actions[req.method](req, res) : res.status(405).send('Method Not Allowed');
});
export const onEstacaoChange = functions
    .runWith({
        secrets: ["INTEGRATION"],
        timeoutSeconds: 540
    })
    .firestore.document(`${ContratoManager.COLLECTION_NAME}/{contratoUuid}/${EstacaoManager.COLLECTION_NAME}/{uuid}`)
    .onWrite(async (change, context) => {
        const afterData = change?.after?.data?.();
        if(!afterData){
            return;
        }
        const { autoInit, shouldInit, qrcode, tryAuthenticate, authenticated: estacaoAutenticated } =  afterData as Estacao;
        
        if ((autoInit || shouldInit) && !qrcode && !tryAuthenticate && !estacaoAutenticated) {
            try {    
                console.log({ qrcode, tryAuthenticate });        
                change.after.ref.update({ tryAuthenticate: true})
                console.log({ afterData })
                const estacaoManager = new EstacaoWhatsClientManager(new EstacaoManager(change.after.ref));
                const authenticatedEstation = await estacaoManager.authenticate();
                console.log('start', {
                    authenticatedEstation
                });
                
            } catch (error) {
                console.error('Transaction failed:', error);
            }
        }
    });

