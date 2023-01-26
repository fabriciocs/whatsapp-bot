import { Msg } from "./msg/msg";
import { tellMe } from "./textToSpeach";


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


    async sendAnswer({ msg, content, options = { languageCode: 'pt-br' }, onlyText = true }: SendAnswerParams) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });

        await msg.sendMessage(answer, options);

    }
    async sendReply({ msg, content, options = { languageCode: 'pt-br' }, onlyText = true }: SendAnswerParams) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });

        await msg.reply(answer, options);

    }


    private async extractAnswer({ msg, content, options, onlyText = true }: SendAnswerParams) {
        let answer;
        if (!onlyText && msg.isAudio) {
            answer = await tellMe(content, options);
        } else {
            answer = content;
        }
        return answer;
    }
}