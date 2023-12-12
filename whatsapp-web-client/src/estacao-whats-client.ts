
import { FieldValue, Timestamp } from '@google-cloud/firestore';
import * as QRCode from 'qrcode';
import { Client, ClientSession, Events, WAState } from 'whatsapp-web.js';
import { EstacaoWhatsClientEvent } from './estacao-whats-client-event';
import EstacaoManager from './estacoes';
import { RemoteAuth } from './remote-auth';
import StorageStore from './storage-store';
import { resolve} from 'path';

export type EstacaoWhatsClientStatus = {
    waState?: WAState;
    message?: string;
}

export class EstacaoWhatsClient {
    events?: EstacaoWhatsClientEvent[];
    addEvent(event: EstacaoWhatsClientEvent) {
        this.events = this.events ?? [];
        this.events.push(event);
    }
}
export class EstacaoWhatsClientManager {
    private client: Client;

    constructor(private estacaoManager: EstacaoManager) {
        this.client = new Client({
            authStrategy: new RemoteAuth({
                store: new StorageStore(),
                clientId: estacaoManager.ref.id,
                backupSyncIntervalMs: 60000
            }),
            takeoverOnConflict: true,
            takeoverTimeoutMs: 30000,
            qrMaxRetries: 10,
            puppeteer: {
                headless: 'chrome',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ], 
                userDataDir: resolve('../.wwebjs_auth/')
            }
        });
    }

    async emitEvent(eventName: string, clientEvent: Events, clientStatus: EstacaoWhatsClientStatus) {
        if (!this.estacaoManager || !eventName || !clientEvent || !clientStatus) {
            console.error('emitEvent', {
                message: 'emitEvent error: missing params',
                json_payload: { eventName, clientEvent, clientStatus }
            })
            return;
        }
        const eventControlRef = this.estacaoManager.eventControlRef;
        const estacaoWhatsClientEvent: EstacaoWhatsClientEvent = {
            event: {
                eventName: eventName,
                eventTime: Timestamp.now()
            },
            cientEvent: clientEvent
        }
        console.debug(eventName, {
            message: 'event emit',
            json_payload: {
                estacaoWhatsClientEvent, clientStatus
            }
        });
        await eventControlRef?.set({
            estacaoWhatsClient: {
                events: FieldValue.arrayUnion(estacaoWhatsClientEvent),
                status: clientStatus
            }
        }, { merge: true });

    }
    async tryEvent(eventName: string, message: string, func: () => void | PromiseLike<void>) {
        try {
            const clientEvent = eventName as unknown as Events;
            let waState = WAState.OPENING;
            try {
                const clientState = await this.client?.getState();
                if (clientState) {
                    waState = clientState;
                }
            } finally { }

            const status: EstacaoWhatsClientStatus = {
                waState,
                message
            }
            await this.emitEvent(eventName, clientEvent, status);
        } catch (e) {
            console.error('tryCatch', {
                message: 'Client EventError',
                json_payload: {
                    eventName,
                    message,
                    e
                }
            })
        }
        return await func();
    }
    authenticate() {
        return new Promise<EstacaoWhatsClientManager | undefined>((resolve, reject) => {

            try {
                this.client

                    .on("authenticated", async (session) => {
                        await this.tryEvent("authenticated", 'Autenticação Iniciada com sucesso', async () => {
                            await this.onAuthenticated(session);
                        });
                    })
                    .on('qr', async (qr) => {
                        await this.tryEvent('qr', 'Conect usando o QR Code', async () => {
                            await this.onQrcode(qr)
                        });
                    })
                    .on('auth_failure', async (session?: ClientSession) => {
                        await this.tryEvent('auth_failure', 'Falha de autenticação', async () => {
                            await this.onAuthFailure(session)
                        });
                        await this.client.destroy();
                    })
                    .on('ready', async () => {
                        await this.tryEvent('ready', '', async () => {
                            await this.onReady()
                        });
                    })
                    .on('remote_session_saved', async () => {
                        await this.tryEvent('remote_session_saved', 'Autenticado, Pronto e Disponível', async () => {
                            await this.onRemoteSessionSaved()
                        });
                        await this.client?.destroy();
                    })
                    .on('disconnected', async (reason) => {
                        await this.tryEvent('disconnected', '', async () => {
                            await this.onDisconnected(reason);
                        });
                        await this.client.destroy();
                    });

                this.client.initialize().then(() => resolve(this)).catch(reject);

            } catch (e) {
                reject(e);
            }
        });
    }

    async onAuthenticated(session?: ClientSession): Promise<EstacaoWhatsClientManager | undefined> {
        await this.estacaoManager.authenticate();
        return this;
    }
    async onQrcode(qrcode?: string): Promise<EstacaoWhatsClientManager | undefined> {
        if (!qrcode) return undefined;
        await this.estacaoManager.setQrcode(await this.getBase64Qrcode(qrcode));
        const qrCodeString = await QRCode.toString(qrcode, { type: 'terminal', small: true });
        console.log(qrCodeString);
        return this;
    }
    async onReady(): Promise<EstacaoWhatsClientManager | undefined> {
        await this.estacaoManager.ready();
        return this;
    }
    async onRemoteSessionSaved(): Promise<EstacaoWhatsClientManager | undefined> {
        await this.estacaoManager.remoteSessionSaved();
        return this;
    }
    async onAuthFailure(session?: ClientSession): Promise<EstacaoWhatsClientManager | undefined> {
        await this.estacaoManager.authFailure(session);
        return this;
    }
    async onDisconnected(reason?: string): Promise<EstacaoWhatsClientManager | undefined> {
        await this.estacaoManager.disconnect();
        return this;
    }

    private async getBase64Qrcode(qrcode?: string) {
        const img = await QRCode.toDataURL(qrcode!, { type: 'image/png', width: 300 });
        return img.split(',')[1];
    }
}
