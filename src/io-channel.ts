import { Msg } from "./msg/msg";
import { tellMe, tellMeString } from "./textToSpeach";


export type IoChannelOptions = {
    languageCode?: string;
};
//declare sendAnswer paramsType
export type SendAnswerParams = {
    msg: Msg,
    content: string,
    options?: IoChannelOptions,
    onlyText?: boolean
};
export default class IoChannel {
    constructor() {
    }

    async sendAnswer({ msg, content, options = { languageCode: 'pt-BR' }, onlyText = false }: SendAnswerParams) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });

        await msg.sendMessage(answer, options);

    }
    async sendReply({ msg, content, options = { languageCode: 'pt-BR' }, onlyText = false }: SendAnswerParams) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });

        await msg.reply(answer, options);

    }

    private async extractAnswer({ msg, content, options, onlyText = false }: SendAnswerParams) {
        let answer;
        if (!onlyText && msg.isAudio) {
            console.log({ 'isAudio': content });
            answer = await tellMeString(content, options.languageCode);
        } else {
            answer = content;
        }
        return answer;
    }
}