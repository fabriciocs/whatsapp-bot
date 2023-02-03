import { resolve } from 'path';
import * as puppeteer from 'puppeteer';

import * as QRCode from 'qrcode';


import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';
import { readToMe } from './speech-to-text';

export const init = async (appData) => {
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

