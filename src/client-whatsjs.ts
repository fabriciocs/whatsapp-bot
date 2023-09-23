import { resolve } from 'path';
import * as puppeteer from 'puppeteer';

import * as QRCode from 'qrcode';
import WAWebJS, { Client, LocalAuth, Message, MessageMedia, RemoteAuth, Buttons } from 'whatsapp-web.js';


import { MsgAdapter } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { readToMe } from './speech-to-text';
import fs from 'fs';
import { AppData } from './app-data';
import { giveMeImage, simpleChat } from './ai';
import { keyReplacer, normalizeFilepath } from './util';
import { readDocument, whatIsIt } from './vision';


const backupMsg = async (folderPath: string, bkpMsg: Message) => {
    try {
        const baseName = normalizeFilepath(`${bkpMsg.timestamp}-${bkpMsg.type}-${bkpMsg.body?.substring(0, 50)}`);
        const jsonFile = `${baseName}.json`;
        const filenameJson = resolve(folderPath, jsonFile);
        try {
            await fs.promises.writeFile(filenameJson, JSON.stringify(bkpMsg));
        } catch (e) {
            console.error(e);
        }

        if (bkpMsg.hasMedia) {
            const media = await bkpMsg.downloadMedia();
            if (!media) {
                try {
                    const reloaded = await bkpMsg.reload();
                    if (reloaded) {
                        return await backupMsg(folderPath, reloaded);
                    }
                } catch (e) {
                    console.error(e);
                    return undefined;
                }
            }
            const filename = `${baseName}.${media.mimetype.split('/')[1]}`;
            const filenameMedia = resolve(folderPath, filename);
            await fs.promises.writeFile(filenameMedia, Buffer.from(media.data, 'base64'));

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
    }
}

export const initWhatsappClient = async (appData: AppData) => {
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




    const desenha = async (msg: WhatsappMessageAdapter, prompt: []) => {

        const instruction = prompt?.join(' ')
        const url = await giveMeImage(instruction, '512x512');
        if (url) {
            const whatsMsg = msg.getMsg() as unknown as Message;
            const chat = await whatsMsg.getChat();
            const media = await MessageMedia.fromUrl(url);
            await chat.sendMessage(media, {
                caption: instruction
            });
        } else {
            await msg.reply('Não consegui criar a imagem');
        }

    }
    const backupChat = async (folderName: string, chat: WAWebJS.Chat) => {
        try {

            const contact = await chat.getContact();
            const contactName = contact.name;
            const contactNumber = (await contact.getFormattedNumber()).replace(/\D/g, '');
            const folderPath = resolve(folderName, normalizeFilepath(`${contactNumber}-${contactName ?? contactNumber}`))
            const folderExists = fs.existsSync(folderPath)
            if (!folderExists) {
                console.log({ bkp: folderPath });
                await fs.promises.mkdir(folderPath, { recursive: true });
                const contactFileName = resolve(folderPath, 'contact.json');
                await fs.promises.writeFile(contactFileName, JSON.stringify(contact));

                const previous = await chat.fetchMessages({ limit: Infinity });
                if (previous?.length > 0) {
                    await Promise.all(previous.map(async (bkpMsg) => {
                        await backupMsg(folderPath, bkpMsg);
                    }));
                }
            }
            return folderPath;
        } catch (error) {
            // An error occurred while writing the file
            console.error(error);
        }
    }
    const backupAll = async () => {
        const chats = await appData.client.getChats();
        const folderName = `/home/fabricio/whatsbkp/${normalizeFilepath(Date.now().toLocaleString())}/`;
        await Promise.all(chats.map(async (chat) => {
            await backupChat(folderName, chat);
        }));
    }
    const asText = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const msgBody = whatsMsg.body;
        if (whatsMsg.hasMedia) {
            if (msg.isAudio) {
                const media = await whatsMsg.downloadMedia();
                return await readToMe(media.data);
            } else if (msg.isDocument) {
                const media = await whatsMsg.downloadMedia();
                const [labelResponse] = await whatIsIt(Buffer.from(media.data, 'base64'));
                const [contentResponse] = await readDocument(Buffer.from(media.data, 'base64'));
                const labels = labelResponse.labelAnnotations?.map((label) => label.description).join(',');
                const content = contentResponse.fullTextAnnotation?.text;
                return `Annotations:[${labels}]\nOCR:"${content}"\nMsg:"${msgBody}"`;
            }
        } else {
            return msgBody;
        }
    };
    const create_answer = async (msg: WhatsappMessageAdapter, params: string[] = []) => {
        const prompt = "Fabrício Santos é CTO experiente na 4CODE Software House com mais de 12 anos de experiência em engenharia de software. Apaixonado por padrões de design, código de qualidade e trabalho em equipe. Habilidoso em .Net Core, Angular e Azure. Engajado na comunidade e focado na família. Pai, marido e irmão. Experiência prévia em desenvolvimento sênior e liderança técnica.\n"
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const quoted = await whatsMsg.getQuotedMessage();
        let text = "";
        let instructions = "";
        if (quoted) {
            text = await asText(new WhatsappMessageAdapter(quoted));
            if (params?.length > 0) {
                instructions = `Conforme o contexto que Fabricio Santos informou: '''${params.join(' ')}'''. \n`;
            }
        } else {
            if (!whatsMsg.hasMedia) {
                text = params?.join(' ')
            } else {
                text = await asText(msg);
            }
        }

        const task = `${prompt} ${instructions} Analise o texto a seguir, atue como Fabricio Santos e responda:'''${text}'''`
        console.log({ task })
        const resp = await simpleChat(task);
        return resp;

    };

    const transcreve = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const quoted = await whatsMsg.getQuotedMessage();
        const adaptedMessage = new WhatsappMessageAdapter(quoted);
        const text = await asText(adaptedMessage);
        if (text) {
            await chat.sendMessage(text);
        } else {
            await msg.reply('Não consegui transcrever');
        }
    };

    const answer_text = async (msg: WhatsappMessageAdapter, params: string[] = []) => {

        const text = await create_answer(msg, params);
        if (text) {
            await msg.reply(text);
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
    const send_button = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        console.log("send button")
        let button = new Buttons('Button body', [{ body: 'bt1' }]);
        await chat.sendMessage(button);

    };
    appData.actions['delicia'] = queroMais;
    appData.actions['normal'] = queroMais;
    appData.actions['transcreve'] = transcreve;
    appData.actions['desenha'] = desenha;
    appData.actions['button'] = send_button;

    appData.actions['.'] = answer_text;
    appData.actions['.*'] = allmsg;

    appData.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { headless: `chrome`, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
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
        .on('message_create', async (receivedMsg) => {
            try {
                const adaptedMessage = new WhatsappMessageAdapter(receivedMsg);
                const folderName = `/home/fabricio/whatsbkp/`
                const folderPath = await backupChat(folderName, await receivedMsg.getChat());
                await backupMsg(folderPath, receivedMsg);
                try {
                    await appData.processMessage(adaptedMessage);
                } catch (e) {
                    console.error(e);
                }
            } catch (e) {
                console.error(e);
            }



        });
    console.log('BEFORE INITIALIZING WHATSAPP CLIENT');
    try {
        await appData.client.initialize();
    } catch (e) {
        console.error(e);
    }
    console.log('AFTER INITIALIZING WHATSAPP CLIENT');
    try {
        await backupAll();
    } catch (e) {
        console.error(e);
    }
}