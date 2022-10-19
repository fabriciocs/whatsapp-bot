const dotenv = require('dotenv');
dotenv.config();


// // 'https://apicarros.com/v2/consultas/PRZ2H00/a738ddda2213270d5e5afb815ca05085/json'
// const sinespApi = require('sinesp-api').configure({
//     host: 'apicarros.com',
//     endpoint: 'consultas',
//     serviceVersion: 'v2',
// });

const axios = require('axios');
const puppeteer = require('puppeteer');

const { Client, MessageMedia, LocalAuth, Buttons, Message } = require('whatsapp-web.js');
const { admin } = require('./db-config.js');
const { getVid } = require('./xv.js');
const { whatIsIt, readIt } = require('./vision.js');
const { writeAText, giveMeImage } = require('./openai.js');
const { inPortuguesePlease, inEnglishPlease } = require('./translate.js');
const { tellMe } = require('./textToSpeach.js');
const QRCode = require('qrcode');
const speech = require('@google-cloud/speech');



const { resolve, basename } = require('path');

var exec = require('child_process').exec;
const { promises: { readdir, unlink, copyFile, }, writeFileSync, readFileSync, statSync, existsSync, mkdirSync, createReadStream } = require('fs');
const { async } = require('@firebase/util');

const myId = '556492026971@c.us';

const puppeteerConfig = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true };
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
});


client.initialize();
const db = admin.database();
const ref = db.ref('bee-bot');

const toMB = bytes => bytes / (1024 ** 2);
// const serializer = {

// }

// const baseDataSaving = async (extractor, type, msg) => {
// };
// const dataManagement = {
//     messages: async () =>
// }

// const firebaseKey = text => text?.replace(/[.#$@[\]]+/g, '')

const backup = msg => {
    const prepared = JSON.parse(JSON.stringify(msg));
    ref.child('messages').push().set(prepared);
}



client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE', msg);
});


client.on('ready', async () => {
    console.log('READY');
    await client.sendMessage(myId, jsonToText(client.info));

});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

client.on('qr', (qr) => {

    QRCode.toString(qr, { type: 'terminal', small: true }, function (err, url) {
        console.log(url)
    })

});


const sendVid = async (msg, page = 1, size = 1, search = '') => {
    try {

        const vids = await getVid(+page, +size, search, puppeteerConfig);

        await Promise.all(vids.map(async ({ high, image, url, title, low }) => {
            const result = async (vidUrl) => {
                const vidMedia = await MessageMedia.fromUrl(vidUrl);
                const text = `${title}\n${url}\n${toMB(vidMedia.data.length).toFixed(2)}MB\n`;
                return await client.sendMessage(msg.to, vidMedia, { caption: text });
            };
            try {
                const textImg = `${url}\n${title}`;
                const imgMedia = await MessageMedia.fromUrl(image);
                await client.sendMessage(getMsgTo(msg), imgMedia, { caption: textImg });
                await result(high);
            } catch (error) {
                console.error({ high: error });
                try {
                    return await result(low);
                } catch (error) {
                    console.error({ low: error });
                    await client.sendMessage(getMsgTo(msg), 'erro na mídia');
                }
            }

        }));
    } catch (error) {
        console.log({ getVidError: error });
        throw error;
    }

};

const buttons = [
    {
        "id": "0",
        "displayText": "teste1",
        "subtype": "quick_reply",
        "selectionId": { "eventName": "inform" }
    },
    {
        "id": "1",
        "displayText": "teste2",
        "subtype": "quick_reply",
        "selectionId": { "eventName": "event-rg" }
    },
    {
        "id": "2",
        "displayText": "teste3",
        "subtype": "quick_reply",
        "selectionId": { "eventName": "event-cnh" }
    }
];

const sendVidWithButton = async (msg, size, search) => {
    if (!search && size) {
        search = size.length ? size.join(' ') : size;
    }
    const { high, image, url, title, low } = await getVid(search, puppeteerConfig);
    const imgMedia = await MessageMedia.fromUrl(image);
    await client.sendMessage(msg.to, high);
    const b = new Buttons(imgMedia, buttons, title);

    await client.sendMessage(msg.to, b, { caption: title });

};


const listMsgs = async (msg, size) => {
    const chat = await msg.getChat();
    const to = msg.to;
    const limit = +size;
    const msgs = await chat.fetchMessages({
        limit
    });
    let rep = `${jsonToText({ limit, count: msgs?.length })}`;
    console.log({ rep });
    const data = await Promise.all(await msgs.map(async (m) => jsonToText(m)));
    await client.sendMessage(myId, data.join('\n'));
}
const clearChat = async (msg) => {
    const chat = await msg.getChat();
    await chat.clearMessages(true);
    await msg.delete(true);
}
const printStatus = async (msg) => {
    const toReply = JSON.parse(JSON.stringify({ msg, info: client.info }), null, 4);
    await msg.reply(toReply);
}



const deleteMsgs = async (msg, size = 60) => {
    const chat = await msg.getChat();
    const msgs = await chat.fetchMessages({
        limit: +size
    });
    await Promise.all(await msgs.map(async m => await m?.delete(true)));
}



const showSimpleInfo = async (msg) => {

    try {
        await client.sendMessage(myId, JSON.parse({ msg: jsonToText(msg), chat: jsonToText(await msg.getChat()), contact: jsonToText(await msg.getContact()) }));
        if (msg.hasMedia) {
            await protectFromError(async () => {
                const media = await msg.downloadMedia();
                const vision = Buffer.from(media.data, 'base64');
                const res = await whatIsIt(vision);
                const [{ labelAnnotations }] = res;
                const details = labelAnnotations.reduce((p, { description }) => p.concat(description), []);
                await client.sendMessage(myId, details?.join(','));
            });
            const whatIsWritten = await readIt(vision);
            const [{ fullTextAnnotation }] = whatIsWritten;
            await client.sendMessage(myId, fullTextAnnotation?.text);
            const fileEncoded = Buffer.from(JSON.stringify(fullTextAnnotation.pages, null, 4)).toString('base64');
            const fileAsMedia = new MessageMedia("text/json", fileEncoded, `${new Date().getTime()}.json`);
            await client.sendMessage(myId, fileAsMedia, {
                sendMediaAsDocument: true
            });
        }

    } catch (err) {
        console.log({ quotedErr: err });
    } finally {
        await msg.delete(true);
    }
};


const helpMsg = async (msg) => {
    await protectFromError(async () => {
        try {
            const text = Object.keys(funcSelector).join('\n');
            await msg.reply(text);
        } catch (err) {
            console.log({ helpError: err });
            await msg.delete(true);
        }
    });
};
const searchByChassiGo = async (msg, chassi) => {
    const browser = await puppeteer.launch({ ...puppeteerConfig, headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://www.detran.go.gov.br/psw/#/pages/conteudo/gravame', { waitUntil: "networkidle2" });


        await page.click(`button.mat-raised-button.mat-primary.ng-star-inserted`);
        await page.focus('input[formcontrolname="chassi"]');
        await page.keyboard.type(chassi);
        await page.click(`button.button-primary.notranslate.mat-raised-button`);
        try {
            const r = await page.waitForResponse(response =>
                response.url().includes('www.detran.go.gov.br/psw/rest/gravame') && response.status() === 200);
            const txt = JSON.stringify(await r?.json(), null, 4);
            console.log({ txt });
            await msg.reply(txt ?? 'resposta vazia');
        } catch (err) {
            console.log({ semGravame: err });
            await page.click(`button.button-primary.notranslate.mat-raised-button`);
            await new Promise(r => setTimeout(r, 4000));
            const screenshotData = await page.screenshot({ encoding: 'base64', fullPage: true });
            const dataAsMedia = new MessageMedia("image/png", screenshotData, `${new Date().getTime()}.png`);
            await client.sendMessage(msg.from, dataAsMedia);
        }

        await page.close();
    } catch (err) {
        console.log({ page: err });
        await client.sendMessage(msg.to, JSON.stringify(err, null, 4));
        await msg.reply(`falha na consulta dados extras ${chassi}`);
    }
    await browser.close();
    // page.on('response', async (response) => {
    //     if (response.url())) {
    //         const responseBody = await response.buffer();
    //        
    //     }
    // });
    // await page.click(`button.button-primary.notranslate.mat-raised-button`);


}
const protectFromError = async (anyFunc) => {
    try {
        return await anyFunc();
    } catch (err) {
        console.log({ runtimeError: err });
    }
}

const searchByChassiDf = async (msg, chassi) => {
    const browser = await puppeteer.launch({ ...puppeteerConfig, headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://www.detran.df.gov.br/wp-content/uploads/2020/10/html_consulta_sng.html', { waitUntil: "networkidle2" });

        await page.focus('input[name="CHASSI"]');
        await page.keyboard.type(chassi);
        await page.click(`input[type="submit"]`, { waitUntil: 'networkidle2' });
        try {
            // await protectFromError(async () => {

            //     const txt = await page.evaluate(doc => {
            //         const table = doc.querySelectorAll('table.brdinteiraverde');
            //         return [...table].map(e => {
            //             const obj = {};
            //             const title = e.querySelector('td.titalphaverde')?.innerText;
            //             const bodyContent = {};
            //             const bodyList = [...e.querySelectorAll('td.txt11, td.fundodadosbold')].map(e => e.innerText);
            //             for (let i = 0; i < bodyList.length; i += 2) {
            //                 bodyContent[bodyList[i]] = bodyList[i + 1];
            //             }
            //             obj[title] = bodyContent;
            //             return obj;
            //         })
            //     });
            //     await client.sendMessage(msg.to, jsonToText(txt));
            // });
            await protectFromError(async () => {
                const screenshotData = await page.screenshot({ encoding: 'base64' });
                const dataAsMedia = new MessageMedia("image/png", screenshotData, `${new Date().getTime()}.png`);
                await msg.reply(dataAsMedia);
            });
            // await protectFromError(async () => {
            //     const pdf = (await page.pdf({ format: 'A4', fullPage: true })).toString('base64');
            //     const pdfAsMedia = new MessageMedia("application/pdf", pdf, `${new Date().getTime()}.pdf`);
            //     await client.sendMessage(msg.to, pdfAsMedia, {
            //         sendMediaAsDocument: true
            //     });
            // });
        } catch (err) {
            console.log({ semGravame: err });
        }
        await page.close();
    } catch (err) {
        console.log({ page: err });
        await client.sendMessage(msg.to, JSON.stringify(err, null, 4));
        await msg.reply(`falha na consulta dados extras ${chassi}`);
    }
    await browser.close();
    // page.on('response', async (response) => {
    //     if (response.url())) {
    //         const responseBody = await response.buffer();
    //        
    //     }
    // });
    // await page.click(`button.button-primary.notranslate.mat-raised-button`);


}
const searchByLicensePlate = async (msg, placa, full = false) => {
    try {
        let vehicle = await axios.get(`https://apicarros.com/v2/consultas/${placa}/8e976a5c05bd3035c75efa7b459296bd/json`);
        if (full) {
            await msg.reply(JSON.stringify(vehicle.data, null, 4));
        }
        const chassi = vehicle?.data?.extra?.chassi;
        const uf = vehicle?.data?.uf;
        if (chassi) {
            try {
                if (uf === 'GO') {
                    await searchByChassiGo(msg, chassi);
                }
                if (uf === 'DF') {
                    await searchByChassiDf(msg, chassi);
                }

                // const extra = await axios.get(`https://www.detran.go.gov.br/psw/rest/gravame?chassi=${chassi}`);
                // await client.sendMessage(msg.from, JSON.stringify(extra?.data ?? {}, null, 4));
            } catch (err) {
                console.log({ extra: err });
                await client.sendMessage(msg.to, jsonToText(err));
                await msg.reply(JSON.stringify(vehicle.data, null, 4));
                await msg.reply(`falha na consulta dados extras ${uf}-${chassi}`);
            }
        }
    } catch (err) {
        console.log({ licensePlate: err });
        await client.sendMessage(msg.to, JSON.stringify(err, null, 4));
        await msg.reply(`falha na consulta da placa ${placa}`);
    }
};
const sweetError = async (msg, err) => {
    if (msg) {
        await msg.reply('Não consegui. 😂😂😂');
    }
    await client.sendMessage(myId, jsonToText(err));
}


const sweetTry = async (msg, func) => {
    try {
        await func();
    } catch (err) {
        await sweetError(msg, err);
    }

}


const writeToMe = async (msg) => {
    if (!msg) {
        await sweetError(msg, 'sem mensagem');
    }
    const songTypes = ['VOICE', 'AUDIO', 'PTT']
    if (songTypes.includes(msg.type?.toUpperCase())) {
        await sweetTry(msg, async () => {
            const audio = await msg.downloadMedia();
            const speechClient = new speech.SpeechClient();
            const content = Buffer.from(audio.data, 'base64');
            const config = {
                encoding: "OGG_OPUS",// #replace with "LINEAR16" for wav, "OGG_OPUS" for ogg, "AMR" for amr
                sampleRateHertz: 16000,
                languageCode: "pt-BR"
            };
            const [response] = await speechClient.recognize({
                audio: { content }, config
            });
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            await msg.reply(transcription);
        });
    }
};

const readToMe = async (msg) => {
    if (!msg) {
        await sweetError(msg, 'sem mensagem');
    }
    const songTypes = ['VOICE', 'PTT']
    if (songTypes.includes(msg.type?.toUpperCase())) {
        return await sweetTry(msg, async () => {
            const audio = await msg.downloadMedia();
            const speechClient = new speech.SpeechClient();
            const content = Buffer.from(audio.data, 'base64');
            const config = {
                encoding: "OGG_OPUS",// #replace with "LINEAR16" for wav, "OGG_OPUS" for ogg, "AMR" for amr
                sampleRateHertz: 16000,
                languageCode: "pt-BR"
            };
            const [response] = await speechClient.recognize({
                audio: { content }, config
            });
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            return transcription;
        });
    }
};



const createATextDirectly = async (msg, prompt) => {
    const result = await writeAText({ prompt });
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await msg.reply(answer);
    } else {
        const { content, options } = await noAnswerMessage(msg);
        await msg.reply(content, options);
    }
};


const responseWithTextDirectly = async (prompt) => {
    const result = await writeAText({ prompt });
    const answer = result?.choices?.[0]?.text;
    return answer;
};
const createAudioDirectly = async (msg, prompt) => {
    const answer = await responseWithTextDirectly(prompt);
    const content = await tellMe(answer);
    const song = new MessageMedia("audio/mp3", content, `${new Date().getTime()}.mp3`);
    await client.sendMessage(msg.to, song);
};
const funcSelector = {
    'status': async (msg) => await printStatus(msg),
    'panic': async (msg, [size]) => await deleteMsgs(msg, size),
    'ultimas': async (msg, [size]) => await listMsgs(msg, size),
    'xv': async (msg, [page, size, ...search]) => await sendVid(msg, page, size, search.join(' ')),
    'que?': async (msg) => await showSimpleInfo(msg),
    '--h': async (msg) => await helpMsg(msg),
    'escreve': async (msg) => await writeToMe((await (await msg.getQuotedMessage())?.reload())),
    'placa': async (msg, [placa, full]) => await searchByLicensePlate(msg, placa, full),
    'elon_musk': async (msg, prompt) => await createAText(msg, prompt?.join(' ')),
    'elon': async (msg, prompt) => await createATextDirectly(msg, prompt?.join(' ')),
    'sandro': async (msg, prompt) => await createATextDirectly(msg, prompt?.join(' ')),
    'poliana': async (msg, prompt) => await createATextDirectly(msg, prompt?.join(' ')),
    'diga': async (msg, prompt) => await createAudioDirectly(msg, prompt?.join(' ')),
    'ping': async (msg) => await msg.reply('pong'),
    'emvideo': async (msg, [url]) => await urlAsVideo(msg, url)
}
const simpleMsgInfo = async ({ rawData, body, ...clean }) => {

    if (clean.hasMedia) {
        return clean;
    }
    return { body, ...clean };
};

const onlyRaw = ({ rawData }) => rawData;

const getLogChatInfo = async chat => {
    const contact = await chat.getContact();
    const labels = await chat.getLabels();
}

const getLogContactInfo = async contact => {

};
const logTotalInfo = async (msg) => {
    const chats = await client.getChats();
    const currentChat = await msg.getChat();
    const last100 = await currentChat.fetchMessages({ limit: 100 });
    const simpleList = last100.map(async (l) => await simpleMsgInfo(l));
}

const safeMsgIds = ['556499736478@c.us'];
const external = [myId, '556499163599@c.us', '556481509722@c.us', '556492979416@c.us'].concat(safeMsgIds);
const commandMarker = '@ ';
const codeMarker = '@run';

const isSafe = msg => safeMsgIds.includes(msg.from);

const licensePlateSearch = ['556481509722@c.us'];
const isLicensePlate = msg => {
    const msgContent = msg?.body?.toUpperCase();
    if (isCommand(msg) || msgContent.split(' ').length > 1 || msgContent.length > 7) return false;

    return /([A-Z]{3}\d[A-Z]\d{2})|([A-Z]{3}\d{4})/g.test(msgContent.replace(/[^A-Z0-9]+/g, ''));
}

const noAnswerMessage = async () => {
    const content = await MessageMedia.fromFilePath(resolve(__dirname, 'assets', 'noanswer.jpeg'));
    const options = {
        sendMediaAsSticker: true,
        sendSeen: true,
        stickerAuthor: 'github.com/fabriciocs@bee-bot'
    }

    return { content, options };

}




const fastAnswer = {
}
const sendFastanswerMessage = async (msg) => {
    const { content, options } = await fastAnswer[answerKey]?.(msg) ?? noAnswerMessage(msg);
    await msg.reply(content, options)
};

const sendWaiting = async (msg) => {
    try {
        const loadingPath = resolve(__dirname, '.', 'assets', 'loading.gif');
        console.log({ loadingPath });
        const fileEncoded = `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`;

        const content = new MessageMedia("video/mp4", fileEncoded, `${new Date().getTime()}.mp4`);
        await msg.reply(content, {
            sendMediaAsSticker: true,
            sendSeen: true,
            stickerAuthor: 'github.com/fabriciocs@bee-bot'
        });
    } catch (err) {
        console.log({ waiting: err });
        await msg.reply('Executando, um momento por favor');
    }
};

const isToMe = msg => msg.to === myId;
const isCommand = msg => msg.body.startsWith(commandMarker);
const isDiga = msg => {
    const msgBody = msg.body?.toLowerCase();
    return msgBody.startsWith('diga') || msgBody.startsWith('fale') || msgBody.startsWith('comente') || msgBody.startsWith('descreva') || msgBody.startsWith('explique') || msgBody.startsWith('bibot');
}
const isCode = msg => msg.body.startsWith(codeMarker);
const canExecuteCommand = msg => {
    if (isCommand(msg)) {
        return isAuthorized(msg);
    }
    if (isLicensePlate(msg)) {
        return licensePlateSearch.includes(msg.from) || !!msg.fromMe;
    }


}
const canExecuteCode = msg => {

    if (isCode(msg)) {
        return !!msg?.fromMe && isToMe(msg);
    }
}

const extractExecutionInfo = msg => {
    if (isCommand(msg)) {
        const [, text, ...params] = msg.body.split(' ').filter(Boolean);
        return [text, params];
    }
    if (isLicensePlate(msg)) {
        return ['placa', [msg.body?.toUpperCase(), true]];
    }


}
const extractCodeInfo = msg => {

    const [, ...params] = msg.body.split(' ').filter(Boolean);
    return params?.join(' ');
}
const isAuthorized = (msg) => !!msg.fromMe || !!external.includes(msg.from);
const runCommand = async (msg) => {
    try {
        const [text, params] = extractExecutionInfo(msg);
        console.log({ text, params });
        await sendWaiting(msg);
        await funcSelector[text.toLowerCase()](msg, params);
    } catch (error) {
        console.error({ error });
        await msg.reply('Deu erro no comando. 😂😂😂');
    }
}
const codeToRun = (code) => {

}
const runCode = async (msg) => {
    try {
        
        exec(`${msg.body}`, async (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                await msg.reply(jsonToText(err));
                return;
            }
            console.log(stdout);
            await msg.reply(stdout);
        });
    } catch (error) {
        console.error({ error });
        await msg.reply('Deu erro no codigo.');
    }
}
client.on('message_create', async msg => {
    await protectFromError(async () => {
        backup(msg);
        try {

            if (!!msg.fromMe) {
                console.log({ type: msg.type });
                const message = await readToMe(msg);
                if (message) {
                    console.log({ message });

                    if (isDiga({ body: message })) {
                        return await createAudioDirectly(msg, message);
                    }
                }
            }

        } catch (err) {
            console.log({ 'writing error': err });
        }
        if (canExecuteCommand(msg)) {
            await runCommand(msg);
        }
        if (canExecuteCode(msg)) {
            await runCode(msg);
        }
    });
});



function jsonToText(err) {
    return JSON.stringify(err, null, 4);
}
const extractors = {
    'AUDIO': async (msg) => await getExtactorBy(),
    'BROADCAST_NOTIFICATION': async (msg) => await getExtactorBy(),
    'BUTTONS_RESPONSE': async (msg) => await getExtactorBy(),
    'CALL_LOG': async (msg) => await getExtactorBy(),
    'CIPHERTEXT': async (msg) => await getExtactorBy(),
    'const msgTypes = [': async (msg) => await getExtactorBy(),
    'CONTACT_CARD': async (msg) => await getExtactorBy(),
    'CONTACT_CARD_MULTI': async (msg) => await getExtactorBy(),
    'DEBUG': async (msg) => await getExtactorBy(),
    'DOCUMENT': async (msg) => await getExtactorBy(),
    'E2E_NOTIFICATION': async (msg) => await getExtactorBy(),
    'GP2': async (msg) => await getExtactorBy(),
    'GROUP_INVITE': async (msg) => await getExtactorBy(),
    'GROUP_NOTIFICATION': async (msg) => await getExtactorBy(),
    'HSM': async (msg) => await getExtactorBy(),
    'IMAGE': async (msg) => await getExtactorBy(),
    'INTERACTIVE': async (msg) => await getExtactorBy(),
    'LIST': async (msg) => await getExtactorBy(),
    'LIST_RESPONSE': async (msg) => await getExtactorBy(),
    'LOCATION': async (msg) => await getExtactorBy(),
    'NATIVE_FLOW': async (msg) => await getExtactorBy(),
    'NOTIFICATION': async (msg) => await getExtactorBy(),
    'NOTIFICATION_TEMPLATE': async (msg) => await getExtactorBy(),
    'ORDER': async (msg) => await getExtactorBy(),
    'OVERSIZED': async (msg) => await getExtactorBy(),
    'PAYMENT': async (msg) => await getExtactorBy(),
    'PRODUCT': async (msg) => await getExtactorBy(),
    'PROTOCOL': async (msg) => await getExtactorBy(),
    'REACTION': async (msg) => await getExtactorBy(),
    'REVOKED': async (msg) => await getExtactorBy(),
    'STICKER': async (msg) => await getExtactorBy(),
    'TEMPLATE_BUTTON_REPLY': async (msg) => await getExtactorBy(),
    'TEXT': async (msg) => await getExtactorBy(),
    'UNKNOWN': async (msg) => await getExtactorBy(),
    'VIDEO': async (msg) => await getExtactorBy(),
    'VOICE': async (msg) => await getExtactorBy()
}
