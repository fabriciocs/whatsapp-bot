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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("@google-cloud/firestore");
const dotenv = __importStar(require("dotenv"));
const admin = __importStar(require("firebase-admin"));
const estacao_whats_client_1 = require("./estacao-whats-client");
const estacoes_1 = __importDefault(require("./estacoes"));
const app_manager_1 = __importDefault(require("./app-manager"));
dotenv.config();
admin.initializeApp();
const authenticate = (estacaoDoc) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const estacaoManager = new estacao_whats_client_1.EstacaoWhatsClientManager(new estacoes_1.default(estacaoDoc.ref));
        yield estacaoManager.authenticate();
        console.log('start', {});
    }
    catch (e) {
        console.error('start error', e);
    }
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    new app_manager_1.default(db).listenEstacoes(firestore_1.Filter.or(firestore_1.Filter.where('autoInit', '==', true), firestore_1.Filter.where('shouldInit', '==', true)), estacao => authenticate(estacao).catch(e => console.log(e)));
}))();
