import { Message, MessageMedia } from "whatsapp-web.js";
import { IoChannelOptions } from "../io-channel";
import { Msg, MsgAdapter } from "./msg";
import { readToMe } from "../speech-to-text";
import { tellMeString } from "../textToSpeach";

export default class WhatsappMessageAdapter extends MsgAdapter {
    private whatsMsg: Message;
    constructor(whatsMsg: Message, private _isQuoted = false, private _isReloaded = false) {
        super(whatsMsg as any);
        this.whatsMsg = whatsMsg;

    }

    get isQuoted(): boolean {
        return this._isQuoted || this._isReloaded;
    }



    async reply(content: string, options?: IoChannelOptions): Promise<Msg> {
        if (this.isAudio) {
            let audio = await this.extractAudio(options, content);
            if (Array.isArray(audio)) {
                const first = audio.shift();
                this.whatsMsg.reply(first);
                await Promise.all(audio.map(async a => {
                    const chat = await this.whatsMsg.getChat();
                    await chat.sendMessage(a, { sendAudioAsVoice: true });
                }));
            } else {
                await this.whatsMsg.reply(audio);
            }
        } else {
            await super.reply(content, options);
        }
        return this;
    }
    private async extractAudio(options: IoChannelOptions, content: string): Promise<MessageMedia | MessageMedia[]> {
        let audio = null;
        if (options?.textToSpeech) {
            // split in chunks of 450 characters
            const chunks = content?.match(/.{1,450}/g)?.map(r => r) ?? [];
            return await Promise.all(chunks.map(async chunk => {
                const audioMsg = await tellMeString(chunk, options.languageCode ?? 'pt-BR');
                audio = new MessageMedia('audio/ogg', audioMsg);
                return audio;
            }));
        } else {
            audio = new MessageMedia('audio/ogg', content);
        }
        return audio;
    }

    async sendMessage(content: string, options?: IoChannelOptions): Promise<Msg> {
        const chat = await this.whatsMsg.getChat();
        if (this.isAudio) {
            let audio = await this.extractAudio(options, content);
            if (Array.isArray(audio)) {
                const first = audio.shift();
                await chat.sendMessage(first);
                await Promise.all(audio.map(async a => {
                    await chat.sendMessage(a);
                }));
            } else {
                await chat.sendMessage(audio);
            }
        } else {
            await super.sendMessage(content, options);
        }
        return this;
    }
}