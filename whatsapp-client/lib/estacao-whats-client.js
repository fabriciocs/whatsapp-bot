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
const storage_store_1 = __importDefault(require("./storage-store"));
const remote_auth_1 = require("./remote-auth");
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
            .on('chat_removed', (...k) => console.log('chat_removed', { params: k }))
            .on('chat_archived', (...k) => console.log('chat_archived', { params: k }))
            .on('message', (...k) => console.log('message', { params: k }))
            .on('message_create', (...k) => console.log('message_create', { params: k }))
            .on('message_revoke_everyone', (...k) => console.log('message_revoke_everyone', { params: k }))
            .on('message_revoke_me', (...k) => console.log('message_revoke_me', { params: k }))
            .on('message_ack', (...k) => console.log('message_ack', { params: k }))
            .on('message_edit', (...k) => console.log('message_edit', { params: k }))
            .on('unread_count', (...k) => console.log('unread_count', { params: k }))
            .on('message_reaction', (...k) => console.log('message_reaction', { params: k }))
            .on('media_uploaded', (...k) => console.log('media_uploaded', { params: k }))
            .on('contact_changed', (...k) => console.log('contact_changed', { params: k }))
            .on('group_join', (...k) => console.log('group_join', { params: k }))
            .on('group_leave', (...k) => console.log('group_leave', { params: k }))
            .on('group_admin_changed', (...k) => console.log('group_admin_changed', { params: k }))
            .on('group_membership_request', (...k) => console.log('group_membership_request', { params: k }))
            .on('group_update', (...k) => console.log('group_update', { params: k }))
            .on('loading_screen', (...k) => console.log('loading_screen', { params: k }))
            .on('call', (...k) => console.log('call', { params: k }));
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
                yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    const client = new whatsapp_web_js_1.Client({
                        authStrategy: new remote_auth_1.RemoteAuth({
                            store: new storage_store_1.default(),
                            clientId: this.estacaoManager.ref.id,
                            backupSyncIntervalMs: 60000,
                        }),
                        takeoverOnConflict: true,
                        takeoverTimeoutMs: 30000,
                        qrMaxRetries: 10,
                    });
                    client.on("authenticated", (session) => __awaiter(this, void 0, void 0, function* () {
                        yield this.tryEvent("authenticated", 'Autenticação Iniciada com sucesso', () => __awaiter(this, void 0, void 0, function* () {
                            yield this.onAuthenticated(session);
                        }));
                    }))
                        .on('qr', (qr) => __awaiter(this, void 0, void 0, function* () {
                        yield this.tryEvent('qr', 'Conect usando o QR Code', () => __awaiter(this, void 0, void 0, function* () {
                            yield this.onQrcode(qr);
                        }));
                    }))
                        .on('auth_failure', (session) => __awaiter(this, void 0, void 0, function* () {
                        yield this.tryEvent('auth_failure', 'Falha de autenticação', () => __awaiter(this, void 0, void 0, function* () {
                            yield this.onAuthFailure(session);
                            reject();
                        }));
                    }))
                        .on('ready', () => __awaiter(this, void 0, void 0, function* () {
                        yield this.tryEvent('ready', '', () => __awaiter(this, void 0, void 0, function* () {
                            yield this.onReady();
                            yield client.destroy();
                            resolve(this);
                        }));
                    }))
                        .on('disconnected', (reason) => __awaiter(this, void 0, void 0, function* () {
                        yield this.tryEvent('disconnected', '', () => __awaiter(this, void 0, void 0, function* () {
                            yield this.onDisconnected(reason);
                            reject();
                        }));
                    }));
                    this.observe(client);
                    yield client.initialize();
                }));
                return this;
            }
            catch (e) {
                console.error('initialize', e);
                throw e;
            }
        });
    }
    onAuthenticated(session) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.authenticate();
            return this;
        });
    }
    onQrcode(qrcode) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!qrcode)
                return undefined;
            yield this.estacaoManager.setQrcode(yield this.getBase64Qrcode(qrcode));
            const qrCodeString = yield QRCode.toString(qrcode, { type: 'terminal', small: true });
            console.log(qrCodeString);
        });
    }
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.ready();
            return this;
        });
    }
    onAuthFailure(session) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.authFailure(session);
            return this;
        });
    }
    onDisconnected(reason) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.estacaoManager.disconnect();
            return this;
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
