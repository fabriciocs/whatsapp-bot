export interface FacebookWebhookMessageJson {
    object: string;
    entry: FacebookWebhookEntry[];
}

interface FacebookWebhookEntry {
    id: string;
    changes: FacebookWebhookChange[];
}

interface FacebookWebhookChange {
    value: FacebookWebhookValue;
    field: string;
}

interface FacebookWebhookValue {
    messaging_product: string;
    metadata: {
        display_phone_number: string;
        phone_number_id: string;
    };
    contacts: FacebookWebhookContact[];
    messages: FacebookWebhookMessage[];
}

interface FacebookWebhookContact {
    profile: {
        name: string;
    };
    wa_id: string;
}

interface FacebookWebhookMessage {
    from: string;
    id: string;
    timestamp: string;
    text: {
        body: string;
    };
    type: string;
}
