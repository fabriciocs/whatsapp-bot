import { IoChannelOptions } from "../io-channel";
import { sumArrayItem } from "../util";

export enum MsgTypes {
    TEXT = 'chat',
    AUDIO = 'audio',
    VOICE = 'ptt',
    IMAGE = 'image',
    VIDEO = 'video',
    DOCUMENT = 'document',
    STICKER = 'sticker',
    LOCATION = 'location',
    CONTACT_CARD = 'vcard',
    CONTACT_CARD_MULTI = 'multi_vcard',
    REVOKED = 'revoked',
    ORDER = 'order',
    PRODUCT = 'product',
    PAYMENT = 'payment',
    UNKNOWN = 'unknown',
    GROUP_INVITE = 'groups_v4_invite',
    LIST = 'list',
    LIST_RESPONSE = 'list_response',
    BUTTONS_RESPONSE = 'buttons_response',
    BROADCAST_NOTIFICATION = 'broadcast_notification',
    CALL_LOG = 'call_log',
    CIPHERTEXT = 'ciphertext',
    DEBUG = 'debug',
    E2E_NOTIFICATION = 'e2e_notification',
    GP2 = 'gp2',
    GROUP_NOTIFICATION = 'group_notification',
    HSM = 'hsm',
    INTERACTIVE = 'interactive',
    NATIVE_FLOW = 'native_flow',
    NOTIFICATION = 'notification',
    NOTIFICATION_TEMPLATE = 'notification_template',
    OVERSIZED = 'oversized',
    PROTOCOL = 'protocol',
    REACTION = 'reaction',
    TEMPLATE_BUTTON_REPLY = 'template_button_reply',
};

export const SongTypes = [
    MsgTypes.AUDIO,
    MsgTypes.VOICE,
];


export abstract class Msg {

    constructor(
        private _body: string,
        private _from: string,
        private _to: string,
        private _fromMe: boolean,
        private _type: MsgTypes,
    ) { }



    get body(): string {
        return this._body;
    }
    set body(value: string) {
        this._body = value;
    }
    get from(): string {
        return this._from;
    }
    set from(value: string) {
        this._from = value;
    }
    get to(): string {
        return this._to;
    }
    set to(value: string) {
        this._to = value;
    }
    get fromMe(): boolean {
        return this._fromMe;
    }
    set fromMe(value: boolean) {
        this._fromMe = value;
    }
    get type(): MsgTypes {
        return this._type;
    }
    set type(value: MsgTypes) {
        this._type = value;
    }
    get isAudio(): boolean {
        return SongTypes.includes(this._type);
    }



    get id(): string {
        const from = this.from;
        const to = this.to;

        const fromId = from?.split('').map(c => c.charCodeAt(0));
        const toId = to?.split('').map(c => c.charCodeAt(0));

        const sum = sumArrayItem(fromId, toId);
        const checkSum = sumArrayItem(toId, fromId);

        const id = sum.join('');
        const checkId = checkSum.join('');
        if (id !== checkId) throw new Error('Invalid ID');
        return id;
    }


    get chatId(): string {
        const from = this.from;
        const to = this.to;
        const fromId = from?.split('').map(c => c.charCodeAt(0));
        const toId = to?.split('').map(c => c.charCodeAt(0));
        const sum = sumArrayItem(fromId, toId);
        const id = sum.join('');
        return id;
    }

    abstract reply(content: string, options?: IoChannelOptions): Promise<Msg>;
    abstract sendMessage(content: string, options?: IoChannelOptions): Promise<Msg>;
    getMsg(): any {
        return this;
    }



};


export class MsgAdapter extends Msg {
    async reply(content: string, options?: IoChannelOptions): Promise<Msg> {
        await this.msg.reply(content);
        return this;
    }
    async sendMessage(content: string, options?: IoChannelOptions): Promise<Msg> {
        const chat = await this.msg.getChat();
        await chat.sendMessage(content);
        //obtenha o msgType do valor 'chat'

        return this;
    }
    constructor(private msg: { body: string, from: string, to: string, fromMe: boolean, type: string, reply: (content: string) => Promise<void>, getChat: () => Promise<{ sendMessage: (content: string) => Promise<void> }> }) {
        super(msg.body, msg.from, msg.to, msg.fromMe, MsgTypes[Object.keys(MsgTypes).find(key => MsgTypes[key] === msg.type) as any]);
    }
    getMsg() {
        return this.msg;
    }
}