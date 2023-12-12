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
exports.Message = void 0;
const firestore_1 = require("@google-cloud/firestore");
const admin = __importStar(require("firebase-admin"));
class Message {
}
exports.Message = Message;
class MessageManager {
    constructor(db = admin.firestore()) {
        this.db = db;
        this.COLLECTION_NAME = 'messages';
    }
    // get all messages from firestore
    async getMessages(contrato, estacao) {
        const messages = await contrato.collection(this.COLLECTION_NAME).where('estacao', '==', estacao).get();
        return messages.docs.map((doc) => doc.data());
    }
    // get message by id
    async getMessage(contrato, id) {
        const message = await contrato.collection(this.COLLECTION_NAME).doc(id).get();
        return message.data();
    }
    async addMessage(contrato, estacao, message) {
        await contrato.collection(this.COLLECTION_NAME).doc(estacao.id).set({ messages: firestore_1.FieldValue.arrayUnion(message) }, { merge: true });
    }
}
exports.default = MessageManager;
//# sourceMappingURL=messages.js.map