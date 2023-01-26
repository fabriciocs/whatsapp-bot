import { resolve } from 'path';
import * as puppeteer from 'puppeteer';

import * as QRCode from 'qrcode';
import { Client, RemoteAuth } from 'whatsapp-web.js';


import { MsgAdapter } from './msg/msg';

const puppeteerConfig: puppeteer.PuppeteerNodeLaunchOptions & puppeteer.ConnectOptions = { headless: false, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true };

export const initWhatsappClient = async (appData) => {

    appData.client = new Client({
        authStrategy: new RemoteAuth({
            clientId: process.env.ME,
            dataPath: resolve('../webjsauth'),
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
    });

    appData.client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
    });

    appData.client.on('qr', (qr) => {
        QRCode.toString(qr, { type: 'terminal', small: true }, function (err: any, url: any) {
            console.log(url)
        });
    });


    appData.client.on('message_create', async receivedMsg => {
        await appData.processMessage(new MsgAdapter(receivedMsg));
    });
    await appData.client.initialize();
}