import { Message } from 'whatsapp-web.js';
import { FacebookWebhookMessageJson } from './facebook-message';

export class MessageAdapterService {
    constructor() {}

    // Method to adapt a WhatsApp Message to Facebook Webhook Message
    adaptWhatsAppToFacebook(whatsappMessage: Message): FacebookWebhookMessageJson {
        const adaptedMessage: FacebookWebhookMessageJson = {
            object: 'whatsapp_business_account',
            entry: [
                {
                    id: whatsappMessage.to, // Use WhatsApp chat ID as the entry ID
                    changes: [
                        {
                            value: {
                                messaging_product: 'whatsapp',
                                metadata: {
                                    display_phone_number: 'YOUR_PHONE_NUMBER',
                                    phone_number_id: 'YOUR_PHONE_NUMBER_ID',
                                },
                                contacts: [
                                    {
                                        profile: {
                                            name: whatsappMessage.author || 'Unknown',
                                        },
                                        wa_id: whatsappMessage.from,
                                    },
                                ],
                                messages: [
                                    {
                                        from: whatsappMessage.from,
                                        id: `wamid.${whatsappMessage.id}`, // Use WhatsApp message ID
                                        timestamp: String(whatsappMessage.timestamp),
                                        text: {
                                            body: whatsappMessage.body,
                                        },
                                        type: whatsappMessage.type,
                                    },
                                ],
                            },
                            field: 'messages',
                        },
                    ],
                },
            ],
        };

        return adaptedMessage;
    }

    // Method to adapt a Facebook Webhook Message to WhatsApp Message
    // adaptFacebookToWhatsApp(facebookWebhookMessage: FacebookWebhookMessageJson): Message {
    //     const messageData = facebookWebhookMessage.entry[0].changes[0].value.messages[0];

    //     const whatsappMessage: Message = C

    //     return whatsappMessage;
    // }
}
