"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const msg_1 = require("./msg");
class ConsoleMsg extends msg_1.Msg {
    constructor(body, fromMe = true) {
        super(body, 'user', 'bot', fromMe, msg_1.MsgTypes.TEXT);
    }
    async reply(content, options) {
        console.log(`Replying to ${this.from}: ${content}`);
        return this;
    }
    async sendMessage(content, options) {
        console.log(`Sending to ${this.from}: ${content}`);
        return this;
    }
}
exports.default = ConsoleMsg;
//# sourceMappingURL=console-msg.js.map