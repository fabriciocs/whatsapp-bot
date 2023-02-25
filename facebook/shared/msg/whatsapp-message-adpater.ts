
import { IoChannelOptions } from "../io-channel";
import { Msg, MsgAdapter } from "./msg";

export default class WhatsappMessageAdapter extends MsgAdapter {
    constructor(private whatsMsg: { body: string, from: string, to: string, fromMe: boolean, type: string, reply: (content: string) => Promise<void>, getChat: () => Promise<{ sendMessage: (content: string) => Promise<void> }> }) {
        super(whatsMsg);
    }
    async reply(content: string, options?: IoChannelOptions): Promise<Msg> {
        if (this.isAudio) {
            await this.whatsMsg.reply(content);
        } else {
            await super.reply(content, options);
        }
        return this;
    }
    async sendMessage(content: string, options?: IoChannelOptions): Promise<Msg> {
        if (this.isAudio) {
            await this.whatsMsg.reply(content);
        } else {
            await super.reply(content, options);
        }
        return this;
    }
}