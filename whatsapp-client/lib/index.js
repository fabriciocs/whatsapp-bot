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
exports.onEstacaoChange = exports.whatsappReceivers = void 0;
const dotenv = __importStar(require("dotenv"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const estacao_whats_client_1 = require("./estacao-whats-client");
const estacoes_1 = __importDefault(require("./estacoes"));
const secrets_1 = require("./secrets");
const contratos_1 = __importDefault(require("./contratos"));
dotenv.config();
admin.initializeApp();
const authenticate = (estacaoDoc) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const estacao = estacaoDoc.data();
    }
    catch (e) {
        console.error('start error', e);
    }
});
// (async() => {
//     const db = admin.firestore();
//     db.settings({ ignoreUndefinedProperties: true });
//     new AppManager(db).listenEstacoes(Filter.or(
//         Filter.where('autoInit', '==', true),
//         Filter.where('shouldInit', '==', true)
//     ), estacao => authenticate(estacao).catch(e => console.log(e)));
// })();
const actions = {
    'GET': (request, response) => __awaiter(void 0, void 0, void 0, function* () {
        const token = (0, secrets_1.loadSecrets)(process.env.INTEGRATION).facebook.verifyToken;
        if (request.query["hub.mode"] == "subscribe" &&
            request.query["hub.verify_token"] == token) {
            response.send(request.query["hub.challenge"]);
        }
        else {
            response.sendStatus(400);
        }
    }),
    'POST': (request, response) => __awaiter(void 0, void 0, void 0, function* () {
        functions.logger.debug({
            message: 'msg received',
            body: request.body
        });
        const realtimeDb = admin.database();
        yield realtimeDb.ref("whatsapp").push(request.body);
        response.sendStatus(200);
    })
};
exports.whatsappReceivers = functions.runWith({
    secrets: ["INTEGRATION"]
}).https.onRequest((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const estacao = {
        "descricao": "Estacao 1",
        "numero": "001",
        "ultimaVezOnline": {
            "_seconds": 1642310400,
            "_nanoseconds": 0
        },
        "online": false,
        "autoInit": true,
        "authenticated": false,
        "hasSession": false,
        "shouldInit": true,
        "shouldAuthenticate": true,
        "tryAuthenticate": false,
        "heatingStage": {
            "id": "your_heating_stage_id_here",
            "path": "your_heating_stage_path_here"
        },
        "heatingStart": {
            "_seconds": 1642310500,
            "_nanoseconds": 0
        },
        "heatingCount": 3,
        "client": "Client ABC",
        "logMessage": "Estacao initialized successfully"
    };
    const contrato = {
        "contract_name": "Contract ABC",
        "contract_date": "2023-01-15T00:00:00Z",
        "contract_description": "This is a sample contract description.",
        "contract_status": "Active",
        "contract_type": "Service Agreement"
    };
    const db = admin.firestore();
    const contratoDoc = yield db.collection(contratos_1.default.COLLECTION_NAME).add(contrato);
    yield contratoDoc.collection(estacoes_1.default.COLLECTION_NAME).add(estacao);
    actions.hasOwnProperty(req.method) ? yield actions[req.method](req, res) : res.status(405).send('Method Not Allowed');
}));
exports.onEstacaoChange = functions
    .runWith({
    secrets: ["INTEGRATION"],
    timeoutSeconds: 540
})
    .firestore.document(`${contratos_1.default.COLLECTION_NAME}/{contratoUuid}/${estacoes_1.default.COLLECTION_NAME}/{uuid}`)
    .onWrite((change, context) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const afterData = (_b = (_a = change === null || change === void 0 ? void 0 : change.after) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.call(_a);
    if (!afterData) {
        return;
    }
    const { autoInit, shouldInit, qrcode, tryAuthenticate, authenticated: estacaoAutenticated } = afterData;
    if ((autoInit || shouldInit) && !qrcode && !tryAuthenticate && !estacaoAutenticated) {
        try {
            console.log({ qrcode, tryAuthenticate });
            change.after.ref.update({ tryAuthenticate: true });
            console.log({ afterData });
            const estacaoManager = new estacao_whats_client_1.EstacaoWhatsClientManager(new estacoes_1.default(change.after.ref));
            const authenticatedEstation = yield estacaoManager.authenticate();
            console.log('start', {
                authenticatedEstation
            });
        }
        catch (error) {
            console.error('Transaction failed:', error);
        }
    }
}));
