import { resolve } from 'path';
import * as puppeteer from 'puppeteer';

import * as QRCode from 'qrcode';
import { Client, LocalAuth, Message, RemoteAuth } from 'whatsapp-web.js';


import { MsgAdapter } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { readToMe } from './speech-to-text';
import fs from 'fs';
import { AppData } from './app-data';




export const initWhatsappClient = async (appData: AppData) => {

    const queroMais = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        const quoted = await whatsMsg.getQuotedMessage();
        if (quoted.hasMedia) {
            const media = await quoted.downloadMedia();
            console.log({ media });
            await chat.sendMessage(media);
            await appData.client.sendMessage(appData.client.info.wid._serialized, media, { caption: 'Quero mais' });
        }
    };

    appData.client = new Client({
        authStrategy: new LocalAuth({
            clientId: process.env.ME,
        }),
        puppeteer: { headless: false, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true }
    });


    appData.actions['delicia'] = queroMais;

    appData.client.on('loading_screen', (percent, message, ...rest) => {
        console.log('LOADING SCREEN', percent, message, rest);
    });

    appData.client.on('authenticated', () => {
        console.log('AUTHENTICATED');
    });

    appData.client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
    });


    appData.client.on('ready', () => {
        console.log('READY');
    });

    appData.client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
    });

    appData.client.on('qr', (qr) => {
        QRCode.toString(qr, { type: 'terminal', small: true }, function (err: any, url: any) {
            console.log('\n\n\n');
            console.log(url);
            console.log('\n\n\n');
        });
    });


    appData.client.on('message_create', async receivedMsg => {
        // if (receivedMsg.hasMedia) {
        //     try {
        //         const media = await receivedMsg.downloadMedia();
        //         await appData.client.sendMessage(appData.client.info.wid._serialized, media, { caption: 'Midia' });
        //     } catch (e) {
        //         console.error(e);
        //     }
        // }
        const adaptedMessage = new WhatsappMessageAdapter(receivedMsg);
        if (receivedMsg.hasMedia && adaptedMessage.isAudio) {
            const media = await receivedMsg.downloadMedia();
            adaptedMessage.body = await readToMe(media.data);
        }
        await appData.processMessage(adaptedMessage);
    });
    await appData.client.initialize();
}