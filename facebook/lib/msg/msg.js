"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MsgAdapter = exports.Msg = exports.SongTypes = exports.MsgTypes = void 0;
const util_1 = require("../util");
var MsgTypes;
(function (MsgTypes) {
    MsgTypes["TEXT"] = "chat";
    MsgTypes["AUDIO"] = "audio";
    MsgTypes["VOICE"] = "ptt";
    MsgTypes["IMAGE"] = "image";
    MsgTypes["VIDEO"] = "video";
    MsgTypes["DOCUMENT"] = "document";
    MsgTypes["STICKER"] = "sticker";
    MsgTypes["LOCATION"] = "location";
    MsgTypes["CONTACT_CARD"] = "vcard";
    MsgTypes["CONTACT_CARD_MULTI"] = "multi_vcard";
    MsgTypes["REVOKED"] = "revoked";
    MsgTypes["ORDER"] = "order";
    MsgTypes["PRODUCT"] = "product";
    MsgTypes["PAYMENT"] = "payment";
    MsgTypes["UNKNOWN"] = "unknown";
    MsgTypes["GROUP_INVITE"] = "groups_v4_invite";
    MsgTypes["LIST"] = "list";
    MsgTypes["LIST_RESPONSE"] = "list_response";
    MsgTypes["BUTTONS_RESPONSE"] = "buttons_response";
    MsgTypes["BROADCAST_NOTIFICATION"] = "broadcast_notification";
    MsgTypes["CALL_LOG"] = "call_log";
    MsgTypes["CIPHERTEXT"] = "ciphertext";
    MsgTypes["DEBUG"] = "debug";
    MsgTypes["E2E_NOTIFICATION"] = "e2e_notification";
    MsgTypes["GP2"] = "gp2";
    MsgTypes["GROUP_NOTIFICATION"] = "group_notification";
    MsgTypes["HSM"] = "hsm";
    MsgTypes["INTERACTIVE"] = "interactive";
    MsgTypes["NATIVE_FLOW"] = "native_flow";
    MsgTypes["NOTIFICATION"] = "notification";
    MsgTypes["NOTIFICATION_TEMPLATE"] = "notification_template";
    MsgTypes["OVERSIZED"] = "oversized";
    MsgTypes["PROTOCOL"] = "protocol";
    MsgTypes["REACTION"] = "reaction";
    MsgTypes["TEMPLATE_BUTTON_REPLY"] = "template_button_reply";
})(MsgTypes = exports.MsgTypes || (exports.MsgTypes = {}));
;
exports.SongTypes = [
    MsgTypes.AUDIO,
    MsgTypes.VOICE,
];
class Msg {
    constructor(_body, _from, _to, _fromMe, _type) {
        this._body = _body;
        this._from = _from;
        this._to = _to;
        this._fromMe = _fromMe;
        this._type = _type;
    }
    get body() {
        return this._body;
    }
    set body(value) {
        this._body = value;
    }
    get from() {
        return this._from;
    }
    set from(value) {
        this._from = value;
    }
    get to() {
        return this._to;
    }
    set to(value) {
        this._to = value;
    }
    get fromMe() {
        return this._fromMe;
    }
    set fromMe(value) {
        this._fromMe = value;
    }
    get type() {
        return this._type;
    }
    set type(value) {
        this._type = value;
    }
    get isAudio() {
        return exports.SongTypes.includes(this._type);
    }
    get id() {
        const from = this.from;
        const to = this.to;
        const fromId = from === null || from === void 0 ? void 0 : from.split('').map(c => c.charCodeAt(0));
        const toId = to === null || to === void 0 ? void 0 : to.split('').map(c => c.charCodeAt(0));
        const sum = (0, util_1.sumArrayItem)(fromId, toId);
        const checkSum = (0, util_1.sumArrayItem)(toId, fromId);
        const id = sum.join('');
        const checkId = checkSum.join('');
        if (id !== checkId)
            throw new Error('Invalid ID');
        return id;
    }
    get chatId() {
        const from = this.from;
        const to = this.to;
        const fromId = from === null || from === void 0 ? void 0 : from.split('').map(c => c.charCodeAt(0));
        const toId = to === null || to === void 0 ? void 0 : to.split('').map(c => c.charCodeAt(0));
        const sum = (0, util_1.sumArrayItem)(fromId, toId);
        const id = sum.join('');
        return id;
    }
}
exports.Msg = Msg;
;
class MsgAdapter extends Msg {
    async reply(content, options) {
        await this.msg.reply(content);
        return this;
    }
    async sendMessage(content, options) {
        const chat = await this.msg.getChat();
        await chat.sendMessage(content);
        return this;
    }
    constructor(msg) {
        super(msg.body, msg.from, msg.to, msg.fromMe, MsgTypes[msg.type]);
        this.msg = msg;
    }
}
exports.MsgAdapter = MsgAdapter;
//# sourceMappingURL=msg.js.map