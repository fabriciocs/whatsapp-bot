// {
//     "messaging_product": "whatsapp",
//     "contacts": [
//         {
//             "input": "5564992469064",
//             "wa_id": "556492469064"
//         }
//     ],
//     "messages": [
//         {
//             "id": "wamid.HBgMNTU2NDkyNDY5MDY0FQIAERgSRkM2ODExNTk5MzIwODIyNUMxAA==",
//             "message_status": "accepted"
//         }
//     ]
// }
// create classes that represents the object above
export class Contact {
    input?: string;
    wa_id?: string;
}
export class Message {
    id?: string;
    message_status?: string;
}
export class WhatsappResponse {
    messaging_product?: string;
    contacts?: Contact[];
    messages?: Message[];
}