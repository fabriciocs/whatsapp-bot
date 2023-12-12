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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
const dotenv = __importStar(require("dotenv"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const estacao_whats_client_1 = require("./estacao-whats-client");
const estacoes_1 = __importDefault(require("./estacoes"));
dotenv.config();
admin.initializeApp();
exports.start = functions.runWith({
    timeoutSeconds: 540,
}).https.onRequest(async (req, res) => {
    if (!req.query.path) {
        res.status(400).send('estacaoPath is required');
        return;
    }
    const path = req.query.path;
    const doc = await admin.firestore().doc(path.toString()).get();
    try {
        await new estacao_whats_client_1.EstacaoWhatsClientManager(new estacoes_1.default(doc.ref))
            .authenticate();
    }
    catch (e) {
        console.error('start error', {
            message: 'start error',
            json_payload: e
        });
        res.status(500).send('error');
        return;
    }
    res.status(200).send('ok');
});
// export const start = functions.runWith({
//     minInstances: 1,
//     memory: '4GB',
//     timeoutSeconds: 540
// }).firestore.document('/contrato/{contractId}/estacoes/{estacaoId}')
//     .onWrite(async (change, context) => {
//         const beforeChange = change.before;
//         const beforeData = beforeChange.data();
//         const afterChange = change.after;
//         const afterData = afterChange.data();
//         if (!beforeData || !afterData) return;
//         if (!afterData.shouldInit) return;
//         try {
//             await new EstacaoWhatsClientManager(new EstacaoManager(afterChange.ref))
//                 .authenticate();
//         } catch (e) {
//             console.error('start error', {
//                 message: 'start error',
//                 json_payload: e
//             })
//         }
//     });
//# sourceMappingURL=index.js.map