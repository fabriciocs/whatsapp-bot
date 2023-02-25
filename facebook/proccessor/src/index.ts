import * as functions from 'firebase-functions';
import client from '../../shared/client';
import { MsgTypes } from '../../shared/msg/msg';
import WhatsappMessageAdapter from '../../shared/msg/whatsapp-message-adpater';
import { httpReply } from '../../shared/httpReply';
const whatsMessageRef = 'whatsapp/oficial/{id}/entry/{entry}/changes/{change}/value/messages';
export const proccessor = functions
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
            context
        });
        if (message?.text?.body) {
            try {
                const appData = await client.run();
                const metadataRef = (await snapshot.ref.parent?.child('metadata').get());
                const metadata = metadataRef?.val();
                functions.logger.debug(context.params.id, 'metadata', {
                    metadata
                });
                const adaptedMsg = new WhatsappMessageAdapter({
                    from: message.from,
                    body: message.text.body,
                    fromMe: false,
                    to: metadata?.display_phone_number,
                    type: MsgTypes.TEXT,
                    reply: async (body: string) => await httpReply(message.from, body, message.id),
                    getChat: async () => ({
                        sendMessage: async (body: string) => {
                            await httpReply(message.from, body, message.id);
                        }
                    })
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
