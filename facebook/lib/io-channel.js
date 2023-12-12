"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const textToSpeach_1 = require("./textToSpeach");
class IoChannel {
    constructor() {
    }
    async sendAnswer({ msg, content, options = { languageCode: 'pt-BR' }, onlyText = false }) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });
        await msg.sendMessage(answer, options);
    }
    async sendReply({ msg, content = '', options = { languageCode: 'pt-BR' }, onlyText = false }) {
        let answer = await this.extractAnswer({ onlyText, msg, content, options });
        await msg.reply(answer, options);
    }
    async extractAnswer({ msg, content, options, onlyText = false }) {
        let answer;
        if (!onlyText && msg.isAudio) {
            answer = await (0, textToSpeach_1.tellMe)(content, options === null || options === void 0 ? void 0 : options.languageCode);
        }
        else {
            answer = content;
        }
        return answer;
    }
}
exports.default = IoChannel;
//# sourceMappingURL=io-channel.js.map