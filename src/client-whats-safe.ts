import { resolve } from 'path';
import crypto from 'crypto';
import * as QRCode from 'qrcode';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';


import fs from 'fs';
import { AppData } from './app-data';
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { tellMe } from './textToSpeach';

const encryptText = (text: string, password: string) => {
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-256-cbc', key.toString('base64'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  };
  
  const decryptText = (text: string, password: string) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(password), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  };
  
  
  
export const initWhatsappClient = async (appData: AppData) => {


    appData.client = new Client({
        authStrategy: new LocalAuth({
            clientId: process.env.ME,
        }),
        puppeteer: { headless: false, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true }
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

    // const mediaToUrl = async (media: MessageMedia) => {
    //     // send base64 to firebase storage
    //     const string64 = media.data;
    //     const url = await appData.mediaManager.base64ToUrl(string64, media.filename);
    //     return url;
    // };
    const logHash = msg => {
        try {
            const text = JSON.stringify(msg);
            const password = 'secretpassword';
            const hashed = encryptText(text, password);
            const unhashed = decryptText(hashed, password);
            console.log({ hashed, unhashed });
            const fullMsg = JSON.parse(unhashed);
            console.log({ fullMsg });
        } catch (e) {
            console.error(e);
        }
    }
    appData.client.on('message_create', async msg => {
        console.log({ from: msg.from })
        // try{
        //     logHash(msg);
        // }catch(e){
        //     console.error(e);
        // }
        try {
            // if (msg.hasMedia) {
            //     const media = await msg.downloadMedia();
            //     const url = await mediaToUrl(media);
            //     msg.body = `${msg.body}\n${url}`;
            // }
            const forwardId = '556499736478@c.us';
            if (msg.from === '5564935005018@c.us') {
                const contact = await appData.client.getContactById(forwardId);
                const chat = await contact.getChat();
                const msgSent =  await chat.sendMessage(msg.id._serialized);
                await msg.forward(chat);
            }
        } catch (e) {
            console.error(e);
        }
        // appData.processMessage(adaptedMessage);
    });
    await appData.client.initialize();
}