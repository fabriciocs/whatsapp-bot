import { Msg } from "./msg/msg";
import { tellMe, tellMeString } from "./textToSpeach";


export type IoChannelOptions = {
    languageCode?: string;
    textToSpeech?: boolean;

};
//declare sendAnswer paramsType
export type SendAnswerParams = {
    msg: Msg,
    content: string,
    options?: IoChannelOptions,
    onlyText?: boolean
};
export default class IoChannel {
    private extractString = async (msg: Msg, content: string, language: string): Promise<string> => {
        return await tellMeString(content, language);
    }
    constructor() {
    }
    set audioExtractor(extractString: (msg: Msg, content: string, language: string) => Promise<string>) {
        this.extractString = extractString;
    }

    async sendAnswer({ msg, content, options = { languageCode: 'pt-BR' }, onlyText = false }: SendAnswerParams) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });

        await msg.sendMessage(answer, options);

    }
    async sendReply({ msg, content, options = { languageCode: 'pt-BR', textToSpeech: true }, onlyText = false }: SendAnswerParams) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });

        await msg.reply(answer, options);

    }

    private async extractAnswer({ msg, content, options, onlyText = false }: SendAnswerParams) {
        let answer;
        if (!onlyText && msg.isAudio && this.extractString) {
            console.log({ 'isAudio': content });
            answer = this.extractString(msg, content, options?.languageCode)
        } else {
            answer = content;
        }
        return answer;
    }
}