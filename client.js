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
const { promises: { readdir, unlink, copyFile, }, writeFileSync, readFileSync, statSync, existsSync, mkdirSync, createReadStream } = require('fs');
const {
    origin = 'C:\\Users\\Fabricio Santos\\Downloads\\unigram',
    type = 'videos',
    lastFolder = '1661460463306'
} = {}
const filesPath = resolve(origin, type, lastFolder);
const MB_16 = 16777216;
const FILE_COUNT = 30;
const puppeteerConfig = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true };
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
});


client.initialize();
const db = admin.database();
const toMB = bytes => bytes / (1024 ** 2);


const backup = msg => {
    const prepared = JSON.parse(JSON.stringify(msg));
    db.ref('bee-bot').child('messages').push().set(prepared);
}


const createContactSpace = msg => {
    db.ref('bee-bot').child(msg.from).push().set(prepared);
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

client.on('ready', () => {
    console.log('READY');
});



client.on('group_join', (notification) => {
    // User has joined or been added to the group.
    console.log('join', notification);
    notification.reply('User joined.');
});

client.on('group_leave', (notification) => {
    // User has left or been kicked from the group.
    console.log('leave', notification);
    notification.reply('User left.');
});

client.on('group_update', (notification) => {
    // Group picture, subject or description has been updated.
    console.log('update', notification);
});

client.on('change_state', state => {
    console.log('CHANGE STATE', state);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

function createFolderIfNotExist(outDir) {
    if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
    }
    return outDir;
}

function sliceIntoChunks(arr, chunkSize = FILE_COUNT) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

function getDestFileName(dir, file) {
    const filename = basename(file);
    return resolve(dir, filename);
}

async function copyAllFiles(dir, fileList) {
    const destpath = resolve(dir);
    createFolderIfNotExist(destpath);
    await fileList.map(f => ({ src: f, dest: getDestFileName(destpath, f) })).forEach(async ({ src, dest }) => {

        await copyFile(src, dest).catch(error => {
            console.error({ definition: { src, dest }, error })
        });
    });
}

const getFiles = async (dir) => {
    const dirents = await readdir(dir, { withFileTypes: true });

    const { files } = dirents.reduce((result, current) => {
        const res = resolve(dir, current.name);
        if (current.isDirectory()) {
            result.directories.push(res);
            return result;
        }
        if (current.isFile()) {
            const details = statSync(res);
            if (details.size < MB_16) {
                result.files.push(res);
                return result;
            }
        }
        return result;
    }, {
        files: [],
        directories: []
    });
    console.log({ obj: files.length });
    return files;
}

client.on('qr', (qr) => {

    QRCode.toString(qr, { type: 'terminal', small: true }, function (err, url) {
        console.log(url)
    })

});

client.on('ready', () => {
    console.log('Client is ready!');
});


const sendVid = async (msg, page = 1, size = 1, search = '') => {
    try {

        const vids = await getVid(page, size, search, puppeteerConfig);
        return await Promise.all(vids.map(async ({ high, image, url, title, low }) => {
            const result = async (vidUrl) => {
                const vidMedia = await MessageMedia.fromUrl(vidUrl);
                const text = `
            ${title}
            ${url}
            ${toMB(vidMedia.data.length).toFixed(2)}MB
            `;
                F
                return await client.sendMessage(msg.to, vidMedia, { caption: text });
            };
            try {
                return await result(high);
            } catch (error) {
                console.error({ high: error });
                try {
                    return await result(low);
                } catch (error) {
                    console.error({ low: error });
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


const fileSend = async (msg, size) => {
    const chat = msg.getChat();

    const folder = resolve(filesPath, `${+size}`);
    console.log({ folder });
    const files = await getFiles(folder);
    await Promise.all(files.map(async (f, i) => {
        const fullFile = resolve(f);
        const caption = basename(f);
        console.log({ fullFile, caption });
        const attachmentData = await MessageMedia.fromFilePath(fullFile);
        const text = `
        ${i + 1} - ${new Date().toDateString()}
        *Pega aí seus comédia*
        ${toMB(attachmentData.data.length).toFixed(2)}MB
        `;
        await client.sendMessage(msg.to, attachmentData, { caption: text });

    }));

};

const listMsgs = async (msg, size) => {
    const chat = await msg.getChat();
    const to = msg.to;
    const limit = +size;
    const msgs = await chat.fetchMessages({
        limit
    });
    let rep = `${JSON.stringify({ limit, count: msgs?.length })}`;
    console.log({ rep });
    const data = [];
    await Promise.all(msgs.map(async (m) => {
        await m?.delete?.(true);
        data.push({ from: m.from, to: m.to, body: m.body });
        return m;
    }));
    await client.sendMessage(to, data.map(({ body }) => body).join('\n'));
}
const clearMsgs = async (msg) => {
    const chat = await msg.getChat();
    const msgs = await chat.clearMessages(true);
}
const clean = async (msg, folders) => {
    console.log({ folders });
    folders?.forEach(async (size) => {
        const folder = resolve(filesPath, `${+size}`);
        const files = await getFiles(folder);

        files.forEach(async (f, i) => {
            const caption = basename(f);
            const toRemove = resolve(origin, type, caption);
            const exists = existsSync(toRemove);
            console.log({ caption, toRemove, exists });
            if (exists) {
                const attachmentData = MessageMedia.fromFilePath(toRemove);
                await msg.reply(`
            ${i + 1} - ${new Date().toISOString()}
            *Media info*
            MimeType: ${attachmentData.mimetype}
            Filename: ${attachmentData.filename}
            Data (length): ${attachmentData.data.length}`, { caption, media: attachmentData });
                console.log({ remove: toRemove });
                await unlink(toRemove);
            }
        });
    })

}

const printStatus = async (msg) => {
    const toReply = JSON.parse(JSON.stringify({ msg, filesPath, info: client.info }));
    await msg.reply(toReply);
}

const groupInfo = async msg => {
    const chat = await msg.getChat();
    if (chat.isGroup) {
        await msg.reply(`
                Nome: ${chat.name}
                Descrição: ${chat.description}
                Criado em: ${chat.createdAt.toISOString()}
                Criado por: ${chat.owner?.user}
                Participantes: ${chat.participants?.length}
            `);
    } else {
        await msg.reply('Só roda em grupo');
    }
}


const chatInfo = async msg => {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
        await msg.reply(`
                *Detalhes*
                Nome: ${chat.name}
                Descrição: ${chat.description}
            `);
    } else {
        await msg.reply('Só roda em chat normal');
    }
}


const deleteMsgs = async (msg, size = 60) => {
    const chat = await msg.getChat();
    const msgs = await chat.fetchMessages({
        limit: +size
    });

    await Promise.all(await msgs.map(async m => {
        return await m.delete(true);
    }));
    console.log({ msgs: msgs.map(({ id: { id }, body }) => ({ id, body })) });
}

const loveObj = {
    '!!teamo': size => `😘😘😘🥰🥰Eu te amo muito, mais do que consigo dizer. Tive a ideia de usar minhas habilidades pra dizer tantas vezes que eu te amo que vc vai ficar enjoada de ler isso, então lá vai, vou escrever ${size} vezes que te amo.😘😘😘🥰🥰`
}


const loveMsg = async (msg, size) => {
    const chat = await msg.getChat();
    await chat.sendMessage(loveObj['!!teamo'](size));
    const sendLove = async (n) => {
        if (n <= size) {
            await chat.sendMessage(`*${n}* - EU TE AMO DEMAIS 🥰😘❤️‍🔥💓💘💝`);
            return await sendLove(n + 1);
        }
    }
    await sendLove(1);
}
const quotedToNew = async (msg) => {
    try {
        return new Message(client, {
            id: { _serialized: msg?.id?._serialized },
            hasMedia: true, // --> IMPORTANT
            clientUrl: true, // --> IMPORTANT
        });
    } catch (err) {
        console.log({ quotedErr: err });
        return await msg.reload();
    }
}
const showSimpleInfo = async (msg) => {

    try {

        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const vision = Buffer.from(media.data, 'base64');
            const res = await whatIsIt(vision);
            const [{ labelAnnotations }] = res;
            const details = labelAnnotations.reduce((p, { description }) => p.concat(description), []);
            const textRead = await inPortuguesePlease(details);
            await client.sendMessage(msg.to, textRead?.join(','));
            const whatIsWritten = await readIt(vision);
            const [{ fullTextAnnotation }] = whatIsWritten;
            await client.sendMessage(msg.to, fullTextAnnotation?.text);
            const fileEncoded = Buffer.from(JSON.stringify(fullTextAnnotation.pages)).toString('base64');
            console.log({ fileEncoded });
            const fileAsMedia = new MessageMedia("text/json", fileEncoded, `${new Date().getTime()}.json`);
            await client.sendMessage(msg.from, fileAsMedia, {
                sendMediaAsDocument: true,
                caption: 'Abra o arquivo para mais detalhes'
            });


        }
    } catch (err) {
        console.log({ quotedErr: err });
        await msg.delete(true);
    }
};


const showSimpleMeaningInfoFromMedia = async (msg) => {

    try {

        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const vision = Buffer.from(media.data, 'base64');
            const res = await whatIsIt(vision);
            const [{ labelAnnotations }] = res;
            const details = labelAnnotations.reduce((p, { description }) => p.concat(description), []);
            let msgText = `os detalhes que eu percebi: ${details.join(',')}`;
            await client.sendMessage(msg.from, msgText);
            const whatIsWritten = await readThisImage(vision);
            const [{ fullTextAnnotation }] = whatIsWritten;
            msgText = `consegui ler: ${fullTextAnnotation?.text}`;


            console.log({ msgText });
            await client.sendMessage(msg.to, msgText);
            const fileEncoded = Buffer.from(JSON.stringify(fullTextAnnotation.pages)).toString('base64');
            console.log({ fileEncoded });
            const fileAsMedia = new MessageMedia("text/json", fileEncoded, `${new Date().getTime()}.json`);
            await client.sendMessage(msg.from, fileAsMedia, {
                sendMediaAsDocument: true,
                caption: 'Abra o arquivo para mais detalhes'
            });


        }
    } catch (err) {
        console.log({ quotedErr: err });
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
            await client.sendMessage(msg.from, txt ?? 'resposta vazia');
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
                await client.sendMessage(msg.from, dataAsMedia);
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
const writeToMe = async (msg) => {

    const songTypes = ['VOICE', 'AUDIO', 'PTT']
    if (songTypes.includes(msg.type?.toUpperCase())) {
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
    }
};

const readToMe = async (msg) => {

    const songTypes = ['VOICE', 'PTT']
    if (songTypes.includes(msg.type?.toUpperCase())) {
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
    }
};

const createAText = async (msg, prompt) => {
    const response = await inEnglishPlease(prompt);
    const result = await writeAText({ prompt: response[0] });
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await msg.reply((await inPortuguesePlease(answer))[0]);
    } else {
        const { content, options } = await noAnswerMessage(msg);
        await msg.reply(content, options);
    }
};

const createAnImage = async (msg, prompt) => {
    await protectFromError(async () => {
        const generations = await giveMeImage(prompt);
        await Promise.all(generations.map(async (g) => {
            if (g?.generation?.image_path) {
                await msg.reply(await MessageMedia.fromUrl(g?.generation?.image_path));
            }
        }));
    });
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
    'detalhes': async (msg) => await groupInfo(msg),
    'chatinfo': async (msg) => await chatInfo(msg),
    'agague': async (msg, [size]) => await deleteMsgs(msg, size),
    'mandei_errado': async (msg) => await clearMsgs(msg),
    'ultimas': async (msg, [size]) => await listMsgs(msg, size),
    'amo': async (msg, [size]) => await loveMsg(msg, size),
    'xv': async (msg, [page, size, ...search]) => await sendVid(msg, page, size, search.join(' ')),
    'que?': async (msg) => await showSimpleInfo(msg),
    'amigo': async (msg) => await showSimpleInfo(msg),
    'o_que_da_pra_fazer': async (msg) => await helpMsg(msg),
    'escreve': async (msg) => await writeToMe(msg),
    'placa': async (msg, [placa, full]) => await searchByLicensePlate(msg, placa, full),
    'elon_musk': async (msg, prompt) => await createAText(msg, prompt?.join(' ')),
    'elon': async (msg, prompt) => await createATextDirectly(msg, prompt?.join(' ')),
    'diga': async (msg, prompt) => await createAudioDirectly(msg, prompt?.join(' ')),
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

const myId = '556492026971@c.us';
const external = [myId, '556499163599@c.us', '556481509722@c.us'];
const commandMarker = '@';
const codeMarker = '@run';

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
        const fileEncoded = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCABkAGQDASIAAhEBAxEB/8QAHQAAAgICAwEAAAAAAAAAAAAABgcABQQIAgMJAf/EAEYQAAEDAwMCBAMDBwgJBQAAAAECAwQFBhEAEiEHMRMUQVEIImEycYEVIzNCYpGhCRZDUoOj0fAXNGRzgpKx0uGUosHC8f/EABwBAAIDAQEBAQAAAAAAAAAAAAQGAwUHAggAAf/EADYRAAECBAQDBQcDBQEAAAAAAAECAwAEESEFBhIxQWFxEyJRkaEHFCOBsdHwMjPhFVKSouLj/9oADAMBAAIRAxEAPwDSnqZLcbosJiM6UsBTaFY3AlXhncDnv/503ehsymo6YUlEqVGQ4lT+Q44kHHjL9DpWdX6a0xQoM5OM+ZDI28AjYo/v4GnL8PDPi9KaYr2dkj+9Vpjya9peqTWx+ogicQEu2FLD6QTLm0kj5ZUU/UKSddCplM5HmY3/ADJ0Rrhozyga6F05og/m0/u1scrOkiAiKQPeLAdOEux1EnAAUkknRBTem9QqJ8w+ER0FOAlSOfv+mu6juQqZVkvPUWTUHGmVyGGI6E/OtBHBJ4HBzzxx+9o0u5G6lTGHkQg068neW0LS6lIPYhaeD3H1HqBrKvaBnuewyY/p+GEJUACpdAaV2ABttcmhhty9g0vNo94mrjgNq08TCsmdOXIySW3ULPuEaHZNH8q4WnGkBQ7ggadkiW6kLU40haE89tL+vPU2dJcUpIbWASk9udLuWvaRjLE0hGIuB1sm9UgEcwQB5EQfimByZbJl0aCOZI+dYDRAbH9G3z9NV9UYjsKiLcLTafMYJVgD7C9XiykK51g1BSQ/AP8AtOf7tet4mH9aaiEQWjEMiktgFUyGP7RP+OuCZ1FGd1ShD+2T/jq3U4k9sa4LfHGDqDtiBHRVSBar1ShmSnbUoR/Njs6k+p+uprOrL6PMoyr+jHr9Tqar1unUftHOqFh8Q/Va379hRKVQrfcp6YslD5WvYCsBpSSNqe3Kh6n8NNv4aG/E6SQFe0mSP7w608kNyktIdf8AFwfVWfb663J+FxIc6RRCf1Zkof8AvzrNcHmO0mEBI/SmnrEzwUk0VDHVGP8AV411rij29NckVykTBIagTmJjrKVZaaWFFWB2Hv7caoOn9OboltMsSnwl6W45JS0o8oCjwkA9uB2986e5Bx1bobQkmoJ6UpFa5NNtkalCnXj4QU2H1Gp06rv2TFoEON5UnxqhKklCpvzkOIbaUj59uCNwUOR24J0X1uu0yLlmAGm84R4iPtkD0+7nSuehYqvm31wjEirEyOXXFeIl/POCpXA+UcJwO/1zgVC+paY4UtpnxVFWCkZOM8H/AM6875llSjGH1LB1lRrU16enlGtYZNFUm22CCABQ7Rf1WdVqmuVFpNQPmj4aUpS4EqbSVgLdG7glKc8EEc8pVjGhW95cSmV1+hUmTMqbsZKPHec8IL8QjkFKAEgg5GAB2/HWNQZVyVJE9uJWU0qO8jMx5UdpZDY9ApY+X6nOPXGh+LJs43CmlW7UfOSvELz8vcfDWQQSlCv11H6cYzzr7AcNdxTEmpVsElRAoOZG52iLGsRawrDXZp1QASCb8h5x1fzlugcDp3WV4Hcusf8AfrokVu7ZDjCk9PKskMuFzl9jn5VJx9v9rTBDgPbvr7uzr28jK0uhIRrVbp9o8dq9qOKEk9kj/b7wA/lu7+46eVTn3lx/+/XH8rXkrt07qH/rY4/++mDq0tm1rjvOsNW/alEl1WovcojxkbiE5AKlHshIJGVKISPU6jdy3JMoLjrhCRuTpAHU0j9b9peMTCw20ygqOwAUSfWEnVpt6rkpUrp/KT8g4M6P7n9rU1t7V/g36iw1xhXq7RqfKejpdMZO98tglXClAAbuDnbkfU6mkh7E8spcKRN/n+MOLOKZscQFGVAJ5f8AUedN+W63SrciS0vrWXH0IIKAO6FHP8NbD/DTJiw+ifnZzalsR5kpxYSMnAUDjHr92lT1lioYsSnOBIGZrIz/AGTmml8Mk2PF6TRmZjiEokVOQwgK7LUcfLrE8pdpMK7m941rGQlt2+1BBPK6y2ylxbQZkJSlHCnG8YOO2Addlt1amVtp2rxVI8u3hsc9iBk5B+zjPH0Ok71eg0yiXS7SqNSKnCRs8Vby1EMqJ5/NYPKeQOT341zsOszokVxsMJfZm7QtC1KQlakkgEgYOB68jP4aecCzZNYc87ITbaam2pNjTyJobVv8oR53CUzcwh9xRVpNQkmwPA02tDYmJoV3QZSVbkJhLUESVZSkEdyCDynjkH/A6UT92oZqUmGwwZLsN1Ufxkn8yracZCvbjV7eVwzadQi60tD0twhmJFaRtabWo4SEp9SPTP0554XlcptRotIoFKfVIZipdmplOoa3KkTNwJUMkFSTjantwknuSNUWZGZPFVh0o76d1bV5U/DDbhWKTMsjswqx/LRl3DdVWqLApr9RcUxv3qaScNbvTj1PsTk6IKLbC4MNuS4VCWcLBBwUH0A+vb8dV3T23XajMFRqTSkIiHcEEcJX6Z9yO5x9B75YL6FJaBaaSolzKRnBOOQP4aCwuUQwA4gU8KfWBMSnVvq0LNfGv0i5gz5IYQXwhxQSAop4JOOf88atWXmnRlB59jxqgbeQy13GQMc/9dCFw3rKbkeXpzgbDWCVg8k/4DWqYVnqfk6JmviJ52V58fnGWYpkOQxCqpX4a+V0nqPtD96YdN7g6rXhEs+3GwHX8uSJC0ktxWEkb3V49sgAepIHrr0JoNrdOvhp6euKpkBwhJbbdcbb8SdVZajtbbGOVrWpWEpHypz6DJ1rx/Jm3bbVxWxdcFyMEXXGksOS3jj89CUjDWwem1xLu4Y7rTzyAH9e9Za/nzWLjmRFz6b0vt52sohpUU+PUXm3SDntuRHZUE5Bx5on20uZuzO7maf90bqJdAB07FRtv1UQkcBvFplnK6Msyfbu0Mws01bhI5dACT47QuOoVK63XDWI9YrF30+1HJMRK26RFpzc3yrW9e1LjyyN7nfcUgJ9BnGTNB92/ExXLlmQ6o10+o5bdgsqT4F3xF4CgV7VhaUKQsb9qklPBB76mqRWFYyg6Qw2OXwjT5kk+ZJ8Yu0YphSkhRdWefxL+Qp5RoR1k6d1BiDblv1SFUF0+VXIUTzrcRaGntyFgpbcVhBV3GM54Ptosm2zRLLotNotvBiHSWpfnlNLfy62o91fOoqPIA41z+J2/J9c+FKwH0pW1IRXhKEpDu1QcT5vbtA5GMjn3Gl/R7Wq1Ss5h7qzUqvIqDSlyxFebTKAaGCkAYylZSD2OcHv3GpMm9lhs683LtgpqdOq+k1sKgHcV6xc5k7WfWhZc0gWI8Yt77/mld4ej1K9I6nmEqUw2W95bST2bLauDjGdySTj20O2vCahRY7WVBDbaclZ5B25JP459PXVHHul2rw/JxGEsthRYDZQEkIGAkEY4+XHH3/dogZfbaeQk8JUoJUcZwhPKv4A6inJmTnJ5S5ahpYqAIB6VJNucQMh0IPaC8YT0pVa6g0qkoO5uC6p54Y7LSEk5/4ltjP7Gs7qsJcmp0Gjow4uRJckNgIPyBtO0jknOS7n7+wGhbp7KTOvVE96UlpT0XxUhSgCsrWXFAZ78qHb20xX6W5KvVdZkDLcSC1Gj59HCta3FY+4tfu+mhQkzDJI4n89ILUsSyhXgPWObaKfa9AQzIeDacDxV8kqUfQAAknnGBydSDPaqJdUpl6Mto/oXx84z+seT37dzjBGhfqHUaimrwW4MJ6UmKw8/tbQVAPYw2T6A5z39CdK25qzctRrEKVUW3kOxEpC1CJtQpXqc8gfhj17Z1OVJZAA4WgNKS9VR43h61GbsYVsV8xyOP8AP3aEZ0XahLikfa4JxqttO4pVXbWwtJUWQlOFdz/nGr2sb3I4LnZBHA9NEJOoViPT2aqQ/P5O683LR+JGn06Q+luJcFMm055SzgJCWzIT+O5gD8Trf63b7sytUS/rrcrFVh0m7Kv5KnTYsKQmU4gUlj84wgNlz5UtvOBQTgBBV215QdDbjcs3rHZVyBQLMOuQ/Hz2LCnEocH4oUofjr2Wp/SqiudP7fsaveI+i32G2o70Z9xlaVJZWwVJUkgjc044k/RZ1XTSpZhRW7WqtItTYGp3FzUJ/mJ1tvvhPZUomu/ibD0JjUy8ugnSC7LgfqSep9YrkhlKIkqS46w0sOtJCAlQ8IbjsCDv/WznJznU04OqnRfpgLgjJdtCE9iJuBdSVkbnnVEAk9sqOB6amjzmp4WRNOgcBRFvUfSKtOWmiKrl2yeqv5jxRufrfdV7dPKT02qUSnN0ujO+ZjrZaWHlLG/7Siog/pVdgPTTJbuJ5iz4cFBXVG40PZEcfdWSW1YPzJQU7sDIB7jScqNPZj2tGnpgNsuuuJSVAHJGFe/3aanTtmbG6P0+rilRpEc1CU0qQtpW5pW4BIUpJztyTj0zx66WcPnn5da5thZTpqTatdtxfrDRikmldELvx8IxqJHRNkRXVtLbdSlSilSAABnA9TjnPBOcavlZTJwBnCXR9/yK10UeW5NeLrrDLRS54ZS0nG0D7yfrzq7tyjVG57ipdtUURVzqzVo9Oh+Ze8JpT0hwMtpUvB2hS1pTnB5I1bMuIeb96ApqvsBsKbC3CK1AKB2Zio+HirW8KdMg1K2aLU5IWFodnRg460AkDCFcFI5550a1mtMCVJnNxI8dvKWmmGQUo3YCUhOSe5+v8NAnTHo51Ct6nzb7nWpUG4ki8HLFjJ8ZsKFZCc+VUnduyT8m/G3cNuc6MGumHU24J1+VuLRGHqJ0anOQ7kealhSDMC3W3SwSkB9LDba3F4wUpO7B+XMcq7KspChQKO8STSXnTp4RgSVBiOVOrKlryVkepPt/ntoHrrobC3EIHPYnTPp/T66rlk2wx+ULVo7N4xp8qhSK3X2oLUnyk0Q3GsrH6ZTqvkbGSpIUeMY0Cdb7Kq/Sapu2zcFwWnUKlHcebmNUKttVEwXWlltxiSEAFl0KBGxQz8qvbRSpxknQlV4Hbl1i5ECvT6eF1uoxXFYWrw1px7YIP/xphVFgmKsAjt3I0JVno/1I6RybHvC9qYxDp3UKlrn0ktyA4othDTpQ6kYLTmx5he0/quJ+oBE9NkSoXgxg0XBydxPI1JKupdRVJj9mmyhYMYlut+JclJYK1Auz46dye6SXBzr2q679bqH0NtFFcqMVc2oTlqYpsJCtpecAySpX6qE8bjg9wO514jRZ0mnT400tFD8aQ28gfaBUlQIx79tepdq9TOivxlW7TLM6muKol201zxGm2XwwXnCNqvLrWCFBYAy2oFXAxnbu0YxhSZp1E9NNqXKtn4mi5AO1t6WueA+UCTk8plgy0ssJeWDo1bVt6+Eak9Rer3VrqJcztz1G4av4j6AlLUFx1phhIJIbQhBwAM+uSe5JJJ1Nb6Vvp5aXTdNPtW0qWiJAjw0qwTvW4srXuWtR5Uo4HJ9gBgADU1dO+0PD2llErIp7MWTWgNOFtJp5mKRrKM8tAU/NnWd99+PGPCy4rlZqdt0+ktx3EuRfDytWMKACh2/HWwPQypop3R9mkSLffq1OlOyVOyk4EYbz8zas/MFA8du/Y+ukVedsQaRb8SdGWStbraFZHoUKP/UafnReqNUr4bozaiFO1GfLjtpIGOXDuV+AB/HGkLKzjZLikf2qofA9OIrwjRcYSttfeO1IHWoCIrkluAxJQlxZ2eIC4pKPQbwACfrrCRVkQW5CY1bRS58Z1JiyS6G1sSEYW06kk/aQsJUPYgavalORToinFKXwCEpTySfu0X/BzfFCsbqN1DvK4aRCqsWkdNLimqpc8pbRUVIVFX5b5xglxKCjGDwTwdWUypEoxRCbDhwvC/L633DUwwax8cVi0PqG7XJPTCoRrcepxqMW23HYxUi8vPqqX5VUrxtvgeO4pBUTv2j7H6ugfpF8SlodMbQtG3pNhwbhj0qRPrF4yp1Sc8zVZdTK49QWyyxLEdwCAW2m1S0HKsna1kqLOt6tdDrf6a1Xp702ulivR4XUSxa29XJyCxIebkVrDUQpdCVERokdjxT28V188cjXZe1W6S3RSP8ARXekqkwoty9Vr+mQbnZWhS6BLZqjAiPO4P8AqTwkONO5GAlSHAQGtwXdTWqmg06/xFtRdN41zqvV+06pRelNGtuBWFw+mT9RXJXPciB+ZGcrBmtFIbeUN4Z2he4pSF9iR82g28r/ALGvbrFX7zuOHUFWpcN6zq9MgsrYM78nSai5IUyB4gbDxZXt/SYCj3ONbSddunVR+IFu+LR6Uv0apVii9ULodnRjVocVTECdHiJZm5edQFxwuO6lSkbiCCMcHWafiLrbHWH4kpXTzqGli1127cNat9bC2DHcqTKoTDcqOSCFkhCygglK0kKAIOpm3aI7g4Hj4npHBTU3hNdV/jCs3rLbF021cPTVqiT512QbmtqbTJjr6WX0oEN9E3zEhQbSYCWkJTGSlsLaSSjABAPG/KDmx+NFQ6hQyFB4YUPf2PGtrOmNa6l3R8LlIn2hc15yrtl3Bc8ypP2/ctBpS3JLzram3JyKjguIUveQGcEDfnunWqtqbRAgrirPg+C2AhQKto2j17/x1YYWsJKm6UpAs6KpCo5ritOJzHrDVOWtW6U25tWl35d4BO4YHCRxxk5OeNFkd9mOEmJMbVvOWw0QDk5GQAeOQPwI9xrBkwGVRVT6rcZpsMuBDZCC84tY9kgZ4/H+Orh3pFXZrNMXBqy3FSg2thySytltYVhSSkgH9nj/APNbjkd1UsFpTpSFBJ7xoTSvDvED5CvOMzxOk0+ELXsqhISSkE0sVaab23ttBWr4lutlKYjU9i/qg80w0EtmUlEhaU5OE73ApWB6DOB6amgOs/DxeMeWEOinhSk7sJdWAMk8fZ1NXsxJYS46papeXqT4/wDnDW1IuoQE61W6/eFf1PZaTacAITtzJbzj/dr0TdNp8hfTygwCR4MYSlNp/aXIXuJ+vA/cNTU15UyuSEK+f1EP2YP3D0EY1z1CQQrG0bAcYH0zoQsBXnH6iuUhLpEhtY3jOFfNyPbU1NMM0TrSOcL0r+kwzUIjvN7nocdwpTtBW0DgHv8Av18WiO0254UOOjejara2BuAGAD7jHpqami07QCsm8DtShwXYyEuQY6ktnKElsFKfuHpqqdYZdUd7SDsVlOR2PvqamuIKRtFHWafDdktrcjtqUe6ikEnTHtNZTSmikAYGBx6Y1NTXyLLtHT/7UYd0OE/OQNwOP463bsZ5LtlW4tyMypQpcVQJT2JZTkjnjvqammXAFKS6uh4COGx3BGLdDw8+2fBb5ZHof6yvrqampq6ccXqNzBEf/9k=', 'base64');

        const content = new MessageMedia("video/mp4", fileEncoded, `${new Date().getTime()}.mp4`);
        await msg.reply(content, {
            sendMediaAsSticker: true,
            sendSeen: true,
            stickerAuthor: 'github.com/fabriciocs@bee-bot'
        });
    } catch (err) {
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
        const params = extractCodeInfo(msg);
        console.log({ code: params });
        await msg.reply(eval());
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

