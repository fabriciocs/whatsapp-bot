import { resolve } from 'path';
import * as puppeteer from 'puppeteer';

import * as QRCode from 'qrcode';
import { Client, Message, RemoteAuth } from 'whatsapp-web.js';


import { MsgAdapter } from './msg/msg';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { readToMe } from './speech-to-text';

const puppeteerConfig: puppeteer.PuppeteerNodeLaunchOptions & puppeteer.ConnectOptions = { headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true };


export const initWhatsappClient = async (appData) => {

    const queroMais = async (msg: WhatsappMessageAdapter) => {
        const whatsMsg = msg.getMsg() as unknown as Message;
        const chat = await whatsMsg.getChat();
        if (whatsMsg.hasMedia) {
            const media = await whatsMsg.downloadMedia();
            await appData.client.sendMessage(appData.client.user.id._serialized, media.data, { caption: 'Quero mais' });
        }
    };

    appData.client = new Client({
        authStrategy: new RemoteAuth({
            clientId: process.env.ME,
            store: appData.sessionManager,
            backupSyncIntervalMs: 60000,
        }),
        puppeteer: puppeteerConfig
    });



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
        appData.actions['quero+'] = queroMais;
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
        const adaptedMessage = new WhatsappMessageAdapter(receivedMsg);
        if (receivedMsg.hasMedia && adaptedMessage.isAudio) {
            const media = await receivedMsg.downloadMedia();
            adaptedMessage.body = await readToMe(media.data);
        }
        await appData.processMessage(adaptedMessage);
    });
    await appData.client.initialize();
}