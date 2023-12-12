"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    snapshot() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.ref.get();
        });
    }
    data() {
        return __awaiter(this, void 0, void 0, function* () {
            const snapshot = yield this.snapshot();
            return snapshot.data();
        });
    }
    get contratoRef() {
        return this.ref.parent.parent;
    }
    get eventControlRef() {
        var _a;
        return (_a = this.contratoRef) === null || _a === void 0 ? void 0 : _a.collection('eventControl').doc(this.ref.id);
    }
    setQrcode(qrcode) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!qrcode)
                return;
            const qrCode = (_a = this.contratoRef) === null || _a === void 0 ? void 0 : _a.collection('qrcode').doc(this.ref.id);
            yield (qrCode === null || qrCode === void 0 ? void 0 : qrCode.set({ base64: qrcode }));
            yield this.ref.update({ qrcode: qrCode });
        });
    }
    deleteQrcode() {
        return __awaiter(this, void 0, void 0, function* () {
            const estacao = yield this.data();
            const qrCode = estacao === null || estacao === void 0 ? void 0 : estacao.qrcode;
            if (qrCode) {
                yield this.ref.update({ qrcode: firestore_1.FieldValue.delete() });
                yield qrCode.delete();
            }
        });
    }
    authFailure(...args) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ref.update({ authenticated: false, hasSession: false });
            yield this.disconnect();
            yield this.deleteQrcode();
        });
    }
    ready() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ref.update({ hasSession: true });
        });
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ref.update({ authenticated: true });
            yield this.deleteQrcode();
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ref.update({ online: false, authenticated: false });
        });
    }
    onInit(contrato, func) {
        try {
            contrato.collection(this.COLLECTION_NAME).where(firestore_1.Filter.or(firestore_1.Filter.where('autoInit', '==', true), firestore_1.Filter.where('shouldInit', '==', true))).onSnapshot((snapshot) => __awaiter(this, void 0, void 0, function* () {
                const changes = snapshot.docChanges();
                const addeds = changes.filter(({ type }) => type === 'added').map(change => change.doc.ref);
                const modified = changes.filter(({ type }) => type === 'modified').filter((doc) => {
                    const { shouldInit, autoInit, qrcode, shouldAuthenticate, tryAuthenticate } = doc.doc.data();
                    return (shouldInit || autoInit || shouldAuthenticate) && !!qrcode && !tryAuthenticate;
                }).map(change => change.doc.ref);
                Promise.allSettled([...addeds, ...modified]
                    .map((estacaoRef) => __awaiter(this, void 0, void 0, function* () { return yield func(estacaoRef); })));
            }));
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
