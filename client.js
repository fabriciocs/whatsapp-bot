const dotenv = require('dotenv');
dotenv.config();

import beebot from './beebot';

const { Client, MessageMedia, LocalAuth, Buttons, Message } = require('whatsapp-web.js');
const { admin } = require('./db-config.js');
const { getVid } = require('./xv.js');
const { whatIsIt, readIt } = require('./vision.js');
const { inPortuguesePlease } = require('./translate.js');
const QRCode = require('qrcode');



const { resolve, basename } = require('path');
const { promises: { readdir, unlink, copyFile, }, readFileSync, statSync, existsSync, mkdirSync, createReadStream } = require('fs');
const {
    origin = 'C:\\Users\\Fabricio Santos\\Downloads\\unigram',
    type = 'videos',
    lastFolder = '1661460463306'
} = {}
const filesPath = resolve(origin, type, lastFolder);
const MB_16 = 16777216;
const FILE_COUNT = 30;
const puppeteerConfig = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROMIUM_EXECUTABLE_PATH };
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
                await client.sendMessage(msg.to, `Aguarde, baixando vídeo desse link:
            ${vidUrl}`);
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
    msg.reply(toReply);
}

const groupInfo = async msg => {
    const chat = await msg.getChat();
    if (chat.isGroup) {
        msg.reply(`
                Nome: ${chat.name}
                Descrição: ${chat.description}
                Criado em: ${chat.createdAt.toISOString()}
                Criado por: ${chat.owner?.user}
                Participantes: ${chat.participants?.length}
            `);
    } else {
        msg.reply('Só roda em grupo');
    }
}


const chatInfo = async msg => {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
        msg.reply(`
                *Detalhes*
                Nome: ${chat.name}
                Descrição: ${chat.description}
            `);
    } else {
        msg.reply('Só roda em chat normal');
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
            let msgText = `os detalhes que eu percebi: ${textRead.join(',')}`;
            await client.sendMessage(msg.to, msgText);
            const whatIsWritten = await readIt(vision);
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


const funcSelector = {
    ['status']: async (msg) => await printStatus(msg),
    ['detalhes']: async (msg) => await groupInfo(msg),
    ['chatinfo']: async (msg) => await chatInfo(msg),
    ['agague']: async (msg, [size]) => await deleteMsgs(msg, size),
    ['mandei errado']: async (msg) => await clearMsgs(msg),
    ['ultimas']: async (msg, [size]) => await listMsgs(msg, size),
    ['declaracao de amor']: async (msg, [size]) => await loveMsg(msg, size),
    ['putaria']: async (msg, [page, size, ...search]) => await sendVid(msg, page, size, search.join(' ')),
    ['o que é isso']: async (msg) => await showSimpleInfo(msg),
    ['amigo']: async (msg) => await showSimpleInfo(msg)
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
    const simpleList = last100.map((l) => simpleMsgInfo(l));
}


const external = ['556492026971@c.us', '556499163599@c.us'];
const commandMarker = '@bee-bot ';


const noAnswerMessage = async() => {
    const content = await MessageMedia.fromFilePath(resolve(__dirname, 'assets', 'noanswer.jpeg'));
    const options = {
        sendMediaAsSticker: true,
        sendSeen: true,
        stickerAuthor: 'github.com/fabriciocs@bee-bot'
    }

}

const fastAnswer = {
}
const sendFastanswerMessage = async(msg) => {
    const {content, options} = await fastAnswer[answerKey]?.(msg) ?? noAnswerMessage(msg);
    await msg.reply(content, options)
};
const isAuthorized = (msg) => msg.fromMe || external.includes(msg.from);
client.on('message_create', async msg => {
    const beebotContext = await beebot.processMsg(msg);
    await beebotContext.execute();
    // if(msg.body.startsWith(commandMarker)){
    //     await commmandContext(msg)
    // }

    // if (() && ) {
    //     try {

    //         const [text, ...params] = msg.body.split(' ').filter(Boolean);
    //         console.log({ text, params });
    //         await funcSelector?.[text.toLowerCase()]?.(msg, params);
    //     } catch (error) {
    //         console.error({ error });
    //         msg.reply('esse comando falhou idiota, kkkk');
    //     }
    // } else {

    //     if (msg.body.startsWith('!!')) {
    //         msg.reply(`Tem que pedir o chefe uai!!!
    //         Pode mandar nada desse jeito não`);
    //     }
    // }
});

