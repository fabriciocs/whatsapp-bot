import * as functions from 'firebase-functions';
import client from './client';
import { MsgTypes } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { reply } from './reply';
const oficialRef = 'whatsapp/oficial/';
const changeRef = '{id}/entry/{entry}/changes/{change}';
const messageRef = '/value/messages';

export const whatsappMessage = functions.database
    .ref(`${oficialRef}${changeRef}${messageRef}`)
    .onCreate(async (snapshot, context) => {
        const original = snapshot.val();
        const message = original[0];
        functions.logger.info(context.params.id, 'message', {
            receivedMessage: message,
            params: context.params
        });
        if (message?.text?.body) {
            const appData = await client.run();
            const metadata = (await snapshot.ref.parent?.child('metadata').get())?.val();
            functions.logger.info(context.params.id, 'metadata', {
                metadata
            });
            appData?.processMessage?.(new WhatsappMessageAdapter({
                from: message.from,
                body: message.text.body,
                fromMe: false,
                to: metadata?.display_phone_number,
                type: MsgTypes.TEXT,
                reply: async (body: string) => {
                    await reply(body, message.id);
                },
                getChat: async () => {
                    return {
                        sendMessage: async (body: string) => {
                            await reply(body, message.id);
                        }
                    }
                }
            }))
        }
        return message?.text?.body;
    });
