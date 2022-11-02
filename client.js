const dotenv = require('dotenv');
dotenv.config();




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
const leia = require('./leia.js');

// const myId = '556492026971@c.us';
const myId = '120363044726737866@g.us';
const leiaId = '551140030407@c.us';

const puppeteerConfig = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true };
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
});

const db = admin.database();
const ref = db.ref('bee-bot');

const toMB = bytes => bytes / (1024 ** 2);

const backup = msg => {
    const prepared = prepareJsonToFirebase(JSON.parse(JSON.stringify(msg)));
    ref.child('messages').push().set(prepared);
}



client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});


client.on('ready', () => {
    console.log('READY');
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

client.on('qr', (qr) => {

    QRCode.toString(qr, { type: 'terminal', small: true }, function (err, url) {
        console.log(url)
    })

});
(async () => {
    await client.initialize();
})();
const sendVid = async (msg, page = 1, size = 1, search = '') => {
    try {

        const vids = await getVid(+page, +size, search, puppeteerConfig);

        await Promise.all(await vids.map(async ({ high, image, url, title, low }) => {
            const result = async (vidUrl) => {
                const vidMedia = await MessageMedia.fromUrl(vidUrl);
                const text = `${title}\n${url}\n${toMB(vidMedia.data.length).toFixed(2)}MB\n`;
                return await client.sendMessage(msg.to, vidMedia, { caption: text, sendMediaAsDocument: true });
            };
            try {
                const textImg = `Baixando o vídeo: ${title}`;
                const imgMedia = await MessageMedia.fromUrl(image);
                await client.sendMessage(msg.to, imgMedia, { caption: textImg });

                await result(high);
            } catch (error) {
                console.error({ error });
                await client.sendMessage(msg.to, 'erro na mídia');
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
    const toReply = JSON.stringify({ msg, info: client.info }, null, 4);
    console.log(toReply);
    await showSimpleInfo(msg);
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
        await protectFromError(async () => {
            await sendAsJsonDocument({ msg, chat: await msg.getChat(), contact: await msg.getContact() });
        }, msg);
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
    'emvideo': async (msg, [url]) => await urlAsVideo(msg, url),
    'leia': async () => await leia.startChat({ client })
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
    if (isNotString(msg)) return false;

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
    await client.sendMessage(msg.from, 'Executando, um momento por favor');
};
const isNotString = (msg) => typeof msg?.body !== "string";
const isToMe = msg => msg.to === myId;
const isCommand = msg => {
    if (isNotString(msg)) return false;
    return msg?.body?.startsWith(commandMarker);
}
const isDiga = msg => {
    if (isNotString(msg)) return false;
    const msgBody = msg.body?.toLowerCase();
    return (msgBody.startsWith('diga') || msgBody.startsWith('fale') || msgBody.startsWith('comente') || msgBody.startsWith('descreva') || msgBody.startsWith('explique') || msgBody.startsWith('bibot'));
}
const isCode = msg => {
    if (isNotString(msg)) return false;
    return msg.body.startsWith(codeMarker);
}
const canExecuteCommand = msg => {
    if (isNotString(msg)) return false;
    if (isCommand(msg)) {
        return isAuthorized(msg);
    }
    if (isLicensePlate(msg)) {
        return licensePlateSearch.includes(msg.from) || !!msg.fromMe;
    }


}
const canExecuteCode = msg => {

    if (isCode(msg)) {
        return !!msg?.fromMe && isToMe(msg)
    }
}

const extractExecutionInfo = msg => {
    if (isCommand(msg)) {
        const [, text, ...params] = msg.body?.split(' ').filter(Boolean);
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
        const command = funcSelector[text.toLowerCase()];
        if (command) {
            // await sendWaiting(msg);
            await command(msg, params);
        } else {
            await msg.reply(`Comando ${text} não encontrado`);
        }
    } catch (error) {
        console.error({ error });
        await msg.reply('Deu erro no comando. 😂😂😂');
    }
}
const codeToRun = (code) => {

}
const runCode = async (msg) => {
    try {

        exec(`${msg.body?.replace(codeMarker, '')}`, async (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                await msg.reply(jsonToText(err));
            }
            console.log(stdout);
            await msg.reply(stdout);
        });
    } catch (error) {
        console.error({ error });
        await msg.reply('Deu erro no codigo.');
    }
}
const observable = [leiaId];
const isObservable = msg => observable.includes(msg.from);

const keepSafe = ['556499736478@c.us'];
const isIdSafe = msg => keepSafe.includes(msg.from);
client.on('message_create', async msg => {
    if (isObservable(msg)) {
        await protectFromError(async () => {
            await sendAsJsonDocument(msg.rawData);
        });
    }
    if (isIdSafe(msg)) {
        await protectFromError(async () => {
            const chat = await msg.getChat();
            await msg.forward(await client.getChatById(myId));
            await msg.delete(true);
        });
    }
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

const sendAsJsonDocument = async (obj) => {
    const fileEncoded = Buffer.from(jsonToText(obj)).toString('base64');
    const fileAsMedia = new MessageMedia("text/json", fileEncoded, `${new Date().getTime()}.json`);
    await client.sendMessage(myId, fileAsMedia, {
        sendMediaAsDocument: true
    });
}
const prepareJsonToFirebase = (obj) => {
    if (!obj) return null;

    const keyReplacer = (key) => key.replaceAll(/[\.\#\$\/\]\[]/g, '_');
    return Object.keys(obj)?.reduce((acc, fullKey) => {
        const key = keyReplacer(fullKey);
        if (typeof obj[key] === 'object') {
            acc[key] = prepareJsonToFirebase(obj[fullKey]);
        } else {
            acc[key] = obj[fullKey];
        }
        return acc;
    }, {});
}