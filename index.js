require('dotenv').config();

const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
var QRCode = require('qrcode');

const { resolve, basename } = require('path');
const { promises: { readdir, unlink, copyFile, }, statSync, existsSync, mkdirSync, createReadStream } = require('fs');
const {
    origin = 'C:\\Users\\Fabricio Santos\\Downloads\\unigram',
    type = 'videos',
    lastFolder = '1661460463306'
} = {}
const filesPath = resolve(origin, type, lastFolder);
const MB_16 = 16777216;
const FILE_COUNT = 30;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
});


client.initialize();


const toMB = bytes => bytes / (1024 ** 2);

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
    const msgs = await Promise.all(await chat.fetchMessages({
        limit
    }));
    let rep = `${JSON.stringify({ limit, count: msgs?.length, chat: { ...chat } })}`;
    console.log({ rep });
    msg.reply(rep)
    const data = [];
    await Promise.all(await msgs.map(async ({ rawData, from, to, body, ...m }) => {
        data.push(`${{ rawData, from, to, body }}`);
        return await m?.delete(true);
    }));
    await chat.sendMessage(to, JSON.stringify(data));
}
const clearMsgs = async (msg) => {
    const chat = await msg.getChat();
    const msgs = await chat.clearMessages();
}
const clean = async (msg, folders) => {
    console.log({ folders });
    folders?.forEach(async (size) => {
        const folder = resolve(filesPath, `${+size}`);

        console.log({ folder });
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
    console.log({ toReply });
    msg.reply(toReply);
}

const groupInfo = async msg => {
    const chat = await msg.getChat();
    if (chat.isGroup) {
        msg.reply(`
                *Detalhes*
                Nome: ${chat.name}
                Descrição: ${chat.description}
                 Criado em: ${chat.createdAt.toString()}
                 Criado por: ${chat.owner.user}
                Participantes: ${chat.participants.length}
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
    await msg.delete(true);
    const msgs = await Promise.all(await chat.fetchMessages({
        limit: +size
    }));
    await Promise.all(await msgs.map(async m => await m.delete(true)));


}

const loveObj = {
    '!!teamo': size => `😘😘😘🥰🥰Eu te amo muito, mais do consigo dizer. Tive a ideia de usar minhas habilidades pra dizer tantas vezes que eu te amo que vc vai ficar enjoada de ler isso, então lá vai, vou escrever ${size} que te amo.😘😘😘🥰🥰`
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

const funcSelector = {
    '!!manda': async (msg, size) => await fileSend(msg, size),
    '!!status': async (msg, size) => await printStatus(msg),
    '!!clean': async (msg, folders) => await clean(msg, [...Array(7).keys()]),
    '!!groupinfo': async (msg) => await groupInfo(msg),
    '!!chatInfo': async (msg) => await chatInfo(msg),
    '!!del': async (msg, size) => await deleteMsgs(msg, size),
    '!!panic': async (msg) => await clearMsgs(msg),
    '!!last': async (msg, size) => await listMsgs(msg, size),
    '!!teamo': async (msg, size) => await loveMsg(msg, size)
}


client.on('message_create', async msg => {
    console.log({debug: JSON.stringify(msg)});
    if (msg.fromMe && msg.body.startsWith('!!')) {
        try {
            console.log('MESSAGE RECEIVED', msg);
            let size = +(msg.body.replace('!!', ''));
            let text = '!!manda';
            const bodyCtt = msg.body.split(' ').filter(Boolean);
            if (!size) {
                text = bodyCtt[0];
                size = +(bodyCtt[1]);
            }

            console.log({ text, size, bodyCtt, msg });
            await funcSelector?.[text]?.(msg, size);
        } catch (error) {
            console.error('falha', { error, msg });
        }
    } else {
        let size = +(msg.body.replace('!!', ''));
        if (msg.body.startsWith('!!') && isFinite(size)) {
            msg.reply(`Tem que pedir o chefe uai!!!
            Pode mandar nada desse jeito não`);
        }
    }
});

