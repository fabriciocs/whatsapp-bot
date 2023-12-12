import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { EstacaoWhatsClientManager } from './estacao-whats-client';
import EstacaoManager from './estacoes';


dotenv.config();
admin.initializeApp();

async function authenticate([estacaoPath]: string[]) {
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    const doc = await admin.firestore().doc(estacaoPath.toString()).get();
    try {
        const estacaoManager = new EstacaoWhatsClientManager(new EstacaoManager(doc.ref));
        await estacaoManager.authenticate();
        
        
        console.log('start', {
            message: 'start'
        });
    } catch (e) {
        console.error('start error', {
            message: 'start error',
            json_payload: e
        });
    }
};
authenticate(process.argv.slice(2)).catch((err) => {
    console.error(JSON.stringify({ severity: "ERROR", message: err.message, err }));
    process.exit(1);
});
