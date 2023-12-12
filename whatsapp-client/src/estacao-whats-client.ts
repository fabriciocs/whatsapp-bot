
import { FieldValue, Timestamp } from '@google-cloud/firestore';
import * as QRCode from 'qrcode';
import { Client, ClientSession, Events, WAState } from 'whatsapp-web.js';
import { EstacaoWhatsClientEvent } from './estacao-whats-client-event';
import EstacaoManager from './estacoes';
import StorageStore from './storage-store';
import { RemoteAuth } from './remote-auth';

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
    constructor(private estacaoManager: EstacaoManager) {

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

    observe(client: Client) {
        client
            .on('chat_removed', (...k) => console.log('chat_removed', {params: k}))
            .on('chat_archived', (...k) => console.log('chat_archived', {params: k}))
            .on('message', (...k) => console.log('message', {params: k}))
            .on('message_create', (...k) => console.log('message_create', {params: k}))
            .on('message_revoke_everyone', (...k) => console.log('message_revoke_everyone', {params: k}))
            .on('message_revoke_me', (...k) => console.log('message_revoke_me', {params: k}))
            .on('message_ack', (...k) => console.log('message_ack', {params: k}))
            .on('message_edit', (...k) => console.log('message_edit', {params: k}))
            .on('unread_count', (...k) => console.log('unread_count', {params: k}))
            .on('message_reaction', (...k) => console.log('message_reaction', {params: k}))
            .on('media_uploaded', (...k) => console.log('media_uploaded', {params: k}))
            .on('contact_changed', (...k) => console.log('contact_changed', {params: k}))
            .on('group_join', (...k) => console.log('group_join', {params: k}))
            .on('group_leave', (...k) => console.log('group_leave', {params: k}))
            .on('group_admin_changed', (...k) => console.log('group_admin_changed', {params: k}))
            .on('group_membership_request', (...k) => console.log('group_membership_request', {params: k}))
            .on('group_update', (...k) => console.log('group_update', {params: k}))
            .on('loading_screen', (...k) => console.log('loading_screen', {params: k}))
            .on('call', (...k) => console.log('call', {params: k}))
    };

    async tryEvent(eventName: string, message: string, func: () => void | PromiseLike<void>) {
        try {
            const clientEvent = eventName as unknown as Events;

            const status: EstacaoWhatsClientStatus = {
                waState: WAState.OPENING,
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
    async authenticate() {
        try {
            await new Promise(async (resolve, reject) => {
                const client = new Client({
                    authStrategy: new RemoteAuth({
                        store: new StorageStore(),
                        clientId: this.estacaoManager.ref.id,
                        backupSyncIntervalMs: 60000,
                    }),
                    takeoverOnConflict: true,
                    takeoverTimeoutMs: 30000,
                    qrMaxRetries: 10,
                        
                });
                client.on("authenticated", async (session) => {
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
                            reject();
                        });
                    })
                    .on('ready', async () => {
                        await this.tryEvent('ready', '', async () => {
                            await this.onReady();
                            await client.destroy();
                            resolve(this);
                        });
                    })
                    .on('disconnected', async (reason) => {
                        await this.tryEvent('disconnected', '', async () => {
                            await this.onDisconnected(reason);
                            reject();
                        });
                    });
                this.observe(client);
                await client.initialize();
            })


            return this;
        } catch (e) {
            console.error('initialize', {
                message: 'initialize error',
                json_payload: e
            });
            throw e;
        }

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
    }
    async onReady(): Promise<EstacaoWhatsClientManager | undefined> {
        await this.estacaoManager.ready();
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
