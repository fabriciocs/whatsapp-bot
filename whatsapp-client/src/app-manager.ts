
import { Filter, Firestore, QueryDocumentSnapshot } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';
import EstacaoManager, { Estacao } from './estacoes';
import { DocumentSnapshot } from 'firebase-admin/firestore';
export default class AppManager {
    constructor(private db: Firestore = admin.firestore()) {
    }
    listenEstacoes(filter: Filter, func: (estacao: QueryDocumentSnapshot<admin.firestore.DocumentData>) => PromiseLike<void> | void) {
        this.db.collectionGroup(EstacaoManager.COLLECTION_NAME).where(filter)
            .onSnapshot(async (snapshot) => {
                const changes = snapshot.docChanges();

                changes.forEach(change => {
                    if (change.type === 'added') {
                        return func(change.doc);
                    }
                    if (change.type === 'modified') {
                        const { shouldInit, autoInit, qrcode, shouldAuthenticate, tryAuthenticate } = change.doc.data() as Estacao;
                        if ((shouldInit || autoInit || shouldAuthenticate)
                            && !!qrcode && !tryAuthenticate) {
                            return func(change.doc);
                        }
                    }
                });
            });
    }
    /**
     * onInit( func: () => Promise<void>) {
        try {
            contrato.collection(this.COLLECTION_NAME).where(Filter.or(
                Filter.where('autoInit', '==', true),
                Filter.where('shouldInit', '==', true)
            )).onSnapshot(async (snapshot) => {
                const changes = snapshot.docChanges();
                const addeds = changes.filter(({ type }) => type === 'added').map(change => change.doc.ref);

                const modified = changes.filter(({ type }) => type === 'modified').filter((doc) => {
                    const { shouldInit, autoInit, qrcode, shouldAuthenticate, tryAuthenticate } = doc.doc.data() as Estacao;
                    return (shouldInit || autoInit || shouldAuthenticate) && !!qrcode && !tryAuthenticate;
                }).map(change => change.doc.ref);

                Promise.allSettled([...addeds, ...modified]
                    .map(async (estacaoRef) => await func(estacaoRef))
                );
            });
        } catch (e) {
            console.error('onInit', {
                message: 'onInit error',
                json_payload: e
            });
        }
    }
     */

    // async addMsg(contrato: DocumentReference<Contrato>, estacao: DocumentReference<Estacao>, msgsData: any) {
    //     if (!msgsData) return;
    //     const msgsDataString = JSON.stringify(msgsData, null, 4);
    //     if (!msgsDataString) return;
    //     try {
    //         const msgsDataParsed = JSON.parse(msgsDataString);
    //     } catch (e) {
    //         console.error('Error parsing message data', e);
    //         return;
    //     }
    //     await this.messageManager.addMessage(contrato, estacao, msgsDataString);
    // }

}