import { Message, MessageMedia, MessageTypes } from "whatsapp-web.js";
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

// class MessageUtility {
//   static async hasQuotedMessage(message: Message): Promise<boolean> {
//     return message.hasQuotedMsg;
//   }

//   static async getQuotedMessage(message: Message): Promise<Message | null> {
//     if (message.hasQuotedMsg) {
//       // Assuming the quoted message is in the same chat
//       return await message.getQuotedMessage();
//     }
//     return null;
//   }

//   static async hasMedia(message: Message): Promise<boolean> {
//     return message.hasMedia;
//   }

//   static async getMediaType(message: Message): Promise<string | null> {
//     if (message.hasMedia) {
//       return message.type;
//     }
//     return null;
//   }

//   static async getTextFromAudio(message: Message): Promise<string | null> {
//     if (message.hasMedia && message.type === 'audio') {
//       // You may need to implement the integration with Google Speech-to-Text here
//       // Replace the following line with the actual implementation
//       return await this.googleSpeechToText(message.mediaKey || '');
//     }
//     return null;
//   }

//   static async getContactDetails(message: Message): Promise<string | null> {
//     if (message.type === MessageTypes.con) {
//       const contact = await message.getContact();
//       // Assuming you want to display the pushname of the contact
//       return `Contact: ${contact.pushname}`;
//     }
//     return null;
//   }

//   static async getLocationAddress(message: Message): Promise<string | null> {
//     if (message.type === 'location') {
//       const location = message.location;
//       // You may need to implement the reverse geocoding logic here
//       // Replace the following line with the actual implementation
//       return await this.reverseGeocode(location.latitude, location.longitude);
//     }
//     return null;
//   }

//   static async getChatIdSerialized(message: Message): Promise<string> {
//     return message.to;
//   }

//   static async getSenderData(message: Message): Promise<string | null> {
//     const contact = await message.getContact();
//     return `Sender: ${contact.pushname} (${contact.number})`;
//   }

//   // Placeholder method for Google Speech-to-Text integration
//   private static async googleSpeechToText(mediaKey: string): Promise<string> {
//     // Implement the actual integration logic with Google Speech-to-Text
//     // This is just a placeholder
//     return 'Text from audio';
//   }

//   // Placeholder method for reverse geocoding
//   private static async reverseGeocode(latitude: string, longitude: string): Promise<string> {
//     // Implement the actual reverse geocoding logic
//     // This is just a placeholder
//     return `Address for (${latitude}, ${longitude})`;
//   }
// }

// // Example usage:
// const sampleMessage: Message = /* ... */;
// if (await MessageUtility.hasQuotedMessage(sampleMessage)) {
//   const quotedMessage = await MessageUtility.getQuotedMessage(sampleMessage);
//   console.log('Quoted Message:', quotedMessage);
// }

// if (await MessageUtility.hasMedia(sampleMessage)) {
//   const mediaType = await MessageUtility.getMediaType(sampleMessage);
//   console.log('Media Type:', mediaType);
// }
