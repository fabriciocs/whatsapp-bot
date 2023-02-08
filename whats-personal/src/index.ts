import * as functions from 'firebase-functions';
import client from './client';
import { MsgTypes } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { reply } from './reply';
const oficialRef = 'whatsapp/oficial/';
const changeRef = '{id}/entry/{entry}/changes/{change}';
const messageRef = '/value/messages';

export const whatsappMessage = functions
    .runWith({
        timeoutSeconds: 540,
        memory: '2GB'
    })
    .database
    .ref(`${oficialRef}${changeRef}${messageRef}`)
    .onCreate(async (snapshot, context) => {
        functions.logger.debug(context.params.id, 'snapshot', {
            snapshot: snapshot.ref.toJSON()
        });
        const original = snapshot.val() as any;
        const message = original[0];
        functions.logger.debug(context.params.id, 'message', {
            receivedMessage: message,
            params: context.params
        });

        if (message?.text?.body) {
            try {
                const appData = await client.run();
                const metadataRef = await snapshot.ref.parent?.child('metadata').get();
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
                functions.logger.error(context.params.id, 'error', {
                    error: e,
                    context
                });
            }

        }
        return null;
    });	
