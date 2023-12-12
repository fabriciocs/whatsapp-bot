"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const msg_1 = require("./msg");
class WhatsappMessageAdapter extends msg_1.MsgAdapter {
    constructor(whatsMsg) {
        super(whatsMsg);
        this.whatsMsg = whatsMsg;
    }
    async reply(content, options) {
        if (this.isAudio) {
            await this.whatsMsg.reply(content);
        }
        else {
            await super.reply(content, options);
        }
        return this;
    }
    async sendMessage(content, options) {
        if (this.isAudio) {
            await this.whatsMsg.reply(content);
        }
        else {
            await super.reply(content, options);
        }
        return this;
    }
}
exports.default = WhatsappMessageAdapter;
//# sourceMappingURL=whatsapp-message-adpater.js.map