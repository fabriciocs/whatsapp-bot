import { Message, MessageMedia } from "whatsapp-web.js";
import { IoChannelOptions } from "../io-channel";
import { Msg, MsgAdapter } from "./msg";

export default class WhatsappMessageAdapter extends MsgAdapter {
    constructor(private whatsMsg: Message) {
        super(whatsMsg as any);
    }

    async reply(content: string, options?: IoChannelOptions): Promise<Msg> {
        if (this.isAudio) {
            const audio = new MessageMedia('audio/ogg', content);
            await this.whatsMsg.reply(audio);
        } else {
            await super.reply(content, options);
        }
        return this;
    }
    async sendMessage(content: string, options?: IoChannelOptions): Promise<Msg> {
        const chat = await this.whatsMsg.getChat();
        if (this.isAudio) {
            const audio = new MessageMedia('audio/ogg', content);
            await chat.sendMessage(audio);
        } else {
            await super.sendMessage(content, options);
        }
        return this;
    }
}