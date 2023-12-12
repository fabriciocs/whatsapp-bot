"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Contrato = void 0;
const admin = __importStar(require("firebase-admin"));
// A class to manage contrato at firestore
class ContratoManager {
    constructor(db = admin.firestore()) {
        this.db = db;
        this.COLLECTION_NAME = 'contrato';
        this.getContratosSnapshot = async () => await this.getContratosQuery().get();
        this.getContratosQuery = () => this.db.collection(this.COLLECTION_NAME).where('contract_status', '==', 'Ativo');
        this.contratos = [];
    }
    // get all contratos from firestore
    async getContratos() {
        const contratos = await this.getContratosSnapshot();
        this.contratos = contratos.docs.map((doc) => doc.data());
        return this.contratos;
    }
    async getContratosRef() {
        var _a;
        const contratos = await this.getContratosSnapshot();
        return (_a = contratos === null || contratos === void 0 ? void 0 : contratos.docs) === null || _a === void 0 ? void 0 : _a.map((doc) => doc === null || doc === void 0 ? void 0 : doc.ref);
    }
    // get contrato by id
    async getContrato(id) {
        const contrato = await this.db.collection(this.COLLECTION_NAME).doc(id).get();
        return contrato.data();
    }
    // get contrato by name
    async getContratoByName(name) {
        const contrato = await this.db.collection(this.COLLECTION_NAME).where('contract_name', '==', name).get();
        return contrato.docs.map((doc) => doc.data());
    }
    onInit(func) {
        this.getContratosQuery()
            .onSnapshot((querySnapshot) => {
            Promise.allSettled(querySnapshot.docChanges()
                .filter(({ type }) => ['added', 'modified'].includes(type))
                .map(({ doc }) => doc.ref)
                .map(async (contratoRef) => await func(contratoRef)));
        });
    }
}
exports.default = ContratoManager;
class Contrato {
}
exports.Contrato = Contrato;
//# sourceMappingURL=contratos.js.map