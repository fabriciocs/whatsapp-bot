import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { EstacaoWhatsClientManager } from './estacao-whats-client';
import EstacaoManager from './estacoes';


dotenv.config();
admin.initializeApp();

export const start = functions.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (req, res) => {
    if (!req.query.path) {
        res.status(400).send('estacaoPath is required');
        return;
    }
    const path = req.query.path;
    const doc = await admin.firestore().doc(path.toString()).get();
    try {
        await new EstacaoWhatsClientManager(new EstacaoManager(doc.ref))
            .authenticate();
    } catch (e) {
        console.error('start error', {
            message: 'start error',
            json_payload: e
        })
        res.status(500).send('error');
        return;
    }
    res.status(200).send('ok');
});

// export const start = functions.runWith({
//     minInstances: 1,
//     memory: '4GB',
//     timeoutSeconds: 540
// }).firestore.document('/contrato/{contractId}/estacoes/{estacaoId}')
//     .onWrite(async (change, context) => {
//         const beforeChange = change.before;
//         const beforeData = beforeChange.data();

//         const afterChange = change.after;
//         const afterData = afterChange.data();

//         if (!beforeData || !afterData) return;
//         if (!afterData.shouldInit) return;

//         try {
//             await new EstacaoWhatsClientManager(new EstacaoManager(afterChange.ref))
//                 .authenticate();
//         } catch (e) {
//             console.error('start error', {
//                 message: 'start error',
//                 json_payload: e
//             })
//         }

//     });
