import * as functions from 'firebase-functions';
import client from './client';
import { MsgTypes } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { reply } from './reply';
const whatsMessageRef = 'whatsapp/oficial/{id}/entry/{entry}/changes/{change}/value/messages';
const textMessageRef = 'textToCommand/{id}/messages';

export const textToCommand = functions
    .runWith({
        secrets: ["INTEGRATION"]
    })
    .database
    .ref(textMessageRef)
    .onCreate(async (snapshot, context) => {
        const message = snapshot.val() as any;
        functions.logger.debug(context.params.id, 'message', {
            receivedMessage: message,
            context
        });
        if (message?.text) {
            try {
                const appData = await client.run();
                const adaptedMsg = new WhatsappMessageAdapter({
                    from: message.from,
                    body: message.text,
                    fromMe: false,
                    to: message.to,
                    type: MsgTypes.TEXT,
                    reply: async (body: string) => {
                        await reply(message.from, body, message.id);
                    },
                    getChat: async () => {
                        return {
                            sendMessage: async (body: string) => {
                                await reply(message.from, body, message.id);
                            }
                        }
                    }
                });
                return await appData?.processMessage!(adaptedMsg);
            } catch (e) {
                const {
                    stack,
                    message,
                    name,
                    ...error
                } = e as Error;
                functions.logger.error(context.params.id, 'error', name, message ?? 'no message', {
                    stack,
                    error
                });
            }
        }
    });

export const whatsappMessage = functions
    .runWith({
        secrets: ["INTEGRATION"]
    })
    .database
    .ref(whatsMessageRef)
    .onCreate(async (snapshot, context) => {
        const original = snapshot.val() as any;
        const message = original[0];
        functions.logger.debug(context.params.id, 'message', {
            receivedMessage: message,
            context,
            original
        });
        if (message?.text?.body) {
            try {
                const appData = await client.run();
                const metadataRef = (await snapshot.ref.parent?.child('metadata').get());
                const metadata = metadataRef?.val();
                functions.logger.info(context.params.id, 'metadata', {
                    metadata
                });
                const adaptedMsg = new WhatsappMessageAdapter({
                    from: message.from,
                    body: message.text.body,
                    fromMe: false,
                    to: metadata?.display_phone_number,
                    type: MsgTypes.TEXT,
                    reply: async (body: string) => {
                        await reply(message.from, body, message.id);
                    },
                    getChat: async () => {
                        return {
                            sendMessage: async (body: string) => {
                                await reply(message.from, body, message.id);
                            }
                        }
                    }
                });
                return await appData?.processMessage!(adaptedMsg);
            } catch (e) {
                const {
                    stack,
                    message,
                    name,
                    ...error
                } = e as Error;
                functions.logger.error(context.params.id, 'error', name, message ?? 'no message', {
                    stack,
                    error
                });
            }
        }
        return null;
    });	
