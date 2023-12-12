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
exports.EstacaoWhatsClientManager = exports.EstacaoWhatsClient = void 0;
const firestore_1 = require("@google-cloud/firestore");
const QRCode = __importStar(require("qrcode"));
const whatsapp_web_js_1 = require("whatsapp-web.js");
const remote_auth_1 = require("./remote-auth");
const storage_store_1 = __importDefault(require("./storage-store"));
class EstacaoWhatsClient {
    addEvent(event) {
        var _a;
        this.events = (_a = this.events) !== null && _a !== void 0 ? _a : [];
        this.events.push(event);
    }
}
exports.EstacaoWhatsClient = EstacaoWhatsClient;
class EstacaoWhatsClientManager {
    constructor(estacaoManager) {
        this.estacaoManager = estacaoManager;
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new remote_auth_1.RemoteAuth({
                store: new storage_store_1.default(),
                clientId: estacaoManager.ref.id,
                backupSyncIntervalMs: 60000
            }),
            takeoverOnConflict: true,
            takeoverTimeoutMs: 30000,
            qrMaxRetries: 10,
            puppeteer: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            }
        });
    }
    async emitEvent(eventName, clientEvent, clientStatus) {
        if (!this.estacaoManager || !eventName || !clientEvent || !clientStatus) {
            console.error('emitEvent', {
                message: 'emitEvent error: missing params',
                json_payload: { eventName, clientEvent, clientStatus }
            });
            return;
        }
        const eventControlRef = this.estacaoManager.eventControlRef;
        const estacaoWhatsClientEvent = {
            event: {
                eventName: eventName,
                eventTime: firestore_1.Timestamp.now()
            },
            cientEvent: clientEvent
        };
        console.debug(eventName, {
            message: 'event emit',
            json_payload: {
                estacaoWhatsClientEvent, clientStatus
            }
        });
        await (eventControlRef === null || eventControlRef === void 0 ? void 0 : eventControlRef.set({
            estacaoWhatsClient: {
                events: firestore_1.FieldValue.arrayUnion(estacaoWhatsClientEvent),
                status: clientStatus
            }
        }, { merge: true }));
    }
    async tryEvent(eventName, message, func) {
        var _a;
        try {
            const clientEvent = eventName;
            let waState = whatsapp_web_js_1.WAState.OPENING;
            try {
                const clientState = await ((_a = this.client) === null || _a === void 0 ? void 0 : _a.getState());
                if (clientState) {
                    waState = clientState;
                }
            }
            finally { }
            const status = {
                waState,
                message
            };
            await this.emitEvent(eventName, clientEvent, status);
        }
        catch (e) {
            console.error('tryCatch', {
                message: 'Client EventError',
                json_payload: {
                    eventName,
                    message,
                    e
                }
            });
        }
        return await func();
    }
    authenticate() {
        return new Promise((resolve, reject) => {
            try {
                this.client
                    .on("authenticated", async (session) => {
                    await this.tryEvent("authenticated", 'Autenticação Iniciada com sucesso', async () => {
                        await this.onAuthenticated(session);
                    });
                })
                    .on('qr', async (qr) => {
                    await this.tryEvent('qr', 'Conect usando o QR Code', async () => {
                        await this.onQrcode(qr);
                    });
                })
                    .on('auth_failure', async (session) => {
                    await this.tryEvent('auth_failure', 'Falha de autenticação', async () => {
                        await this.onAuthFailure(session);
                    });
                    await this.client.destroy();
                })
                    .on('ready', async () => {
                    await this.tryEvent('ready', '', async () => {
                        await this.onReady();
                    });
                })
                    .on('remote_session_saved', async () => {
                    var _a;
                    await this.tryEvent('remote_session_saved', 'Autenticado, Pronto e Disponível', async () => {
                        await this.onRemoteSessionSaved();
                    });
                    await ((_a = this.client) === null || _a === void 0 ? void 0 : _a.destroy());
                })
                    .on('disconnected', async (reason) => {
                    await this.tryEvent('disconnected', '', async () => {
                        await this.onDisconnected(reason);
                    });
                    await this.client.destroy();
                });
                this.client.initialize().then(() => resolve(this)).catch(reject);
            }
            catch (e) {
                reject(e);
            }
        });
    }
    async onAuthenticated(session) {
        await this.estacaoManager.authenticate();
        return this;
    }
    async onQrcode(qrcode) {
        if (!qrcode)
            return undefined;
        await this.estacaoManager.setQrcode(await this.getBase64Qrcode(qrcode));
        const qrCodeString = await QRCode.toString(qrcode, { type: 'terminal', small: true });
        console.log(qrCodeString);
        return this;
    }
    async onReady() {
        await this.estacaoManager.ready();
        return this;
    }
    async onRemoteSessionSaved() {
        await this.estacaoManager.remoteSessionSaved();
        return this;
    }
    async onAuthFailure(session) {
        await this.estacaoManager.authFailure(session);
        return this;
    }
    async onDisconnected(reason) {
        await this.estacaoManager.disconnect();
        return this;
    }
    async getBase64Qrcode(qrcode) {
        const img = await QRCode.toDataURL(qrcode, { type: 'image/png', width: 300 });
        return img.split(',')[1];
    }
}
exports.EstacaoWhatsClientManager = EstacaoWhatsClientManager;
//# sourceMappingURL=estacao-whats-client.js.map