"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Estacao = void 0;
const firestore_1 = require("@google-cloud/firestore");
class Estacao {
}
exports.Estacao = Estacao;
class EstacaoManager {
    // private messageManager: MessageManager;
    constructor(ref) {
        this.ref = ref;
        this.COLLECTION_NAME = 'estacoes';
        // this.messageManager = new MessageManager(db);
    }
    async snapshot() {
        return await this.ref.get();
    }
    async data() {
        const snapshot = await this.snapshot();
        return snapshot.data();
    }
    get contratoRef() {
        return this.ref.parent.parent;
    }
    get eventControlRef() {
        var _a;
        return (_a = this.contratoRef) === null || _a === void 0 ? void 0 : _a.collection('eventControl').doc(this.ref.id);
    }
    async setQrcode(qrcode) {
        var _a;
        if (!qrcode)
            return;
        const qrCode = (_a = this.contratoRef) === null || _a === void 0 ? void 0 : _a.collection('qrcode').doc(this.ref.id);
        await (qrCode === null || qrCode === void 0 ? void 0 : qrCode.set({ base64: qrcode }));
        await this.ref.update({ qrcode: qrCode });
    }
    async deleteQrcode() {
        const estacao = await this.data();
        const qrCode = estacao === null || estacao === void 0 ? void 0 : estacao.qrcode;
        if (qrCode) {
            await this.ref.update({ qrcode: firestore_1.FieldValue.delete() });
            await qrCode.delete();
        }
    }
    async authFailure(...args) {
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
    onInit(contrato, func) {
        try {
            contrato.collection(this.COLLECTION_NAME).where(firestore_1.Filter.or(firestore_1.Filter.where('autoInit', '==', true), firestore_1.Filter.where('shouldInit', '==', true))).onSnapshot(async (snapshot) => {
                const changes = snapshot.docChanges();
                const addeds = changes.filter(({ type }) => type === 'added').map(change => change.doc.ref);
                const modified = changes.filter(({ type }) => type === 'modified').filter((doc) => {
                    const { shouldInit, autoInit, qrcode, shouldAuthenticate, tryAuthenticate } = doc.doc.data();
                    return (shouldInit || autoInit || shouldAuthenticate) && !!qrcode && !tryAuthenticate;
                }).map(change => change.doc.ref);
                Promise.allSettled([...addeds, ...modified]
                    .map(async (estacaoRef) => await func(estacaoRef)));
            });
        }
        catch (e) {
            console.error('onInit', {
                message: 'onInit error',
                json_payload: e
            });
        }
    }
}
exports.default = EstacaoManager;
//# sourceMappingURL=estacoes.js.map