import { QueryDocumentSnapshot } from '@google-cloud/firestore';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { EstacaoWhatsClientManager } from './estacao-whats-client';
import EstacaoManager from './estacoes';

import { Filter } from 'firebase-admin/firestore';
import AppManager from './app-manager';

dotenv.config();
admin.initializeApp();

const authenticate = async (estacaoDoc: QueryDocumentSnapshot<admin.firestore.DocumentData>) => {


    try {
        const estacaoManager = new EstacaoWhatsClientManager(new EstacaoManager(estacaoDoc.ref));
        await estacaoManager.authenticate();


        console.log('start', {
           
        });
    } catch (e) {
        console.error('start error', e);
    }
};




(async() => {
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    new AppManager(db).listenEstacoes(Filter.or(
        Filter.where('autoInit', '==', true),
        Filter.where('shouldInit', '==', true)
    ), estacao => authenticate(estacao).catch(e => console.log(e)));
})();