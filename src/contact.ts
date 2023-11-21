import { Message } from "whatsapp-web.js";

const buildContactRelevantInformation = async(msg: Message) =>{ 
    const from = msg.from;
    const contact = await msg.getContact();
}

export {
    buildContactRelevantInformation
}