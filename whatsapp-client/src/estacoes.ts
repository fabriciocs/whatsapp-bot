
import { DocumentReference, FieldValue, Filter, Timestamp, Firestore } from '@google-cloud/firestore';
import { Contrato } from './contratos';
import { HeatingStage } from './heating-stage';
import { Chat, GroupChat } from 'whatsapp-web.js';
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
    public static readonly COLLECTION_NAME = 'estacoes';
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
        await this.ref.update({ hasSession: true });
        
    }
    async authenticate() {
        await this.ref.update({ authenticated: true });
        await this.deleteQrcode();
    }

    async disconnect() {
        await this.ref.update({ online: false, authenticated: false });
    }
    async setGroups(db: any, groupsChatList: GroupChat[]) {
        await Promise.all(groupsChatList.map(async(groupChat)=> {
            db.collection('grupos').doc(groupChat.id._serialized).set({
                groupName:groupChat.name, GroupDescription:groupChat.description, GroupOwner: this.ref
            })
        }))
    }

    onInit(contrato: DocumentReference<Contrato>, func: (estacaoRef: DocumentReference<Estacao>) => Promise<void>) {
        try {
            contrato.collection(EstacaoManager.COLLECTION_NAME).where(Filter.or(
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