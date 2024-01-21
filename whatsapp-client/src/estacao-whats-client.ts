
import { FieldValue, Timestamp } from '@google-cloud/firestore';
import * as QRCode from 'qrcode';
import { Client, ClientSession, Events, WAState } from 'whatsapp-web.js';
import { EstacaoWhatsClientEvent } from './estacao-whats-client-event';
import EstacaoManager from './estacoes';
import { RemoteAuth } from './remote-auth';
import StorageStore from './storage-store';

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
                eventName, clientEvent, clientStatus
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
            estacaoWhatsClientEvent, clientStatus

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
            .on('chat_removed', async (...k) => await this.estacaoManager.addMsg('chat_removed',k))
            .on('chat_archived', async (...k) => await this.estacaoManager.addMsg('chat_archived',k))
            .on('message', async (...k) => await this.estacaoManager.addMsg('message',k))
            .on('message_create', async (...k) => await this.estacaoManager.addMsg('message_create',k))
            .on('message_revoke_everyone', async (...k) => await this.estacaoManager.addMsg('message_revoke_everyone',k))
            .on('message_revoke_me', async (...k) => await this.estacaoManager.addMsg('message_revoke_me',k))
            .on('message_ack', async (...k) => await this.estacaoManager.addMsg('message_ack',k))
            .on('message_edit', async (...k) => await this.estacaoManager.addMsg('message_edit',k))
            .on('unread_count', async (...k) => await this.estacaoManager.addMsg('unread_count',k))
            .on('message_reaction', async (...k) => await this.estacaoManager.addMsg('message_reaction',k))
            .on('media_uploaded', async (...k) => await this.estacaoManager.addMsg('media_uploaded',k))
            .on('contact_changed', async (...k) => await this.estacaoManager.addMsg('contact_changed',k))
            .on('group_join', async (...k) => await this.estacaoManager.addMsg('group_join',k))
            .on('group_leave', async (...k) => await this.estacaoManager.addMsg('group_leave',k))
            .on('group_admin_changed', async (...k) => await this.estacaoManager.addMsg('group_admin_changed',k))
            .on('group_membership_request', async (...k) => await this.estacaoManager.addMsg('group_membership_request',k))
            // .on('group_update', async (...k) => await this.estacaoManager.addMsg('group_update',k))
            .on('loading_screen', (...k) => console.log({k}))
            .on('call', async (k) => await this.estacaoManager.addMsg('call',k))
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
            console.error('Client EventError', e);
        }
        return await func();
    }
    async authenticate() {
        try {
            const client = this.createWhatsAppClient();
            
        const promise = new Promise<EstacaoWhatsClientManager>((resolve, reject) => {
                client
                    .on("authenticated", (session) => {
                        this.handleAuthenticated(session);
                    })
                    .on('qr', (qr) => {
                        this.handleQrcode(qr);
                    })
                    .on('auth_failure', (session?: ClientSession) => {
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
            return await promise;
        } catch (e) {
            console.error('initialize', e);
            throw e;
        }
    }

    private createWhatsAppClient() {
        return new Client({
            authStrategy: new RemoteAuth({
                store: new StorageStore(),
                clientId: this.estacaoManager.ref.id,
                backupSyncIntervalMs: 60000,
            }),
            takeoverOnConflict: true,
            takeoverTimeoutMs: 30000,
            qrMaxRetries: 10,
        });
    }

    private async handleAuthenticated(session?: ClientSession) {
        await this.estacaoManager.authenticate();
    }

    private async handleQrcode(qrcode?: string) {
        if (!qrcode) return;
        await this.estacaoManager.setQrcode(await this.getBase64Qrcode(qrcode));
        const qrCodeString = await QRCode.toString(qrcode, { type: 'terminal', small: true });
        console.log(qrCodeString);
    }

    private async handleAuthFailure(session?: ClientSession) {
        await this.estacaoManager.authFailure(session);
    }

    private async handleReady(client: Client) {
        await this.estacaoManager.ready();
        await client.destroy();
    }

    private async handleDisconnected(reason?: string) {
        await this.estacaoManager.disconnect();
    }

    private async getBase64Qrcode(qrcode: string) {
        const img = await QRCode.toDataURL(qrcode, { type: 'image/png', width: 300 });
        return img.split(',')[1];
    }
}
