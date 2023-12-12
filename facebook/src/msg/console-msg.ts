import { IoChannelOptions } from "../io-channel";
import { Msg, MsgTypes } from "./msg";

export default class ConsoleMsg extends Msg {
    constructor(body: string, fromMe = true) {
        super(body, 'user', 'bot', fromMe, MsgTypes.TEXT);
    }
    async reply(content: string, options?: IoChannelOptions): Promise<Msg> {
        console.log(`Replying to ${this.from}: ${content}`);
        return this;
    }
    async sendMessage(content: string, options?: IoChannelOptions): Promise<Msg> {
        console.log(`Sending to ${this.from}: ${content}`);
        return this;
    }
}