import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import client from './client';
import { httpReply } from './httpReply';
import { loadSecrets } from './secrets';
import { MsgTypes } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';

admin.initializeApp(functions.config().firebase);

const whatsMessageRef = 'whatsapp/oficial/{id}/entry/{entry}/changes/{change}/value/messages';
export const processor = functions
    .runWith({
        secrets: ["INTEGRATION"]
    })
    .database
    .ref(whatsMessageRef)
    .onCreate(async (snapshot: any, context: any) => {
        const original = snapshot.val() as any;
        const message = original[0];
        const logger = functions.logger;

        logger.debug('message', {
            message,
            params: context.params
        });
        if (message?.text?.body) {
            try {
    
                const metadataRef = (await snapshot.ref.parent?.child('metadata').get());
                const metadata = metadataRef?.val();
                logger.debug('metadata', {
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



const actions: any = {
    'GET': async (request: functions.https.Request, response: functions.Response<any>) => {
        const token = loadSecrets(process.env.INTEGRATION!).facebook.verifyToken;
        if (
            request.query["hub.mode"] == "subscribe" &&
            request.query["hub.verify_token"] == token
        ) {
            response.send(request.query["hub.challenge"]);
        } else {
            response.sendStatus(400);
        }
    },
    'POST': async (request: functions.https.Request, response: functions.Response<any>) => {
        functions.logger.info('webhook', '-', 'post', { body: request.body });
        await admin.database().ref("whatsapp").child("oficial").push(request.body);
        response.sendStatus(200);
    }
};

export const receiver = functions.runWith({
    secrets: ["INTEGRATION"]
}).https.onRequest(async (req, res) => {
    actions.hasOwnProperty(req.method) ? await actions[req.method](req, res) : await res.status(405).send('Method Not Allowed');
});

