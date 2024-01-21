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
    }
    emitEvent(eventName, clientEvent, clientStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.estacaoManager || !eventName || !clientEvent || !clientStatus) {
                console.error('emitEvent', {
                    message: 'emitEvent error: missing params',
                    eventName, clientEvent, clientStatus
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
                estacaoWhatsClientEvent, clientStatus
            });
            yield (eventControlRef === null || eventControlRef === void 0 ? void 0 : eventControlRef.set({
                estacaoWhatsClient: {
                    events: firestore_1.FieldValue.arrayUnion(estacaoWhatsClientEvent),
                    status: clientStatus
                }
            }, { merge: true }));
        });
    }
    observe(client) {
        client
            .on('chat_removed', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('chat_removed', k); }))
            .on('chat_archived', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('chat_archived', k); }))
            .on('message', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('message', k); }))
            .on('message_create', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('message_create', k); }))
            .on('message_revoke_everyone', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('message_revoke_everyone', k); }))
            .on('message_revoke_me', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('message_revoke_me', k); }))
            .on('message_ack', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('message_ack', k); }))
            .on('message_edit', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('message_edit', k); }))
            .on('unread_count', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('unread_count', k); }))
            .on('message_reaction', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('message_reaction', k); }))
            .on('media_uploaded', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('media_uploaded', k); }))
            .on('contact_changed', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('contact_changed', k); }))
            .on('group_join', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('group_join', k); }))
            .on('group_leave', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('group_leave', k); }))
            .on('group_admin_changed', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('group_admin_changed', k); }))
            .on('group_membership_request', (...k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('group_membership_request', k); }))
            // .on('group_update', async (...k) => await this.estacaoManager.addMsg('group_update',k))
            .on('loading_screen', (...k) => console.log({ k }))
            .on('call', (k) => __awaiter(this, void 0, void 0, function* () { return yield this.estacaoManager.addMsg('call', k); }));
    }
    ;
    tryEvent(eventName, message, func) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clientEvent = eventName;
                const status = {
                    waState: whatsapp_web_js_1.WAState.OPENING,
                    message
                };
                yield this.emitEvent(eventName, clientEvent, status);
            }
            catch (e) {
                console.error('Client EventError', e);
            }
            return yield func();
        });
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = this.createWhatsAppClient();
                const promise = new Promise((resolve, reject) => {
                    client
                        .on("authenticated", (session) => {
                        this.handleAuthenticated(session);
                    })
                        .on('qr', (qr) => {
                        this.handleQrcode(qr);
                    })
                        .on('auth_failure', (session) => {
                        this.handleAuthFailure(session);
                        reject(session);
                    })
                        .on('ready', () => {
                        this.handleReady(client);
                        resolve(this);
                    })
                        .on('disconnected', (reason) => {
                        this.handleDisconnected(reason);
                        reject(reason);
                    });
                    this.observe(client);
                    client.initialize();
                });
                return yield promise;
            }
            catch (e) {
                console.error('initialize', e);
                throw e;
            }
        });
    }
    createWhatsAppClient() {
        return new whatsapp_web_js_1.Client({
            authStrategy: new remote_auth_1.RemoteAuth({
                store: new storage_store_1.default(),
                clientId: this.estacaoManager.ref.id,
                backupSyncIntervalMs: 60000,
            }),
            takeoverOnConflict: true,
            takeoverTimeoutMs: 30000,
            qrMaxRetries: 10,
        });
    }
    handleAuthenticated(session) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.authenticate();
        });
    }
    handleQrcode(qrcode) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!qrcode)
                return;
            yield this.estacaoManager.setQrcode(yield this.getBase64Qrcode(qrcode));
            const qrCodeString = yield QRCode.toString(qrcode, { type: 'terminal', small: true });
            console.log(qrCodeString);
        });
    }
    handleAuthFailure(session) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.authFailure(session);
        });
    }
    handleReady(client) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.ready();
            yield client.destroy();
        });
    }
    handleDisconnected(reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.disconnect();
        });
    }
    getBase64Qrcode(qrcode) {
        return __awaiter(this, void 0, void 0, function* () {
            const img = yield QRCode.toDataURL(qrcode, { type: 'image/png', width: 300 });
            return img.split(',')[1];
        });
    }
}
exports.EstacaoWhatsClientManager = EstacaoWhatsClientManager;
