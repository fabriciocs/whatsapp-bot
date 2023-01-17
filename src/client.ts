import { resolve } from 'path';
import { config as dotEnvConfig } from 'dotenv';
dotEnvConfig({ path: resolve('.env') });

import * as puppeteer from 'puppeteer';

import { SpeechClient, protos } from '@google-cloud/speech';

import * as QRCode from 'qrcode';
import { Buttons, Chat, Client, LocalAuth, Message, MessageContent, MessageMedia, MessageSendOptions, MessageTypes, RemoteAuth } from 'whatsapp-web.js';

import dbConfig from './db-config';
import { loadPersonAndCar, sendResponse, startChat } from './leia';

import OpenAIManager, { createVariation, editImage, editingText, giveMeImage, withConfig, writeAText, writeInstructions } from './ai';
import CurrierModel from './currier';
import { tellMe } from './textToSpeach';
import { readDocument, whatIsIt } from './vision';
import * as child_process from 'child_process';
import Commands from './commands';
import Contexts, { Context } from './context';
import { CompressionType } from '@aws-sdk/client-s3';
import CommandManager, { CommandResponse, StepFunction } from './commands-manager';
import MessagesManager from './messages-manager';
import { Database } from 'firebase-admin/database';
import { Storage } from 'firebase-admin/storage';
import Wikipedia from './wiki';
import { keyReplacer, baseName, ChatConfigType, commandMarkers, botname } from './util';
import SessionsManager from './sessions-manager';
import ChatConfigsManager from './chat-configs-manager';
import CommandConfigsManager from './command-configs-manager';
import Wordpress from './wordpress';
import { writeFile } from 'fs/promises';
import { Intent } from './dialogflow/intent';
import AgentTranslation from './dialogflow/agent-translation';

const myId = '120363026492757753@g.us';
const leiaId = '551140030407@c.us';
const appData: {
    commands?: Commands,
    contexts?: Contexts,
    msgs?: MessagesManager,
    defaultSteps?: Record<string, StepFunction>;
    sessionManager?: SessionsManager;
    chatConfigsManager?: ChatConfigsManager;
    commandConfigsManager?: CommandConfigsManager;
} = {
};


const puppeteerConfig: puppeteer.PuppeteerNodeLaunchOptions & puppeteer.ConnectOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true };
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
});

let db: Database = null;
let storage: Storage = null;

const backup = async (msg: Message) => {

    if (!db) return;
    const ref = db.ref(baseName);
    let media: MessageMedia;
    if (msg.hasMedia) {
        media = await msg.downloadMedia();
    }
    const prepared = prepareJsonToFirebase(JSON.parse(JSON.stringify({ msg })));
    const allMessagesRef = await ref.child(`${keyReplacer(client.info.wid.user)}/messages/${keyReplacer(msg.from)}`);
    const msgRef = await allMessagesRef.push(prepared);

    if (!storage || !media) return;
    const f = await storage.bucket().file(media.filename ?? msgRef.key);
    const url = f.cloudStorageURI;
    await f.save(Buffer.from(media.data, 'base64'), { contentType: media.mimetype });
    await allMessagesRef.child(msgRef.key).update({ mediaUrl: url });
}

const sendAnswer = async (msg: Message, content: MessageContent, options: MessageSendOptions = {}) => {
    if (await isAudioMsg(msg)) {
        return await onlySay(msg, null, `${content}`);
    } else {
        await (await msg.getChat()).sendMessage(content, { ...options, sendSeen: true });
    }
}

const sendReply = async (msg: Message, content: MessageContent, options: MessageSendOptions = {}) => {
    if (await isAudioMsg(msg)) {
        return await onlySay(msg, null, `${content}`, true);
    } else {
        try {
            await msg.reply(content);
        } catch (e) {
            await (await msg.getChat()).sendMessage(content, { ...options, sendSeen: true });
        }
    }
}


client.on('loading_screen', (percent, message, ...rest) => {
    console.log('LOADING SCREEN', percent, message, rest);
}); 1

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});


client.on('ready', async () => {
    const fullBaseName = `${baseName}/${keyReplacer(client.info.wid.user)}}`;
    appData.commands = new Commands(db.ref(`${fullBaseName}/commands`));
    appData.contexts = new Contexts(db.ref(`${fullBaseName}/contexts`));
    appData.msgs = new MessagesManager(db.ref(`${fullBaseName}/messages`));
    appData.sessionManager = new SessionsManager(db.ref(`${fullBaseName}/sessions`));
    appData.chatConfigsManager = new ChatConfigsManager(db.ref(`${fullBaseName}/chatConfigs`));
    appData.commandConfigsManager = new CommandConfigsManager(db.ref(`${fullBaseName}/commandConfigs`));
});

const siteToData = async (msg: Message) => {
    const wp = new Wordpress(curie).Api;
    const pages = await wp.pages({ per_page: 1000 });
    const sections = pages.map(p => p.content.rendered.replace(/(<.*?>)|(\r+)/g, '').replace(/\n+/g, '\n').trim()).filter(s => s.length > 0);
    await sendAsTextDocument(sections.join(';\n'), undefined, 'text/csv');
    console.log('READY');
}

// const t = async (msg: Message) => {
//     const acc = new Wordpress(curie, 'https://accg.org.br/wp-json');
//     const posts = await acc.Api.posts({ per_page: 1000 });
//     const users = await acc.Api.users({ per_page: 1000 });
//     const media = await acc.upload('https://accg.org.br/wp-content/uploads/2022/11/SITE_7532022_SDI_-_DIVULGACAO_DOACAO_DE_BRINQUEDOS-1024x670.png');

//     const post = await acc.Api.posts().create({ title: 'Teste', content: 'Teste', featured_media: media.id });
// }
client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

client.on('qr', (qr) => {
    QRCode.toString(qr, { type: 'terminal', small: true }, function (err: any, url: any) {
        console.log(url)
    });
});
const listMsgs = async (msg: Message, size: string | number, params = []) => {
    const msgs = await appData?.msgs?.filterByFrom(msg.to, +size);
    const msgKeys = Object.keys(msgs) ?? [];
    if (params.length && msgKeys.length) {
        const joined = msgKeys.reduce((acc, upKey) => {
            const msg = msgs[upKey];
            return Object.keys(msg)?.filter(key => params.includes(key))?.reduce((acc, key) => {
                return `${acc}${msg[key]}\n`;
            }, acc);
        }, "");
        await sendAnswer(msg, joined);
    }
    await sendAsJsonDocument({ msgs });
}

const clearChat = async (msg: Message) => {
    const chat = await msg.getChat();
    await chat.clearMessages();
    await msg.delete(msg.fromMe);
}
const printStatus = async (msg: Message) => {
    const toReply = JSON.stringify({ msg, info: client.info }, null, 4);
    console.log(toReply);
    await showSimpleInfo(msg);
}



const deleteMsgs = async (msg: Message, size = 60) => {
    const chat = await msg.getChat();
    const msgs = await chat.fetchMessages({
        limit: +size
    });
    await Promise.all(msgs.filter(({ id: { id } }) => id !== msg.id.id).map(async (m: Message) => {
        try {
            const reloaded = await m.reload();
            if (reloaded) {
                await reloaded.delete(reloaded.fromMe);
            } else {
                await m.delete(true);
            }
        } catch (e) {
            console.log({ deleteMsgsError: e, msg: { body: m.body, id: m.id } });
        }
    }));
}



const showSimpleInfo = async (msg: Message) => {
    if (msg.hasQuotedMsg) {
        let quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg) {
            return await showSimpleInfo(quotedMsg);
        }
    }
    try {
        await protectFromError(async () => {
            await sendAsJsonDocument({ msg, chat: await msg.getChat(), contact: await msg.getContact() });
        });
        if (msg.hasMedia) {
            await protectFromError(async () => {
                const media = await msg.downloadMedia();
                const vision = Buffer.from(media.data, 'base64');
                const res = await whatIsIt(vision);
                const [{ labelAnnotations }] = res;
                const details = labelAnnotations?.reduce((p, { description }) => description ? p.concat([description]) : p, [] as string[]);
                await client.sendMessage(msg.to, details?.join(',') ?? 'não consegui identificar');
                const whatIsWritten = await readDocument(vision);
                const [{ fullTextAnnotation }] = whatIsWritten;
                await client.sendMessage(msg.to, fullTextAnnotation?.text ?? 'não consegui ler');
                const fileEncoded = Buffer.from(JSON.stringify(fullTextAnnotation?.pages ?? [], null, 4)).toString('base64');
                const fileAsMedia = new MessageMedia("text/json", fileEncoded, `${new Date().getTime()}.json`);
                await client.sendMessage(myId, fileAsMedia, {
                    sendMediaAsDocument: true
                });
            });
        }

    } catch (err) {
        console.log({ quotedErr: err });
    } finally {
        await msg.delete(msg.fromMe);
    }
};


const helpMsg = async (msg: Message) => {
    await protectFromError(async () => {
        try {
            const text = Object.keys(funcSelector).join('\n');
            await sendAnswer(msg, text);
        } catch (err) {
            console.log({ helpError: err });
            await msg.delete(msg.fromMe);
        }
    });
};
const searchByChassiGo = async (msg: Message, chassi: any) => {
    const browser = await puppeteer.launch({ ...puppeteerConfig, headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://www.detran.go.gov.br/psw/#/pages/conteudo/gravame', { waitUntil: "networkidle2" });


        await page.click(`button.mat-raised-button.mat-primary.ng-star-inserted`);
        await page.focus('input[formcontrolname="chassi"]');
        await page.keyboard.type(chassi);
        await page.click(`button.button-primary.notranslate.mat-raised-button`);
        try {
            const r = await page.waitForResponse((response: { url: () => string | string[]; status: () => number; }) =>
                response.url().includes('www.detran.go.gov.br/psw/rest/gravame') && response.status() === 200);
            const txt = JSON.stringify(await r?.json(), null, 4);
            console.log({ txt });
            await sendAnswer(msg, txt ?? 'resposta vazia');
        } catch (err) {
            console.log({ semGravame: err });
            await page.click(`button.button-primary.notranslate.mat-raised-button`);
            await new Promise(r => setTimeout(r, 4000));
            const screenshotData = await page.screenshot({ encoding: 'base64', fullPage: true });
            const dataAsMedia = new MessageMedia("image/png", `${screenshotData}`, `${new Date().getTime()}.png`);
            await client.sendMessage(msg.from, dataAsMedia);
        }

        await page.close();
    } catch (err) {
        console.log({ page: err });
        await client.sendMessage(msg.to, JSON.stringify(err, null, 4));
        await sendAnswer(msg, `falha na consulta dados extras ${chassi}`);
    }
    await browser.close();
}
const protectFromError = async (anyFunc: () => Promise<any>) => {
    try {
        return await anyFunc?.();
    } catch (err) {
        console.log({ runtimeError: err });
    }
}

const searchByChassiDf = async (msg: Message, chassi: any) => {
    const browser = await puppeteer.launch({ ...puppeteerConfig, headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://www.detran.df.gov.br/wp-content/uploads/2020/10/html_consulta_sng.html', { waitUntil: "networkidle2" });

        await page.focus('input[name="CHASSI"]');
        await page.keyboard.type(chassi);
        await page.click(`input[type="submit"]`);
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
                const dataAsMedia = new MessageMedia("image/png", `${screenshotData}`, `${new Date().getTime()}.png`);
                await sendAnswer(msg, dataAsMedia);
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
        await sendAnswer(msg, `falha na consulta dados extras ${chassi}`);
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
const searchByLicensePlate = async (msg: Message, placa: any, full = false) => {
    try {
        // let vehicle = await axios.get(`https://apicarros.com/v2/consultas/${placa}/8e976a5c05bd3035c75efa7b459296bd/json`);
        // if (full) {
        //     await sendAnswer(msg, JSON.stringify(vehicle.data, null, 4));
        // }
        const chassi = placa;
        const uf = 'GO';
        if (chassi) {
            try {
                if (uf === 'GO') {
                    await searchByChassiGo(msg, chassi);
                }
                // if (uf === 'DF') {
                //     await searchByChassiDf(msg, chassi);
                // }

                // const extra = await axios.get(`https://www.detran.go.gov.br/psw/rest/gravame?chassi=${chassi}`);
                // await client.sendMessage(msg.from, JSON.stringify(extra?.data ?? {}, null, 4));
            } catch (err) {
                console.log({ extra: err });
                await client.sendMessage(msg.to, jsonToText(err));
                // await sendAnswer(msg, JSON.stringify(vehicle.data, null, 4));
                // await sendAnswer(msg, `falha na consulta dados extras ${uf}-${chassi}`);
            }
        }
    } catch (err) {
        console.log({ licensePlate: err });
        await client.sendMessage(msg.to, JSON.stringify(err, null, 4));
        await sendAnswer(msg, `falha na consulta da placa ${placa}`);
    }
};
const sweetError = async (msg: Message, err: Record<string, any>) => {
    if (msg && err?.err) {
        await sendAnswer(msg, err.err);
    }
    if (err) {
        await client.sendMessage(myId, jsonToText(err));
    }
}


const sweetTry = async <T>(msg: Message, func: () => Promise<T>): Promise<T | string> => {
    try {
        return await func?.();
    } catch (err) {
        await sweetError(msg, err);
        return 'Erro ao executar instrução';
    }

}

const queroMais = async (msg: Message) => {
    if (!msg) {
        await sweetError(msg, { err: 'sem mensagem' });
    }
    return await sweetTry(msg, async () => {
        const chat = await msg.getChat();
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            if (!chat || chat.isGroup) {
                return await client.sendMessage(myId, media);
            }
            return chat.sendMessage(media);
        }
    });

};
const ocupado = async (msg: Message, prompt: string[] = []) => {
    if (!msg) {
        await sweetError(msg, { err: 'sem mensagem' });
    }
    return await sweetTry(msg, async () => {
        await msg.reply('já respondo, muito ocupado aqui, mas assim que eu conseguir te respondo');
    });
}
// const writeToMe = async (msg: Message) => {
//     if (!msg) {
//         await sweetError(msg, { err: 'sem mensagem' });
//     }
//     if (songTypes.includes(msg.type?.toUpperCase())) {
//         await sweetTry(msg, async () => {
//             const audio = await msg.downloadMedia();
//             const speechClient = new SpeechClient();
//             const content = Buffer.from(audio.data, 'base64');
//             const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
//                 encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
//                 sampleRateHertz: 16000,
//                 languageCode: "pt-BR",
//                 enableAutomaticPunctuation: true,

//             };
//             const [response] = await speechClient.recognize({
//                 audio: { content }, config
//             });
//             const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n');
//             console.log(JSON.stringify({ transcription }, null, 4));
//             await sendAnswer(msg, transcription);
//         });
//     }
// };

// const tryReloadMsg = async(msg: Message) => {
//     client.lo
// }
const sendFileAnswer = async (msg: Message, text: string) => {
    if (!msg) {
        await sweetError(msg, { err: 'sem mensagem' });
    }
    return await sweetTry(msg, async () => {
        const chat = await msg.getChat();
        sendAsTextDocument(text);
    });
};

const readToMe = async (msg: Message, languageCode = null, shouldAnswer = true) => {
    if (songTypes.includes(msg?.type?.toUpperCase())) {
        return await sweetTry(msg, async () => {
            if (!msg?.hasMedia) return;
            const audio = await msg.downloadMedia();
            const speechClient = new SpeechClient();
            const content = audio.data;
            const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
                encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
                sampleRateHertz: 16000,
                languageCode: languageCode === null ? 'pt-BR' : languageCode,
                enableAutomaticPunctuation: true,
                enableSeparateRecognitionPerChannel: false,
                profanityFilter: false,
            };
            const [response] = await speechClient.recognize({
                audio: { content }, config
            });
            const transcription = response?.results?.map(result => result?.alternatives?.[0]?.transcript)?.join('\n') ?? '';
            if (shouldAnswer) {
                await sendAnswer(msg, transcription);
            }
            return transcription;
        });
    }
    console.log({ msg: msg?.type });
    return;
};



const createATextDirectly = async (msg: Message, prompt: string) => {
    const result = await writeAText({ stop: ['stop'], prompt });
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await sendAnswer(msg, answer);
    } else {
        await sendAnswer(msg, "Sem resposta!!");
    }
};
const createAEditingDirectly = async (msg: Message, prompt: string) => {
    const { body } = await (await msg.getQuotedMessage()).reload();
    const result = await editingText({ input: body, instruction: prompt });
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await sendAnswer(msg, answer);
    } else {
        await sendAnswer(msg, "Sem resposta!!");
    }
};

const createInstructionsDirectly = async (msg: Message, prompt: string) => {
    const result = await writeInstructions(prompt);
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await sendAnswer(msg, answer);
    } else {
        await sendAnswer(msg, "Sem resposta!!");
    }
};


const createATextForConfig = async (msg: Message, prompt: any, config: string, splitFor: string = null, isAudio = false) => {
    const result = await withConfig(prompt, config);
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        const response = splitFor ? answer.replace('🤖', splitFor) : answer;
        await sendAnswer(msg, response);
    } else {
        await sendAnswer(msg, "Sem resposta!!");
    }
};


const responseWithTextDirectly = async (prompt: string) => {
    const result = await writeAText({ stop: ['stop', '\n🤖'], prompt, max_tokens: prompt?.length + 495 });
    const answer = result?.choices?.[0]?.text;
    return answer;
};

const createAudioDirectly = async (msg: Message, languageCode: string, prompt: string) => {
    const answer = await responseWithTextDirectly(prompt);
    await onlySay(msg, languageCode, answer);
};



const sendSafeMsg = async (msg: Message) => {
    const contact = await client.getContactById(safeMsgIds.pop());
    const chat = await contact.getChat();
    await msg.forward(chat);
}

const desenha = async (msg: Message, prompt: string) => {
    const chat = await msg.getChat();
    if (!prompt) {
        return await sendAnswer(msg, 'informe o que deseja desenhar');
    }
    if (prompt) {
        const url = await giveMeImage(prompt);
        const image = await MessageMedia.fromUrl(url)
        return await chat.sendMessage(image, { caption: prompt });
    }
}

const draw = async (msg: Message, prompt: string) => {
    if (!prompt) {
        return await sendAnswer(msg, 'informe o que deseja desenhar');
    }
    if (prompt) {
        const url = await giveMeImage(prompt, '1024x1024');
        const image = await MessageMedia.fromUrl(url)
        return await msg.reply(image);
    }
}

const fileFromMedia = (media: MessageMedia) => {
    const file = new File([media.data], media.filename, { type: media.mimetype });
    return file;
}

const sendUrlImageAsAnswer = async (msg: Message, url: string, prompt: string = "") => {
    const image = await MessageMedia.fromUrl(url);
    return await sendAnswer(msg, image, { sendMediaAsDocument: true, caption: prompt });
}
const redesenha = async (msg: Message) => {
    if (!msg || (!msg.hasMedia && !msg.hasQuotedMsg)) {
        return await sendAnswer(msg, 'Qual imagem deseja redesenhar?');
    }
    if (msg.hasQuotedMsg) {
        try {
            await sendAnswer(msg, 'Tentando editar mensagem referenciada');
            const quotedMsg = await (await msg.getQuotedMessage()).reload();
            if (quotedMsg && quotedMsg.id && quotedMsg.hasMedia) {
                try {
                    const media = await quotedMsg.downloadMedia();
                    const url = await createVariation(fileFromMedia(media));
                    return await sendUrlImageAsAnswer(msg, url);
                } catch (err) {
                    await sweetError(msg, err);
                    return await sendAnswer(msg, 'Não consegui editar a imagem');
                }
            }
        } catch (err) {
            console.log(err);
            return await sendAnswer(msg, 'Não consegui pegar a mídia da mensagem referenciada');
        }
    }
    if (msg.hasMedia) {
        try {
            await sendAnswer(msg, 'Tentando editar mídia');
            const media = await msg.downloadMedia();
            const url = await createVariation(fileFromMedia(media));
            return await sendUrlImageAsAnswer(msg, url);
        } catch (err) {
            console.log(err);
            return await sendAnswer(msg, 'Não consegui pegar a mídia da mensagem');
        }
    }
    return await sendAnswer(msg, 'não consegui encontrar nada para editar');
}



const edita = async (msg: Message, prompt) => {
    if (!msg || !msg.hasMedia || !msg.hasQuotedMsg || !prompt?.length) {
        return await sendAnswer(msg, 'Precido da msg com a imagem que será editada e nessa preciso da imagem com a área apagada e a descrição da alteração!');
    }

    const edition = {
        image: null,
        mask: null,
        prompt
    };

    try {
        await sendAnswer(msg, 'Tentando pegar mensagem referenciada');
        const quotedMsg = await (await msg.getQuotedMessage()).reload();
        if (quotedMsg?.hasMedia) {
            const media = await quotedMsg.downloadMedia();
            edition.image = fileFromMedia(media);
        } else {
            return await sendAnswer(msg, 'Não consegui pegar a mídia da mensagem referenciada');
        }
    } catch (err) {
        console.log(err);
        return await sendAnswer(msg, 'Não consegui pegar a mídia da mensagem referenciada');
    }


    try {
        await sendAnswer(msg, 'Tentando editar mídia');
        const media = await msg.downloadMedia();
        edition.mask = fileFromMedia(media);
    } catch (err) {
        console.log(err);
        return await sendAnswer(msg, 'Não consegui pegar a mídia da mensagem');
    }


    try {
        const url = await editImage(edition.image, edition.mask, msg, edition.prompt);
        return await sendUrlImageAsAnswer(msg, url, edition.prompt);
    } catch (err) {
        console.log(err);
        return await sendAnswer(msg, 'Não consegui editar a imagem');
    }
}
const openContext: StepFunction = async ({ msg, prompt }) => {
    const msgId = msg.id._serialized;
    const chatId = (await msg.getChat()).id._serialized;
    const id = `${msg.from}${chatId}`;
    const command = prompt.split(/\s/)[0];
    const contextData = await appData.contexts.createContext(await appData.commands.getCommand(command), { id, chatId, msgId });
    await appData.contexts.addContext(contextData);
    return { data: contextData, chatId };
}
const closeContext: StepFunction = async ({ msg }) => {
    const { data: id, chatId } = await getContextId({ msg });
    const contextData = await appData.contexts.getContext(id);
    await appData.contexts.removeContext(id);
    return { data: contextData, chatId };
}



const getContextId: StepFunction = async ({ msg }) => {
    const chatId = (await msg.getChat()).id._serialized;
    const id = `${msg.from}${chatId}`;
    return { data: id, chatId };
}

const getContext: StepFunction = async ({ msg }) => {
    const { data: id, chatId } = await getContextId({ msg });
    const contextData = await appData.contexts.getContext(id);
    return { data: contextData, chatId };
}

const sendMessage: StepFunction = async ({ msg, lastResult: { data, chatId } }) => {
    const sentMsg = await client.sendMessage(chatId, data);
    return { data: sentMsg, chatId };
}

const sendLog: StepFunction = async ({ msg }) => {
    const { data: id, chatId } = await getContextId({ msg });
    const context = await appData.contexts.getContext(id);
    const log = context.log;
    const sentMsg = await sendAnswer(msg, JSON.stringify(log));
    return { data: sentMsg, chatId };
}
const requestMedia: StepFunction = async ({ msg, lastResult }) => {
    const chatId = (await msg.getChat()).id._serialized;
    let media = null;
    const msgData = lastResult?.data;
    if (msgData?.hasMedia) {
        media = await msgData.downloadMedia();
    }
    return { data: media, chatId };
}
const requestQuoted: StepFunction = async ({ msg }) => {
    const chatId = (await msg.getChat()).id._serialized;
    let quotedMsg = null;
    if (msg.hasQuotedMsg) {
        quotedMsg = await msg.getQuotedMessage();
    }
    return { data: quotedMsg, chatId };
}
const isAudio = async ({ lastResult }) => {
    const msgData = lastResult?.data;
    if (songTypes.includes(msgData?.type?.toUpperCase())) {
        return true;
    }
    return false;
}
const isAudioMsg = async (msg: Message) => {
    if (msg.hasMedia && await isAudio({ lastResult: { data: msg } })) {
        return true;
    }
    return false;
}
const requestAudio = async ({ msg, lastResult }) => {
    let audio = null;
    const msgData = lastResult?.data;
    const chatId = (await msg.getChat()).id._serialized;
    if (msgData?.hasMedia && await isAudio({ lastResult })) {
        audio = await msgData.downloadMedia();
    }
    return { data: audio, chatId };
}
const requestAudioText: StepFunction = async ({ lastResult: { data, chatId } }) => {
    return { data: await readToMe(data), chatId };
}

const requestText = async ({ msg, lastResult }) => {
    const chatId = (await msg.getChat()).id._serialized;
    const msgData = lastResult?.data;
    let text = null;

    if (msgData?.body) {
        text = msgData?.body;
    }
    return { data: text, chatId };
}

const fakePersonAndCar = async (msg: Message) => {
    const { pessoa, carro } = await loadPersonAndCar();
    const pessoaMessage = Object.keys(pessoa).reduce((acc, key) => {
        acc.push(`${key}: *${pessoa[key]}*`);
        return acc;
    }, []).join('\n');

    const carroMessage = Object.keys(carro).reduce((acc, key) => {
        acc.push(`${key}: *${carro[key]}*`);
        return acc;
    }, []).join('\n');
    const content = `*Pessoa:*\n${pessoaMessage}\n\n*Carro:*\n${carroMessage}`;
    console.log(content);
    await sendAnswer(msg, content);

}
const detalhes = async (msg: Message) => {
    const chat = await msg.getChat();
    const mension = await msg.getQuotedMessage();

    if (!mension) {
        return await sendAnswer(msg, 'Não consegui pegar a mensagem referenciada');
    }
    const contato = await mension.getContact();
    if (!contato) {
        return await sendAnswer(msg, 'Não consegui pegar o contato referenciado');
    }
    const imgUrl = await contato.getProfilePicUrl();
    const content = `*Nome:* ${contato.pushname}\n*Número:* ${contato.number}\n*Sobre:* ${await contato.getAbout()}`;
    await chat.sendMessage(await MessageMedia.fromUrl(imgUrl), { caption: content, mentions: [contato] });
}

const reloadMedia = async (msg: Message, id: string) => {
    const chat = await msg.getChat();
    const fromDb = await appData.msgs.getMessage(id);
    if (fromDb) {
        if (fromDb.media) {
            const { mimetype, data, filename, filesize } = fromDb.media;
            const media = await new MessageMedia(mimetype, data, filename, filesize);
            await chat.sendMessage(media, { caption: fromDb.body });
        } else {
            await chat.sendMessage(fromDb.body);
        }
    }
}

const extractLanguageAndAnswer = ([first, ...prompt]: string[]) => {
    const language = first?.includes?.('::') ? first.replace('::', '') : null;
    const answer = [!language ? first : '', ...prompt].join(' ');
    return { language, answer };
}
const extractPostParams = (requestText: string) => {
    const groups = requestText.matchAll(/(titulo:)(.*?)(conteudo:)(.*)/gm);
    const [, , title, , content] = groups?.next()?.value;
    return { title, content };
}
const om = async (msg: Message, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await createAudioDirectly(msg, language, answer);
}
const onlySay = async (msg: Message, languageCode: string, answer: string, reply = false) => {
    const content = await tellMe(answer, languageCode);
    const song = new MessageMedia("audio/mp3", content, `${new Date().getTime()}.mp3`);
    if (reply) {
        try {
            return await msg.reply(song);
        } catch (e) {
            return await (await msg.getChat()).sendMessage(song);
        }
    }
    return await client.sendMessage(msg.to, song);
}
const voice = async (msg: Message, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await onlySay(msg, language, answer);
}

const showAdministrationButtons = async (msg: Message) => {

    const buttonMessage = new Buttons('Administração', [
        { body: 'Vincular' },
        { body: 'Desvincular' },
        { body: 'Add Admin' },
        { body: 'Del Admin' }], 'title', 'footer');
    await client.sendMessage(msg.from, buttonMessage);
}
const escreve = async (msg: Message, [language,]: string[]) => await readToMe(await msg.getQuotedMessage(), language);
const curie = new CurrierModel(new OpenAIManager().getClient());
const wikipedia = new Wikipedia();
const createPost = async (msg: Message, prompt?: string[]) => {
    return await sweetTry(msg, async () => {
        const wordpress = new Wordpress(curie);
        const { title, content } = extractPostParams(prompt?.join(' '));
        const response = await wordpress.createAiPost({
            title,
            prompt: content,
            status: 'publish',
        });
        if (!response) {
            return await sendAnswer(msg, `Não consegui criar o post`);
        }
        await sendAnswer(msg, `Post criado com sucesso: ${response.link}`);
    });
}
const forzinhoTranslationAgent = new AgentTranslation('fourzinho');

const funcSelector: Record<string, any> = {
    '-': async (msg: Message, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
    '--': async (msg: Message, prompt: string[]) => await createAEditingDirectly(msg, prompt?.join(' ')),
    'status': async (msg: Message) => await printStatus(msg),
    'panic': async (msg: Message, [size]: string[]) => await deleteMsgs(msg, +size),
    'ultimas': async (msg: Message, [size, ...params]: string[]) => await listMsgs(msg, size, params),
    'que?': async (msg: Message) => await showSimpleInfo(msg),
    'quem?': async (msg: Message) => await detalhes(msg),
    '--h': async (msg: Message) => await helpMsg(msg),
    escreve,
    '✏': escreve,
    'chassi': async (msg: Message, [placa,]: string[]) => await searchByLicensePlate(msg, placa),
    'elon_musk': async (msg: Message, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'key': async (msg: Message, prompt: string[]) => await sendAnswer(msg, await curie.keyPoints(prompt?.join(' '))),
    'keyw': async (msg: Message, prompt: string[]) => await sendAnswer(msg, await curie.keyWords(prompt?.join(' '))),
    'wiki': async (msg: Message, prompt: string[]) => await sendAnswer(msg, await wikipedia.sumary(prompt?.join(','))),
    'demostenes': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
    'maru': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
    'deivid': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', '*Pré atendimento inteligente*'),
    'juarez': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', splitFor),
    'sextou': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
    '🍻': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
    '💖': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'amor', '*bimbim*'),
    '😔': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
    '😭': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
    '😢': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
    'triste': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
    'meupastor': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
    'wenderson': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
    'pastor': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
    'abrão': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
    'danilo': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    'renato': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    'dinho': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    '🚚': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    '🚜': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    'boso': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    'agro': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    'goel': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    'wellen-beu': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
    '🛋': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
    'pre-venda': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
    'gean': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
    'carla': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
    'wdany': async (msg: Message, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'constelacao-familiar', splitFor),
    'sandro': async (msg: Message, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'poliana': async (msg: Message, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'diga': om,
    om,
    '🔈': voice,
    voice,
    'fala': voice,
    'desenha': async (msg: Message, prompt: string[]) => await desenha(msg, prompt?.join(' ')),
    'add': async (msg: Message, prompt: string[]) => await new CommandManager(appData, client).addCommand(msg, prompt?.join(' ')),
    'remove': async (msg: Message, prompt: string[]) => await new CommandManager(appData, client).removeCommand(msg, prompt?.join(' ')),
    'cmd': async (msg: Message, prompt: string[]) => await new CommandManager(appData, client).executeCommand(msg, prompt?.join(' ')),
    'cmd-h': async (msg: Message, prompt: string[]) => await new CommandManager(appData, client).listCommands(msg),
    'redesenha': async (msg: Message, prompt: string[]) => await redesenha(msg),
    'edita': async (msg: Message, prompt: string[]) => await edita(msg, prompt?.join(' ')),
    'ping': async (msg: Message) => await sendAnswer(msg, 'pong'),
    'leia': async (msg: Message) => await startChat({ client, msg }),
    'fake': async (msg: Message) => await fakePersonAndCar(msg),
    'reload': async (msg: Message, [prompt]) => await reloadMedia(msg, prompt),
    'err': async (msg: Message) => await sendAnswer(msg, `Comando *${msg?.body.split(' ')?.[1]}* não encontrado`),
    'quero+': async (msg: Message) => await queroMais((await (await msg.getQuotedMessage())?.reload())),
    'bind': async (msg: Message, prompt: string[]) => await bindChatConfig(msg, prompt),
    'unbind': async (msg: Message, prompt: string[]) => await unbindChatConfig(msg),
    'admin-add': async (msg: Message, prompt: string[]) => await addAdmin(msg),
    'admin-del': async (msg: Message, prompt: string[]) => await delAdmin(msg),
    'admin': async (msg: Message, prompt: string[]) => await showAdministrationButtons(msg),
    'posts': async (msg: Message, prompt: string[]) => console.log(await new Wordpress(curie).getPosts()),
    'post': async (msg: Message, prompt: string[]) => await createPost(msg, prompt),
    r: async (msg: Message) => await runCommand((await (await msg.getQuotedMessage())?.reload())),
    ins: async (msg: Message, prompt: string[]) => await createInstructionsDirectly(msg, prompt?.join(' ')),
    draw: async (msg: Message, prompt: string[]) => await draw(msg, prompt?.join(' ')),
    b: async (msg: Message, prompt: string[]) => await intentChat(msg, prompt),
    tcr: async (msg: Message, prompt: string[]) => await intentChat(msg, prompt),
    v: async (msg: Message, [id, ...prompt]: string[]) => await verify(msg, id, prompt),
    par: async (msg: Message, [id, ...prompt]: string[]) => await new Intent().updateIntentParams(),
    tra: async (msg: Message, [id, ...prompt]: string[]) => await new AgentTranslation().translateAgent(),
    trai: async (msg: Message, [id, ...prompt]: string[]) => await new AgentTranslation().translateIntents(),
    traf: async (msg: Message, [id, ...prompt]: string[]) => await new AgentTranslation().translateFlows(),
    trap: async (msg: Message, [id, ...prompt]: string[]) => await new AgentTranslation().translatePages(),
    trat: async (msg: Message, [id, ...prompt]: string[]) => await new AgentTranslation().translateTestCases(),
    '4i': async (msg: Message, [id, ...prompt]: string[]) => await forzinhoTranslationAgent.translateIntents(),
}
const intentChat = async (msg: Message, prompt: string[]) => {
    const isSound = await isAudioMsg(msg);
    const chat = await msg.getChat();
    const id = chat.id.user;
    const responses = (await new Intent().getIntent(keyReplacer(id), isSound ? (await msg.downloadMedia()).data : prompt?.join(' '), isSound)).map(m => m?.trim?.()).filter(Boolean);

    for (let i = 0; i < responses?.length; i++) {
        const resp = isSound ? responses[i] : `${botname}: ${responses[i]}`;
        await sendReply(msg, resp);
    }
}
const verify = async (msg: Message, id: string, prompt: string[]) => {
    const ctt = await client.getContactById(id);
    const chat = await ctt.getChat();
    const messages = await chat?.fetchMessages({ limit: +prompt?.[0] || 1000 });
    console.log({ messages: messages.map(m => m.body) });
    const dbMessages = await appData.msgs.filterByFrom(id);
    console.log({ dbMessages: dbMessages.map(m => m.body) });
}

const addAdmin = async (msg: Message) => {
    await appData.commandConfigsManager.save(msg.to);
}

const delAdmin = async (msg: Message) => {
    await appData.commandConfigsManager.delete(msg.to);
}

const bindChatConfig = async (msg: Message, prompt: string[]) => {
    const from = msg.to;
    const isAutomatic = prompt?.[0] === 'auto';
    const commands = prompt?.[1]?.split(',')?.map((cmd: string) => cmd.trim());
    await appData.chatConfigsManager.saveConfig(from, commands, isAutomatic);

}

const unbindChatConfig = async (msg: Message) => {
    const from = msg.to;
    await appData.chatConfigsManager.deleteConfig(from);

}

//crie uma funçao que faz uma postagem no instagram
const createInstaPost = async (msg: Message, prompt: string[]) => {
    const post = prompt?.join(' ');
    const postImage = await msg.downloadMedia();
    const postImageName = `${Date.now()}.jpg`;

}



const simpleMsgInfo = ({ rawData, body, ...clean }: Message): Partial<Message> => {
    if (clean.hasMedia) {
        return clean;
    }
    return { body, ...clean };
};


const logTotalInfo = async (msg: Message) => {
    const chats = await client.getChats();
    const currentChat = await msg.getChat();
    const list: Partial<Message>[] = [];
    [currentChat, ...chats].map(async (chat: Chat) => {
        const last1000 = await chat.fetchMessages({ limit: 1000 });
        const msgList = last1000.map((msg: Message) => simpleMsgInfo(msg));
        list.push(...msgList)
    });
    await sendAsJsonDocument(list);
}

const songTypes = ['VOICE', 'PTT', 'AUDIO'];
const safeMsgIds = [];
const external = [myId].concat(safeMsgIds);

const quoteMarkers = ['<add/>', '<add>', '<add />', '<add >', '</>'];
const codeMarker = '@run';
const cmdMarker = '-';
const isUnique = (config) => config.commands.length === 1;

// const chatConfig = {
//     '556496252626': {
//         commands: ['💖'],
//         isAutomatic: false,
//         commandMarkers: commandMarkers,
//         isUnique: () => isUnique(chatConfig['556496252626'])
//     },
//     '556493060933': {
//         commands: ['🍻'],
//         isAutomatic: false,
//         commandMarkers: commandMarkers,
//         isUnique: () => isUnique(chatConfig['556493060933'])
//     },
//     '556492997625': {
//         commands: ['-'],
//         isAutomatic: false,
//         commandMarkers: commandMarkers,
//         isUnique: () => isUnique(chatConfig['556492997625'])
//     },
//     '556492026971': {
//         commands: Object.keys(funcSelector),
//         isAutomatic: true,
//         commandMarkers: commandMarkers,
//         isUnique: () => isUnique(chatConfig['556492026971'])
//     },
//     '556492995244': {
//         commands: ['deivid'],
//         isAutomatic: true,
//         commandMarkers: commandMarkers,
//         isUnique: () => isUnique(chatConfig['556492995244'])
//     }
// }

const isSafe = (msg: Message) => safeMsgIds.includes(msg.from);

const licensePlateSearch = ['556481509722@c.us'];
const isLicensePlate = (msg: Message) => {
    if (isNotString(msg)) return false;

    const msgContent = msg?.body?.toUpperCase().split(' ').slice(1).join(' ');
    if (isCommand(msg) || msgContent?.split(' ').length > 1 || msgContent?.length > 7) return false;

    return /([A-Z]{3}\d[A-Z]\d{2})|([A-Z]{3}\d{4})/g.test(msgContent.replace(/[^A-Z0-9]+/g, ''));
}




const fastAnswer = {
}

const sendWaiting = async (msg: { from: string; }) => {
    await client.sendMessage(msg.from, 'Executando, um momento por favor');
};
const isNotString = (msg: Message) => typeof msg?.body !== "string";
const isToMe = (msg: { to: string; }) => msg.to === myId;
const isCommand = (msg: Message) => {

    if (isNotString(msg)) return false;
    return commandMarkers.filter(commandMarker => msg?.body?.startsWith(commandMarker)).length > 0;
}

const getConfig = async (msg: Message) => {
    if (isNotString(msg)) return;
    const config = await appData.chatConfigsManager.getByNumber(msg.from);
    if (!config) return;

    if (config.isAutomatic
        || (config.commandMarkers.filter(commandMarker => msg?.body?.startsWith(commandMarker)).length > 0 && config.commands.filter(command => msg?.body?.split(' ')?.[1] === command).length > 0)
    ) {
        return config;
    }
    return;
}
const prepareBody = (msg: Message) => {
    if (isNotString(msg)) return msg;
    const msgBody = msg.body?.toLowerCase();
    const instructions = ['diga', 'fale', 'comente', 'descreva', 'explique', 'resuma', 'bibot', 'robo', 'robô', 'bimbim', 'bee-bot', 'beebot'];
    const instruction = instructions.find(instruction => msgBody.startsWith(instruction));
    if (instruction) {
        return { ...msg, body: msgBody.replace(instruction, '').trim() };
    }
    return msg;

}
const isCode = (msg: Message) => {
    if (isNotString(msg)) return false;
    return msg.body.startsWith(codeMarker);
}
const canExecuteCommand = (msg: Message) => {
    if (isNotString(msg)) return false;
    if (isCommand(msg)) {
        return isAuthorized(msg);
    }
    if (isLicensePlate(msg)) {
        return licensePlateSearch.includes(msg.from) || !!msg.fromMe;
    }
}
const canExecuteCode = (msg: Message) => {
    if (isCode(msg)) {
        return !!msg?.fromMe && isToMe(msg)
    }
}



type executionType = [string, string[], any] | [string, string[]] | [string, any] | [string];

const readRealCommandText = async (msg: Message) => {
    if (songTypes.includes(msg.type?.toUpperCase())) {
        return await readRealCommandAudio(msg);
    }
    if (msg.type?.toUpperCase() === 'TEXT') {
        const quotedMarkFound = quoteMarkers.find(quoteMarker => !!msg?.body?.includes(quoteMarker));
        if (!!quotedMarkFound && !!msg?.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg?.body?.trim?.()) {
                msg.body = msg.body.replace(quotedMarkFound, quotedMsg.body);
            }
        }
    }
    return { msg, audio: false };
}


const readRealCommandAudio = async (msg: Message) => {
    msg.body = await readToMe(msg, null, false);
    return { msg, audio: true };
}
const bodyToParams = (msg: Message) => {
    if (isNotString(msg)) return [];
    return msg.body?.split(' ').filter(Boolean);
}

const extractExecutionInfo = (msg: Message, config?: ChatConfigType): executionType => {
    if (isCommand(msg) || config?.isAutomatic) {
        const buildBody = `${config?.isAutomatic ? 'auto ' : ''}${config?.isUnique?.() ? `${config?.commands?.[0]} ` : ''}${msg?.body}`;
        const [, text, ...params] = buildBody.split(/\s/).filter(Boolean);
        return [text, params];
    }
    if (isLicensePlate(msg)) {
        return ['placa', [msg?.body?.toUpperCase(), true]];
    }
    return null;
}
const extractCodeInfo = (msg: Message) => {

    const [, ...params] = msg.body.split(' ').filter(Boolean);
    return params?.join(' ');
}

const isAuthorized = (msg: Message) => !!msg.fromMe || !!external.includes(msg.from);

const runCommand = async (msg: Message) => {
    try {
        const [text, params] = extractExecutionInfo(msg, null);
        console.log({ text, params });

        const command = funcSelector[text?.toLowerCase?.()] ?? funcSelector.err;

        await command(msg, params);


    } catch (error) {
        console.error({ error });
        await sendAnswer(msg, 'Executado com falha');
    }
}

const runConfig = async (msg: Message, isAudio = false) => {
    const config = await getConfig(msg);
    if (!config) return;
    try {
        const info = extractExecutionInfo(msg, config);
        if (!info) return;
        const [text, params] = info;
        console.log({ text, params });

        const command = funcSelector[text?.toLowerCase?.()];
        if (!command) return;

        await command(msg, params);


    } catch (error) {
        console.error({ error });
        await sendAnswer(msg, 'Executado com falha');
    }
}
// crie uma função pra receber a mensagem e responder com o texto 'fazendo'
const sendDoing = async (msg: Message) => {
    await sendAnswer(msg, '*Beebot*: - Fazendo...');
}
const runCode = async (msg: Message) => {
    try {

        child_process.exec(`${msg.body?.replace(codeMarker, '')}`, async (error, stdout, stderr) => {
            if (error) {
                console.error(error);
                await sendAnswer(msg, jsonToText({ error, stderr }));
            }
            console.log(stdout);
            await sendAnswer(msg, stdout);
        });
    } catch (error) {
        console.error({ error });
        await sendAnswer(msg, 'executado com falha');
    }
}
const observable = [];//[leiaId];
const isObservable = (msg: Message) => observable.includes(msg.from);

client.on('message_create', async receivedMsg => {
    await protectFromError(async () => {
        if (receivedMsg.isForwarded) return await receivedMsg.reload();
        await backup(receivedMsg);
        const { msg: parsed, audio } = await readRealCommandText(receivedMsg);
        const msg = audio ? prepareBody(parsed) : parsed;
        if (canExecuteCommand(msg)) {
            return await runCommand(msg);
        }
        if (receivedMsg.fromMe && !receivedMsg.hasQuotedMsg && !msg?.body?.startsWith(botname)) {
            await runConfig(msg);
        }
    });
});
client.on('message', async receivedMsg => {
    await protectFromError(async () => {
        const { msg: parsed, audio } = await readRealCommandText(receivedMsg);
        const msg = audio ? prepareBody(parsed) : parsed;

        if (canExecuteCommand(msg)) {
            return await runCommand(msg);
        }
        if (canExecuteCode(msg)) {
            return await runCode(msg);
        }

        if (isObservable(msg)) {
            return await protectFromError(async () => {
                return await sendResponse(client, msg);
            });
        }
        await runConfig(msg);

    });
});



const jsonToText = (err: Record<string, any>) => JSON.stringify(err, null, 4);

const sendAsJsonDocument = async (obj: Record<string, any>) => {
    const fileEncoded = Buffer.from(jsonToText(obj)).toString('base64');
    const fileAsMedia = new MessageMedia("text/json", fileEncoded, `${obj?.timestamp ?? new Date().getTime()}.json`);
    await client.sendMessage(myId, fileAsMedia, {
        sendMediaAsDocument: true
    });
}

const sendAsTextDocument = async (obj: string, filename = `${new Date().getTime()}.txt`, mime = 'aplication/text') => {
    const fileEncoded = Buffer.from(obj, 'utf-8').toString('base64');
    await writeFile(filename, fileEncoded, 'base64');
}
const prepareJsonToFirebase = (obj: Record<string, any>) => {
    if (!obj) return null;



    return Object.keys(obj).reduce((acc, fullKey) => {
        const key = keyReplacer(fullKey);

        if (typeof obj[fullKey] === 'object') {
            acc[key] = prepareJsonToFirebase(obj[fullKey]);
        } else {
            acc[key] = obj[fullKey];
        }
        return acc;
    }, {} as Record<string, any>);
};



const run = async () => {
    const { admin } = await dbConfig()
    db = admin.database();
    storage = admin.storage();
    await client.initialize();
    appData.defaultSteps = {
        'open_context': openContext,
        'close_context': closeContext,
        'get_context': getContext,
        'send_log': sendLog,
        'request_media': requestMedia,
        'request_audio': requestAudio,
        // 'request_image': requestImage,
        // 'request_video': requestVideo,
        // 'request_document': requestDocument,
        // 'request_contact': requestContact,
        // 'request_location': requestLocation,
        // 'request_sticker': requestSticker,
        // 'request_voice': requestVoice,
        'request_text': requestText,
        'request_audio_text': requestAudioText,
        'request_quoted': requestQuoted,
        //  'compose_form': composeForm,
        // 'validate_form': validateForm,
        'send_message': sendMessage,
        // 'send_image': sendImage,
        // 'send_audio': sendAudio,
        // 'send_video': sendVideo,
        // 'send_document': sendDocument,
        // 'send_contact': sendContact,
        // 'send_location': sendLocation,
        // 'send_sticker': sendSticker,
        // 'send_voice': sendVoice,
        // 'send_url_image': sendUrlImage,

    };
};
(async () => await run())();

