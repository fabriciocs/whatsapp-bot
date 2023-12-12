
import { DocumentReference, FieldValue, Filter, Timestamp } from '@google-cloud/firestore';
import { Contrato } from './contratos';
import { HeatingStage } from './heating-stage';
export class Estacao {
    descricao?: string;
    numero?: string;
    contrato?: DocumentReference<Contrato>;
    ultimaVezOnline?: Timestamp;
    online?: boolean;
    autoInit?: boolean;
    authenticated?: boolean;

    hasSession?: boolean;
    shouldInit?: boolean;
    shouldAuthenticate?: boolean;
    tryAuthenticate?: boolean;
    heatingStage?: DocumentReference<HeatingStage>;
    heatingStart?: Timestamp;
    heatingCount?: number;
    client?: string;
    qrcode?: DocumentReference<any>;
    logMessage?: string;
}


export default class EstacaoManager {
    private readonly COLLECTION_NAME = 'estacoes';
    // private messageManager: MessageManager;

    constructor(public ref: DocumentReference<Estacao>) {
        // this.messageManager = new MessageManager(db);
    }

    private async snapshot() {
        return await this.ref.get();
    }

    private async data() {
        const snapshot = await this.snapshot();
        return snapshot.data() as Estacao;
    }

    private get contratoRef() {
        return this.ref.parent.parent;
    }

    get eventControlRef() {
        return this.contratoRef?.collection('eventControl').doc(this.ref.id);
    }

    async setQrcode(qrcode?: string) {
        if (!qrcode) return;
        const qrCode = this.contratoRef?.collection('qrcode').doc(this.ref.id);
        await qrCode?.set({ base64: qrcode });
        await this.ref.update({ qrcode: qrCode });
    }
    async deleteQrcode() {
        const estacao = await this.data();
        const qrCode = estacao?.qrcode;
        if (qrCode) {
            await this.ref.update({ qrcode: FieldValue.delete() });
            await qrCode.delete();
        }
    }
    async authFailure(...args: any[]) {
        await this.ref.update({ authenticated: false, hasSession: false });
        await this.disconnect();
        await this.deleteQrcode();
    }
    async ready() {
    }
    async authenticate() {
        await this.ref.update({ authenticated: true });
        await this.deleteQrcode();
    }
    async remoteSessionSaved() {
        await this.ref.update({ hasSession: true });
    }

    async disconnect() {
        await this.ref.update({ online: false, authenticated: false });
    }


    onInit(contrato: DocumentReference<Contrato>, func: (estacaoRef: DocumentReference<Estacao>) => Promise<void>) {
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