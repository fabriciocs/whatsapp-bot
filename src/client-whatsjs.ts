import * as vm from 'vm';
import { resolve } from 'path';

import * as QRCode from 'qrcode';
import WAWebJS, { Client, LocalAuth, Message, MessageMedia, Buttons, GroupChat } from 'whatsapp-web.js';


import { Msg, MsgAdapter } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { readToMe } from './speech-to-text';
import fs from 'fs';
import { AppData, AppDataUtils } from './app-data';
import { giveMeImage, simpleChat } from './ai';
import { keyReplacer, normalizeFilepath, toDataUrl } from './util';
import { readDocument, whatIsIt } from './vision';
import * as child_process from 'child_process';
import {
    AudioTranscriptLoader,
    // AudioTranscriptParagraphsLoader,
    // AudioTranscriptSentencesLoader
} from "langchain/document_loaders/web/assemblyai";
import EmojiManager from './emoji';
import { tellMe, tellMeString } from './textToSpeach';
const addManagerToGroup = async (msg: WhatsappMessageAdapter, params: string[] = []) => {
    const chat = await msg.getMsg<Message>().getChat();
    if (!chat.isGroup) return;
    const groupsJson = await fs.promises.readFile(resolve('./groups.json'), { encoding: 'utf8', flag: 'r' });
    const groups = JSON.parse(groupsJson);
    const group = groups[chat.id._serialized];
    if (!group) {
        groups[chat.id._serialized] = { chat: JSON.parse(JSON.stringify(chat)) };
        // update groups.json
        await fs.promises.writeFile(resolve('./groups.json'), JSON.stringify(groups, null, 2), { encoding: 'utf8', flag: 'w' });
    }
};



const load_audio = async (msg: WhatsappMessageAdapter) => {
    const folderPath = '../read';
    const folderExists = fs.existsSync(resolve(folderPath));
    if (!folderExists) {
        await fs.promises.mkdir(folderPath, { recursive: true });
    }
    const path = await backupMsg(folderPath, msg.getMsg() as unknown as Message);
    if (!path) {
        return;
    }
    console.log({
        path,
        apiKey: process.env.ASSEMBLYAI_API_KEY
    })
    const loader = new AudioTranscriptLoader(
        {
            audio_url: path,
            format_text: true,
            language_code: "pt"
        },
        {
            apiKey: process.env.ASSEMBLYAI_API_KEY
        }
    );
    const docs = await loader.load();
    if (!docs?.length) {
        console.log('no docs', docs.length);
        return;
    }
    return docs.map(t => t.pageContent).join()
}


const backupMsg = async (folderPath: string, bkpMsg: Message, skipIfExists = true, fileId = "") => {
    try {
        let baseName = normalizeFilepath(`${bkpMsg.timestamp}-${bkpMsg.type}-${bkpMsg.body?.substring(0, 50)}`);
        if (baseName?.endsWith('-')) {
            baseName = baseName.substring(0, baseName.length - 1);
        }
        const jsonFile = `${baseName}${fileId}.json`;

        const filenameJson = resolve(folderPath, jsonFile);
        try {
            const fileExists = fs.existsSync(filenameJson)
            if (skipIfExists && fileExists) {
                return;
            }
            await fs.promises.writeFile(filenameJson, JSON.stringify(bkpMsg));
            console.log({ msg: filenameJson });
        } catch (e) {
            console.error(e);
        }

        if (bkpMsg.hasMedia) {
            let media = await bkpMsg.downloadMedia();
            if (!media) {
                try {
                    const reloaded = await bkpMsg.reload();
                    if (!reloaded) {
                        return;
                    }
                    media = await reloaded.downloadMedia();
                    if (!media) {
                        return;
                    }

                } catch (e) {
                    console.error(e);
                    return;
                }
            }
            const dataFilename = media.filename ? `${media.filename}` : `${media.mimetype?.split('/')[1]?.split(';')[0]}`;
            const filename = `${baseName}.${dataFilename}`;
            const filenameMedia = resolve(folderPath, filename);
            await fs.promises.writeFile(filenameMedia, Buffer.from(media.data, 'base64'));
            return filenameMedia;

        }
    } catch (e) {
        try {
            const baseName = normalizeFilepath(`${bkpMsg.timestamp}-${bkpMsg.type}-${bkpMsg.body?.substring(0, 50)}`);
            const jsonFile = `${baseName}-error.json`;
            const filenameJson = resolve(folderPath, jsonFile);
            await fs.promises.writeFile(filenameJson, JSON.stringify(e));
        } finally {
            console.error(e);
        }
        return;
    }
}

export const initWhatsappClient = async (appData: AppData) => {
    appData.isAlivio = async (msg: Msg) => {
        if (msg.fromMe) return false;
        const chat = await msg.getMsg().getChat();
        return !!conversations[chat.id._serialized]
    }
    const queroMais = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const quoted = await whatsMsg.getQuotedMessage();
        const adaptedMessage = new WhatsappMessageAdapter(quoted);
        if (quoted.hasMedia) {
            const media = await quoted.downloadMedia();
            console.log({ media });
            await chat.sendMessage(media);
        }
    };




    const desenha = async (msg: WhatsappMessageAdapter, prompt: string[]) => {

        const instruction = prompt?.join(' ')
        const url = await giveMeImage(instruction, '512x512');
        if (url) {
            const whatsMsg = msg.getMsg() as unknown as Message;
            const chat = await whatsMsg.getChat();
            const media = await MessageMedia.fromUrl(url);
            await whatsMsg.reply(media, chat.id._serialized);
        } else {
            await msg.reply('Não consegui criar a imagem');
        }

    }
    const desenhaX = async (msg: WhatsappMessageAdapter, prompt: string[]) => {
        let text = "";
        if (!prompt?.length) {
            text = await asText(await getMsgOrQuoted(msg));
        } else {
            text = prompt?.join(' ');
        }
        if (!text) {
            await msg.reply('Não consegui criar a imagem');
        }
        return await desenha(msg, [...prompt, text])
    }
    const backupChat = async (folderName: string, chat: WAWebJS.Chat, skipIfExists = true, folderId = "") => {
        try {

            const contact = await chat.getContact();
            const contactName = contact.pushname ?? contact.name ?? contact.id.user;
            const contactNumber = (await contact.getFormattedNumber()).replace(/\D/g, '');
            const folderPath = resolve(folderName, normalizeFilepath(`${chat.name}-${contactNumber}-${contactName}${folderId}`))
            const folderExists = fs.existsSync(folderPath)
            if (skipIfExists && folderExists) {
                return folderPath;
            }
            if (!folderExists) {
                await fs.promises.mkdir(folderPath, { recursive: true });
                const contactFileName = resolve(folderPath, 'contact.json');
                await fs.promises.writeFile(contactFileName, JSON.stringify(contact));
            }
            const previous = await chat.fetchMessages({ limit: Infinity });
            console.log({ chat: `${previous?.length}-${folderPath}` });

            if (previous?.length > 0) {
                await Promise.all(await previous.map(async (m) => {
                    await backupMsg(folderPath, m);
                    await backupMsg(folderPath, await appData.client.getMessageById(m.id._serialized), skipIfExists, '-byid');
                }));
            }

            return folderPath;
        } catch (error) {
            // An error occurred while writing the file
            console.error(error);
        }
    }
    const backupAll = async () => {
        const contacts = await appData.client.getContacts();
        const chats = await Promise.all(await contacts.map(async (contact) => {
            return await contact.getChat();
        }));
        const folderName = `/home/fabricio/whatsbkp/${normalizeFilepath(new Date().toISOString())}/`;
        await Promise.all(await chats.map(async (chat) => {
            await backupChat(folderName, chat, false);
            await backupChat(folderName, await appData.client.getChatById(chat.id._serialized), false, '-byid');
        }));
    }
    appData.ioChannel.audioExtractor = null;
    const asMultiText = async (msg: WhatsappMessageAdapter, limit = 1) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const msgs = await chat.fetchMessages({ limit: limit });
        const contact = (await chat.getContact());
        const heading = `${chat.isGroup ? `at group: ${chat.name}` : `chat with: ${contact.pushname ?? contact.name ?? contact.shortName}`}\n`;
        const getAuthorLabel = async (k: Message) => {
            const ctt = await k.getContact();
            return `${k.fromMe ? 'Fabrício Santos' : ctt.pushname ?? ctt.name ?? ctt.shortName}`;
        }
        let text = await asText(msg);
        const msgAuth = await getAuthorLabel(whatsMsg);
        if (msgs.length > 0) {

            const authorWithText = await Promise.all(await msgs.map(async m => ({ timestamp: m.timestamp, author: await getAuthorLabel(m), text: await asText(new WhatsappMessageAdapter(m)) })));
            const texts = authorWithText?.filter(t => !!t?.text)?.sort((k, j) => k.timestamp - k.timestamp).map(k => `${k.author}: ${k.text}`);
            return [heading].concat(...texts).join('\n');
        }
        return text;
    }
    const asText = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const msgBody = whatsMsg.body;

        if (whatsMsg.hasMedia) {
            if (msg.isAudio) {

                const text = await load_audio(msg);
                if (!text) {
                    return;
                }
                return text;

            } else if (msg.isDocument) {
                const media = await whatsMsg.downloadMedia();
                const [labelResponse] = await whatIsIt(Buffer.from(media.data, 'base64'));
                const [contentResponse] = await readDocument(Buffer.from(media.data, 'base64'));
                const labels = labelResponse.labelAnnotations?.map((label) => label.description).join(',');
                const content = contentResponse.fullTextAnnotation?.text;
                const data = [`Annotations:[${labels}]`, `OCR:"${content}`]
                if (msgBody) {
                    data.push(`Msg:"${msgBody}"`);
                }
                return data.join('\n');
            }
        } else {
            return msgBody;
        }
    };
    const create_answer = async (received: WhatsappMessageAdapter, params: string[] = []) => {
        const prompt = "Fabrício Santos é CTO experiente na 4CODE Software House com mais de 12 anos de experiência em engenharia de software. Apaixonado por padrões de design, código de qualidade e trabalho em equipe. Habilidoso em .Net Core, Angular e Azure. Engajado na comunidade e focado na família. Pai, marido e irmão. Experiência em desenvolvimento sênior e liderança técnica. Gentil, prestativo e atencioso.\n";
        const msg = await getMsgOrQuoted(received);
        let text = await asText(msg);
        let instructions = "";
        if (received.getMsg<Message>().hasQuotedMsg) {
            if (params?.length > 0) {
                instructions = `Conforme as instruções que Fabricio Santos informou: '''${params.join(' ')}'''. \n`;
            }
        }
        if (text) {
            text = `Analise o texto a seguir, atue como Fabricio Santos em um chat do whatsapp e responda:'''${text}'''`
        } else {
            text = 'siga as instruções e responda'
        }
        return await chatResponse(prompt, instructions, text);

    };

    const conversations: Record<string, any[]> = {};
    const create_direct_answer = async (received: WhatsappMessageAdapter, params: string[] = []) => {
        const prompt = "Você é AlivioGPT, um especialista em apoio a superação de crises de ansiedade.\n";
        const msg = await getMsgOrQuoted(received);
        const chat = await received.getMsg<Message>().getChat();
        // if not exists conversations for this chat.id._serialized create one

        let text = await asText(msg);
        let instructions = "";
        if (received.getMsg<Message>().hasQuotedMsg) {
            if (params?.length > 0) {
                instructions = `Conforme as instruções informadas: '''${params.join(' ')}'''. \n`;
            }
        }
        if (!conversations[chat.id._serialized]) {
            conversations[chat.id._serialized] = [];
            if (text) {

                text = `Analise o texto a seguir, atue como AlivioGPT em um chat do whatsapp e responda suscintamente:'''${text}'''`
            } else {
                text = 'siga as instruções e responda suscintamente'
            }
        }
        return await chatResponse(prompt, instructions, text, conversations[chat.id._serialized]);

    };
    const create_answer_to_chat_text = async (text: string) => {
        const prompt = "Fabrício Santos é CTO experiente na 4CODE Software House com mais de 12 anos de experiência em engenharia de software. Apaixonado por padrões de design, código de qualidade e trabalho em equipe. Habilidoso em .Net Core, Angular e Azure. Engajado na comunidade e focado na família. Pai, marido e irmão. Experiência em desenvolvimento sênior e liderança técnica. Gentil, prestativo e atencioso.\n";


        let task = `${prompt}Analise o chat a seguir, atue como Fabricio Santos e gentilmente escreva uma resposta que será narrada utilizando marcação SSML:\n'''${text}'''\n`;

        const resp = await simpleChat(task);
        console.log({ task, resp })
        return resp;

    };
    const create_answer_to_text = async (text) => {
        const prompt = "Fabrício Santos é CTO experiente na 4CODE Software House com mais de 12 anos de experiência em engenharia de software. Apaixonado por padrões de design, código de qualidade e trabalho em equipe. Habilidoso em .Net Core, Angular e Azure. Engajado na comunidade e focado na família. Pai, marido e irmão. Experiência em desenvolvimento sênior e liderança técnica. Gentil, prestativo e atencioso.\n";
        const task = `${prompt}Analise o texto a seguir , atue como Fabricio Santos em um chat do whatsapp e responda:\n'''${text}'''`
        const resp = await simpleChat(task);
        console.log({ task, resp })
        return resp;

    };
    const getMsgOrQuoted = async (msg: WhatsappMessageAdapter) => {

        const whatsMsg = msg.getMsg() as unknown as Message;
        const quoted = await whatsMsg.getQuotedMessage();
        const reloaded = quoted ? await quoted.reload() : null;
        if (reloaded) {
            return new WhatsappMessageAdapter(reloaded, false, true);
        }
        if (quoted) {
            return new WhatsappMessageAdapter(quoted, true, false);
        }
        return msg;
    }

    const getText = async (msg: WhatsappMessageAdapter, params: string[] = []) => {

        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const quoted = await whatsMsg.getQuotedMessage();
        const reloaded = quoted ? await quoted.reload() : null;
        let text = "";
        if (quoted) {
            text = await asText(new WhatsappMessageAdapter(reloaded ?? quoted));
        } else {
            if (!whatsMsg.hasMedia) {
                text = params?.join(' ')
            } else {
                text = await asText(msg);
            }
        }

        return text;

    };

    const transcreve = async (msg: WhatsappMessageAdapter) => {

        let text = await asText(await getMsgOrQuoted(msg));
        if (!text) {
            text = "**Não consegui transcrever**"
        }
        await msg.getMsg<Message>().reply(text);
    };


    const answer_text = async (msg: WhatsappMessageAdapter, params: string[] = []) => {
        let count = +(params?.shift?.() ?? 1);
        if (isNaN(count)) count = 1;
        const loaded = await getMsgOrQuoted(msg);
        let previousText = loaded.isQuoted ? await asText(loaded) : params?.join?.(' ')?.trim();
        previousText += await asText(msg);

        for (let i = 0; i < count; i++) {
            const text = await create_answer_to_text(previousText);
            if (text) {
                await msg.getMsg<Message>().reply(text);
            } else {
                console.log({ previousText, text })
            }
            previousText = text;
        }

    };


    const answer_multi_text = async (msg: WhatsappMessageAdapter, fromMe, limit) => {

        const text = await asMultiText(msg, limit);
        if (text) {
            const resp = await create_answer_to_chat_text(text)
            await msg.getMsg<Message>().reply(resp);
        } else {
            await msg.reply('Não consegui responder');
        }
    };

    const answer_direct_text = async (msg: WhatsappMessageAdapter, params) => {

        const resp = await create_direct_answer(msg, params)
        await msg.getMsg<Message>().reply(resp);
    };

    const textToMsgMedia = async (textToAudio: string, filename: string) => {
        const filenameMedia = resolve('textaudio', filename);
        const base64 = await tellMe(`<speak>\n${textToAudio}\n</speak>`);
        await fs.promises.writeFile(filenameMedia, base64);
        return await MessageMedia.fromFilePath(filenameMedia);
    }

    const answer_multi_audio = async (msg: WhatsappMessageAdapter, params: string[]) => {
        const wmsg = msg.getMsg<Message>();
        const text = await asMultiText(msg, Infinity);
        if (text) {
            let resp = await create_answer_to_chat_text(text)
            if (resp.startsWith('Fabrício Santos: ')) {
                resp = resp.replace(/^Fabrício Santos: /, '');
            }
            const msgMedia = await textToMsgMedia(resp, `${wmsg.id._serialized}.ogg`);
            await wmsg.reply(msgMedia);
        } else {
            await msg.reply('Não consegui responder');
        }
    };



    const answer_audio = async (msg: WhatsappMessageAdapter, params: string[] = []) => {
        const wmsg = msg.getMsg<Message>();
        const text = await create_direct_answer(msg, params);
        if (text) {
            const msgMedia = await textToMsgMedia(text, `${wmsg.id._serialized}.ogg`);
            await wmsg.reply(msgMedia);
        } else {
            await msg.reply('Não consegui responder');
        }
    };



    const allmsg = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const msgs = await chat.fetchMessages({ limit: 100 });
        const all = msgs.map((msg) => `${msg.from}-${msg.body}`).join('\n');
        await fs.promises.writeFile(resolve(`./messages/${keyReplacer(chat.id._serialized)}.txt`), all, { encoding: 'utf8', flag: 'w' });
        await fs.promises.writeFile(resolve(`./messages/${keyReplacer(chat.id._serialized)}.json`), JSON.stringify(msgs), { encoding: 'utf8', flag: 'w' });
        await appData.ioChannel.sendReply({ msg, content: 'feito' });
    }
    const info = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const loaded = await getMsgOrQuoted(msg);
        if (loaded.isQuoted) {
            const chat = await loaded.getMsg<Message>().getChat();
            await fs.promises.writeFile(resolve(`../messages/${keyReplacer(chat.id._serialized)}.txt`), getJsonBuffer({ loaded, chat }), { encoding: 'utf8', flag: 'w' });
        } else {
            const chat = await whatsMsg.getChat();
            await fs.promises.writeFile(resolve(`../messages/${keyReplacer(chat.id._serialized)}.txt`), getJsonBuffer({ whatsMsg, chat }), { encoding: 'utf8', flag: 'w' });
        }
        await whatsMsg.delete(true);
    }
    const groups = async (msg: WhatsappMessageAdapter, params: string[]) => {
        const m = await msg.getMsg<Message>();
        const chat = await m.getChat() as GroupChat;
        await chat.sendMessage(JSON.stringify(chat.id, null, 2));
    }
    const send_button = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as Message;
        const chat = await whatsMsg.getChat();
        console.log("send button")
        let button = new Buttons('Button body', [{ body: 'bt1' }]);
        await chat.sendMessage(button);

    };

    const botIndirect = async (msg: Message, params: string[] = []) => {
        // const [contactNumber] = params;
        // const numberId = await appData.client.getNumberId(contactNumber);
        // const contact = await appData.client.getContactById(numberId._serialized);
        // const chat = await contact.getChat();
        // const text = await asMultiText(new WhatsappMessageAdapter(chat.lastMessage), Infinity);
        // let resp = "";
        // if (text) {
        //     resp = await create_answer_to_chat_text(text)
        // }
        // if (!resp) {
        //     resp = await asText(new WhatsappMessageAdapter(chat.lastMessage));
        // }
        // if (!resp) {
        //     resp = "Não consegui responder"
        // }
        if (msg.hasQuotedMsg) {
            return await backupMsg('/home/fabricio/whatsbkp/', await msg.getQuotedMessage());
        }
        return await msg.reply('Não consegui responder');

    }

    const getJsonDocument = async (msg: WhatsappMessageAdapter, obj: any) => {
        const url = toDataUrl('application/json', Buffer.from(JSON.stringify(obj, null, 2), 'utf8'));
        const m = await MessageMedia.fromUrl(url, {
            client: appData.client,
            filename: (new Date()).toISOString() + '.json',
            unsafeMime: true
        });
        return m;
    }

    const getJsonBuffer = (obj: any) => {
        return Buffer.from(JSON.stringify(obj, null, 2), 'utf8');
    }
    const runCode = async (msg: WhatsappMessageAdapter, params: string[]) => {
        try {

            child_process.exec(params.join(' '), async (error, stdout, stderr) => {
                if (error) {
                    console.error(error);
                }
                console.log(stdout);
                await msg.getMsg<Message>().reply(await getJsonDocument(msg, { stdout, stderr }));

            });
        } catch (error) {
            console.error({ error });
            await msg.getMsg<Message>().reply(await getJsonDocument(msg, { error }));
        }

    }

    const dataToHtml = async () => {
        const textData = `
        <html><body>
            <script>
                alert(JSON.stringify(window.localStorage))
            </script>
        </body></html>
        `;
        console.log('html', { url: toDataUrl('text/html', Buffer.from(textData)) });
    }
    const runFunction = async (msg: WhatsappMessageAdapter, params: string[]) => {
        try {
            const context = {
                appData,
                msg,
                params
            }
            vm.createContext(context);
            vm.runInContext(params.join(' '), context);
        } catch (error) {
            console.error({ error });
            await msg.getMsg<Message>().reply(await getJsonDocument(msg, { error }));
        }

    }
    // const carineMarcio = async (msg: WhatsappMessageAdapter) => {

    //     const marcioBot = '554688108422@c.us';
    //     const marcioContact = await appData.client.getContactById(marcioBot);
    //     const carineBot = '554691114746@c.us';
    //     const carineContact = await appData.client.getContactById(marcioBot);
    //     const bots = [marcioBot, carineBot];
    //     const from = msg.from;
    //     if(bots.includes(from))
    //         const to = bots.filter(b => b !== from)[0];
    //         const whatsMsg = msg.getMsg() as unknown as Message;
    //         appData.client.sendMessage(to, whatsMsg);
    //         whatsMsg.forward(to);

    //     if (from)
    // };
    appData.actions['delicia'] = queroMais;
    appData.actions['normal'] = queroMais;
    appData.actions['.r'] = botIndirect;
    appData.actions['.g'] = groups;
    appData.actions['.code'] = runCode;
    appData.actions['.func'] = runFunction;
    appData.actions['.html'] = dataToHtml;
    AppDataUtils.bindAction(appData, 'desenha', desenhaX, '🖌️');
    AppDataUtils.bindAction(appData, 'transcreve', transcreve, '🎤');
    AppDataUtils.bindAction(appData, '.fala', answer_multi_audio, '🗣️');
    AppDataUtils.bindAction(appData, '.', answer_text, '📝', '👍', '👌');
    AppDataUtils.bindAction(appData, '.alivio', answer_direct_text, '🕊️');
    AppDataUtils.bindAction(appData, '.+', answer_multi_text, "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "🔢");
    AppDataUtils.bindAction(appData, 'info', info, '🤔');
    AppDataUtils.bindAction(appData, '$', addManagerToGroup, '👨‍💼', '👩‍💼');
    appData.actions['button'] = send_button;
    appData.actions['.*'] = allmsg;
    appData.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: false }
    })
        .on('authenticated', () => {
            console.log('AUTHENTICATED');
        })
        .on('auth_failure', msg => {
            console.error('AUTHENTICATION FAILURE', msg);
        })
        .on('ready', () => {
            console.log('READY');
        })
        .on('disconnected', (reason) => {
            console.log('Client was logged out', reason);
        })
        .on('qr', (qr) => {
            QRCode.toString(qr, { type: 'terminal', small: true }, function (err: any, url: any) {
                console.log('\n\n\n');
                console.log(url);
                console.log('\n\n\n');
            });
        })
        // .on('message_reaction', async (reaction) => {
        //     console.log(JSON.stringify(reaction, null, 2))
        //     if (!reaction.reaction) return;
        //     if (reaction.id.fromMe) {
        //         const msgId = reaction.msgId;
        //         let msg = null;
        //         try {
        //             msg = await appData.client.getMessageById(msgId._serialized);
        //         } catch(e) {
        //             console.error(e);
        //         }
        //         if(!msg){
        //             console.log('no msg', {msgId, msg});
        //             return;
        //         }

        //         const emoji = reaction.reaction;
        //         const labels = EmojiManager.emojiLabels[emoji];
        //         const abeKeys = Object.keys(appData.actionsByEmoji);
        //         if (!abeKeys?.length) {
        //             console.log('no actions by emoji', { emoji, labels, abeKeys });
        //             return;
        //         };

        //         const action = abeKeys.find((act) => appData.actionsByEmoji[act]?.includes?.(emoji)) ?? '';
        //         if (!action) {
        //             console.log('no action', { emoji, labels, abeKeys, action });
        //             return;
        //         };
        //         const command = appData.actions[action];
        //         if (!command) {
        //             console.log('no command', { emoji, labels, abeKeys, action, command });
        //             return;
        //         };
        //         let limit = 1;
        //         if (action.includes('+')) {
        //             if (labels[0] === '1234') {
        //                 limit = Infinity;
        //             } else {
        //                 limit = +labels[0]
        //             }
        //         }
        //         console.log({ emoji, labels, abeKeys, action, command, limit });
        //         await command(new WhatsappMessageAdapter(msg), false, limit);
        //     }
        // })
        .on('message_create', async (receivedMsg) => {

            try {

                const adaptedMessage = new WhatsappMessageAdapter(receivedMsg);
                // if conversations is defined for this chat.id._serialized call create_direct_answer

                // if (receivedMsg.fromMe) {
                //     const folderName = `/home/fabricio/whatsbkp/`
                //     // const folderPath = await backupChat(folderName, await receivedMsg.getChat());
                //     await backupMsg(resolve(folderName), receivedMsg);
                // }
                try {
                    await appData.processMessage(adaptedMessage);
                } catch (e) {
                    console.error(e);
                }
            } catch (e) {
                console.error(e);
            }



        });
    // .on('group_join', async (message) => await saveMsg(message, 'group_join'))
    // .on('group_admin_changed', async (message) => await saveMsg(message, 'group_admin_changed'))
    // .on('group_leave', async (message) => await saveMsg(message, 'group_leave'))
    // .on('contact_changed', async (message) => await saveMsg(message, 'contact_changed'))
    // .on('chat_archived', async (message) => await saveMsg(message, 'chat_archived'))
    // .on('chat_removed', async (message) => await saveMsg(message, 'chat_removed'))
    // .on('group_membership_request', async (message) => await saveMsg(message, 'group_membership_request'))
    // .on('group_update', async (message) => await saveMsg(message, 'group_update'))
    // .on('media_uploaded', async (message) => await saveMsg(message, 'media_uploaded'))
    // .on('message', async (message) => await saveMsg(message, 'message'))
    // .on('message_ack', async (message) => await saveMsg(message, 'message_ack'))
    // .on('message_create', async (message) => await saveMsg(message, 'message_create'))
    // .on('message_edit', async (message) => await saveMsg(message, 'message_edit'))
    // .on('message_reaction', async (message) => await saveMsg(message, 'message_reaction'))
    // .on('message_revoke_everyone', async (message) => await saveMsg(message, 'message_revoke_everyone'))
    // .on('message_revoke_me', async (message) => await saveMsg(message, 'message_revoke_me'))
    // .on('unread_count', async (message) => await saveMsg(message, 'unread_count'))
    // .on('change_state', async (message) => await saveMsg(message, 'change_state'));

    const saveMsg = async (message: any, type: string) => {
        console.log(type, JSON.stringify(message, null, 2));
    }

    console.log('BEFORE INITIALIZING WHATSAPP CLIENT');
    try {
        await appData.client.initialize();

    } catch (e) {
        console.error(e);
    }
    console.log('AFTER INITIALIZING WHATSAPP CLIENT');
}
async function chatResponse(prompt: string, instructions: string, text: string, conversation = []) {

    let task = `${prompt} ${instructions}${text}`;
    if (conversation?.length) {
        console.log({ conversation });
        task = text;
    }

    const resp = await simpleChat(task, conversation);
    console.log({ task, resp });
    return resp;
}
