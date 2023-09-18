import { resolve } from 'path';
import * as puppeteer from 'puppeteer';

import * as QRCode from 'qrcode';
import { Client, LocalAuth, Message, MessageMedia, RemoteAuth, Buttons } from 'whatsapp-web.js';


import { MsgAdapter } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { readToMe } from './speech-to-text';
import fs from 'fs';
import { AppData } from './app-data';
import { giveMeImage, simpleChat } from './ai';
import { keyReplacer } from './util';
import { readDocument, whatIsIt } from './vision';




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
    const asText = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        if (whatsMsg.hasMedia) {
            if (msg.isAudio) {
                const media = await whatsMsg.downloadMedia();
                return await readToMe(media.data);
            } else if (msg.isDocument) {
                const media = await whatsMsg.downloadMedia();
                const [labelResponse] = await whatIsIt(Buffer.from(media.data, 'base64'));
                const [contentResponse] = await readDocument(Buffer.from(media.data, 'base64'));
                const labels = labelResponse.labelAnnotations?.map((label) => label.description).join(', ');
                const content = contentResponse.fullTextAnnotation?.text;
                return `Labels: ${labels}\n\nContent: ${content}`;
            }
        } else {
            return msg.body;
        }
    };
    const create_answer = async (msg: WhatsappMessageAdapter) => {
        const prompt = "Você é Fabrício Santos, CTO experiente na 4CODE Software House com mais de 12 anos de experiência em engenharia de software. Apaixonado por padrões de design, código de qualidade e trabalho em equipe. Habilidoso em .Net Core, Angular e Azure. Engajado na comunidade e focado na família. Pai, marido e irmão. Experiência prévia em desenvolvimento sênior e liderança técnica.\n"
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const quoted = await whatsMsg.getQuotedMessage();
        const adaptedMessage = new WhatsappMessageAdapter(quoted);
        const text = await asText(adaptedMessage);
        if (text) {
            const task = `${prompt}Estando em bate-papo, crie uma mensagem de chat para o texto a seguir: '''${text}'''`
            const resp = await simpleChat(task);
            return resp;
        } 
        return undefined;
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

    const answer_text = async (msg: WhatsappMessageAdapter) => {
       
        const text = await create_answer(msg);
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
            const adaptedMessage = new WhatsappMessageAdapter(receivedMsg);
            if (receivedMsg.hasMedia && adaptedMessage.isAudio) {
                const media = await receivedMsg.downloadMedia();
                adaptedMessage.body = await readToMe(media.data);
            }
            // if ../messages folder does not exist, create it
            if (!receivedMsg.fromMe) {
                try {
                    const folderName = "../messages"

                    const folderPath = resolve(__dirname, folderName, keyReplacer(receivedMsg.from))
                    const folderExists = fs.existsSync(folderPath)
                    if (!folderExists) {
                        await fs.promises.mkdir(folderPath, { recursive: true });
                    }
                    const baseName = keyReplacer(receivedMsg.id._serialized);
                    const txt = `${baseName}.txt`;
                    const jsonFile = `${baseName}.json`;
                    const filenameTxt = resolve(folderPath, txt);
                    const filenameJson = resolve(folderPath, jsonFile);
                    await fs.promises.writeFile(filenameTxt, adaptedMessage.body);
                    await fs.promises.writeFile(filenameJson, JSON.stringify(receivedMsg));
                    console.log({ filenameTxt, filenameJson });
                    // File successfully written
                } catch (error) {
                    // An error occurred while writing the file
                    console.error(error);
                }

            }
            await appData.processMessage(adaptedMessage);
        });
    console.log('BEFORE INITIALIZING WHATSAPP CLIENT');
    try {
        await appData.client.initialize();
    } catch (e) {
        console.error(e);
    }
    console.log('AFTER INITIALIZING WHATSAPP CLIENT');
}