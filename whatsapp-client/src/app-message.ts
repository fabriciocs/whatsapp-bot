import { Message } from "whatsapp-web.js";
import { FacebookWebhookMessageJson } from "./facebook-message";

export class AppMessage {
    constructor(
        public whatsappMessage: Message,
        public facebookWebhookMessage: FacebookWebhookMessageJson
    ) {}

    // Method to convert the AppMessage to JSON
    toJSON(): object {
        return {
            whatsappMessage: this.whatsappMessage,
            facebookWebhookMessage: this.facebookWebhookMessage,
        };
    }
}
