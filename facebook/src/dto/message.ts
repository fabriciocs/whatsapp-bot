import { Timestamp } from "firebase-admin/firestore";
import PhoneContact from "./phone-contact";
import { WhatsappResponse } from "./whatsapp-response";

export default class Message {
    to?: PhoneContact;
    from?: PhoneContact;
    when?: Timestamp;
    content?: string;
    controlCode?: string;
    response?: WhatsappResponse
}