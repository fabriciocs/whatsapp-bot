import { resolve } from 'path';
import { config as dotEnvConfig } from 'dotenv';
dotEnvConfig({ path: resolve('.env') });

import * as puppeteer from 'puppeteer';

import { SpeechClient, protos } from '@google-cloud/speech';

import * as QRCode from 'qrcode';
import { Chat, Client, LocalAuth, Message, MessageContent, MessageMedia, MessageSendOptions, MessageTypes, RemoteAuth } from 'whatsapp-web.js';

import dbConfig from './db-config';
import { loadPersonAndCar, sendResponse, startChat } from './leia';

import OpenAIManager, { createVariation, editImage, giveMeImage, withConfig, writeAText } from './ai';
import CurrierModel from './currier';
import { tellMe } from './textToSpeach';
import { readDocument, whatIsIt } from './vision';
import * as child_process from 'child_process';
import Commands from './commands';
import Contexts, { Context } from './context';
import { CompressionType } from '@aws-sdk/client-s3';
import CommandManager from './commands-manager';
import MessagesManager from './messages-manager';
import { Database } from 'firebase-admin/database';
import { Storage } from 'firebase-admin/storage';
import Wikipedia from './wiki';
import { keyReplacer, baseName, ChatConfigType, commandMarkers } from './util';
import SessionsManager from './sessions-manager';
import ChatConfigsManager from './chat-configs-manager';
import CommandConfigsManager from './command-configs-manager';

const myId = '120363026492757753@g.us';
const leiaId = '551140030407@c.us';
const appData: {
    commands?: Commands,
    contexts?: Contexts,
    msgs?: MessagesManager,
    defaultSteps?: Record<string, any>;
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

const toMB = (bytes: number) => bytes / (1024 ** 2);
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

const sendAnswer = async (msg: Message, content: MessageContent, options: MessageSendOptions = {}, isAudio = false) => {
    if (isAudio) {
        return await onlySay(msg, null, `${content}`);
    } else {
        await (await msg.getChat()).sendMessage(content, { ...options, sendSeen: true });
    }
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


client.on('ready', async () => {
    console.log('READY');
    appData.commands = new Commands(db.ref(`${baseName}/commands`));
    appData.contexts = new Contexts(db.ref(`${baseName}/contexts`));
    appData.msgs = new MessagesManager(db.ref(`${baseName}/messages`));
    appData.sessionManager = new SessionsManager(db.ref(`${baseName}/sessions`));
    appData.chatConfigsManager = new ChatConfigsManager(db.ref(`${baseName}/chatConfigs`));
    appData.commandConfigsManager = new CommandConfigsManager(db.ref(`${baseName}/commandConfigs`));
});

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
    //melhore o código abaixo utilizando funções não assíncronas
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
    // page.on('response', async (response) => {
    //     if (response.url())) {
    //         const responseBody = await response.buffer();
    //        
    //     }
    // });
    // await page.click(`button.button-primary.notranslate.mat-raised-button`);


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
//     const songTypes = ['VOICE', 'AUDIO', 'PTT']
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

const readToMe = async (msg: Message, languageCode = 'pt-BR', shouldAnswer = true) => {
    if (!msg) {
        await sweetError(msg, { err: 'sem mensagem' });
        return '';
    }

    if (songTypes.includes(msg.type?.toUpperCase())) {
        return await sweetTry(msg, async () => {
            if (!msg.hasMedia) return;
            const audio = await msg.downloadMedia();
            const speechClient = new SpeechClient();
            const content = Buffer.from(audio.data, 'base64');
            const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
                encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
                sampleRateHertz: 16000,
                languageCode,
                enableAutomaticPunctuation: true,
                enableWordTimeOffsets: true,
                enableWordConfidence: true,
                audioChannelCount: 0,
                enableSeparateRecognitionPerChannel: false,
                maxAlternatives: 0,
                profanityFilter: false,
                speechContexts: [],
                useEnhanced: false
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
        const url = await giveMeImage(msg, prompt);
        const image = await MessageMedia.fromUrl(url)
        return await chat.sendMessage(image, { caption: prompt });
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
const openContext = async (msg: Message, prompt: string) => {
    const msgId = msg.id._serialized;
    const chatId = (await msg.getChat()).id._serialized;
    const id = `${msg.from}${chatId}`;
    const command = prompt.split(' ')[0];
    const contextData = await appData.contexts.createContext(await appData.commands.getCommand(command), { id, chatId, msgId });
    await appData.contexts.addContext(contextData);
    return { input: { msg, prompt, id }, output: { contextData, chatId } };
}
const closeContext = async (msg: Message) => {
    const chatId = (await msg.getChat()).id._serialized;
    const id = `${msg.from}${chatId}`;
    const contextData = await appData.contexts.getContext(id);
    await appData.contexts.removeContext(id);
    return { input: { msg, id }, output: { contextData, chatId } };
}

const getContext = async (msg: Message) => {
    const chatId = (await msg.getChat()).id._serialized;
    const id = `${msg.from}${chatId}`;
    const contextData = await appData.contexts.getContext(id);
    return { input: { msg, id }, output: { contextData, chatId } };
}

const sendMessage = async (msg: Message, prompt: string) => {
    const chatId = (await msg.getChat()).id._serialized;
    const sentMsg = await client.sendMessage(chatId, prompt);
    return { input: { msg, prompt }, output: { sentMsg, chatId } };
}

const sendLog = async (msg: Message) => {
    const chatId = (await msg.getChat()).id._serialized;
    const id = `${msg.from}${chatId}`;
    const context = await appData.contexts.getContext(id);
    const log = context.log;
    const sentMsg = await sendAnswer(msg, JSON.stringify(log));
    return { input: { msg }, output: { sentMsg, chatId } };
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

const om = async (msg: Message, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await createAudioDirectly(msg, language, answer);
}
const onlySay = async (msg: Message, languageCode: string, answer: string) => {
    const content = await tellMe(answer, languageCode);
    const song = new MessageMedia("audio/mp3", content, `${new Date().getTime()}.mp3`);
    await client.sendMessage(msg.to, song);
}
const voice = async (msg: Message, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await onlySay(msg, language, answer);
}

const escreve = async (msg: Message, [language,]: string[]) => await readToMe(await msg.getQuotedMessage(), language);
const curie = new CurrierModel(new OpenAIManager().getClient());
const wikipedia = new Wikipedia();
const funcSelector: Record<string, any> = {
    '-': async (msg: Message, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'status': async (msg: Message) => await printStatus(msg),
    'panic': async (msg: Message, [size]: string[]) => await deleteMsgs(msg, +size),
    'ultimas': async (msg: Message, [size, ...params]: string[]) => await listMsgs(msg, size, params),
    'que?': async (msg: Message) => await showSimpleInfo(msg),
    'quem?': async (msg: Message) => await detalhes(msg),
    '--h': async (msg: Message) => await helpMsg(msg),
    escreve,
    '✏': escreve,
    'placa': async (msg: Message, [placa,]: string[]) => await searchByLicensePlate(msg, placa),
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
    't': async (msg: Message, prompt: string[]) => await ocupado(msg, prompt),
    'bind': async (msg: Message, prompt: string[]) => await bindChatConfig(msg, prompt),
    'unbind': async (msg: Message, prompt: string[]) => await unbindChatConfig(msg),
    'admin-add': async (msg: Message, prompt: string[]) => await addAdmin(msg),
    'admin-del': async (msg: Message, prompt: string[]) => await delAdmin(msg),
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
const safeMsgIds = ['556499736478@c.us'];
const external = [myId, '556499163599@c.us', '556481509722@c.us', '556492979416@c.us', '556292274772@c.us', '556492052071@c.us', '556292070240@c.us', '556493060933@c.us', '556499918954@c.us', '556496252626@c.us'].concat(safeMsgIds);

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
const isDiga = (msg: Message) => {
    if (isNotString(msg)) return false;
    const msgBody = msg.body?.toLowerCase();
    const instructions = ['diga', 'fale', 'comente', 'descreva', 'explique', 'resuma', 'bibot', 'robo', 'robô', 'bimbim', 'bee-bot', 'beebot'];
    return instructions.filter(instruction => msgBody.startsWith(instruction)).length > 0;

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
    const songTypes = ['VOICE', 'PTT', 'AUDIO']
    if (songTypes.includes(msg.type?.toUpperCase())) {
        return await readRealCommandAudio(msg);
    }
    const quotedMarkFound = quoteMarkers.find(quoteMarker => !!msg?.body?.includes(quoteMarker));
    let newBody = msg?.body;
    if (!!quotedMarkFound && !!newBody) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg?.body?.trim?.()) {
            newBody = msg.body.replace(quotedMarkFound, quotedMsg.body);
        }
    }
    msg.body = newBody;
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
    if (isCommand(msg)) {
        const [, text, ...params] = `${config?.isAutomatic ? 'auto ' : ''}${config?.isUnique?.() ? `${config?.commands?.[0]} ` : ''}${msg?.body}`.split(' ').filter(Boolean);
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
const codeToRun = (code: any) => {

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
    if (receivedMsg.isForwarded) return await receivedMsg.reload();
    // if (isSafe(msg)) {
    //     await protectFromError(async () => {

    //         const chat = await msg.getChat();
    //         await msg.forward(await client.getChatById(myId));
    //         await msg.delete();
    //         await Promise.all((await chat.fetchMessages({})).map(async (msg: Message) => await msg.delete()));

    //     });
    // }
    await protectFromError(async () => {

        await backup(receivedMsg);
        const { msg, audio } = await readRealCommandText(receivedMsg);
        // try {

        //     if (!!msg.fromMe) {
        //         console.log({ type: msg.type });
        //         let message;
        //         const songTypes = ['VOICE', 'PTT', 'AUDIO']
        //         if (songTypes.includes(msg.type?.toUpperCase())) {
        //             message = await readToMe(msg, false);
        //         } else {
        //             const [, params] = extractExecutionInfo(msg);
        //             message = params.join(' ');
        //         }

        //         if (message) {
        //             console.log({ message });
        //             if (isDiga(msg)) {
        //                 return await createAudioDirectly(msg, message);
        //             }
        //         }
        //     }


        // } catch (err) {
        //     console.log({ 'writing error': err });
        // }
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
        // 'request_audio': requestAudio,
        // 'request_image': requestImage,
        // 'request_video': requestVideo,
        // 'request_document': requestDocument,
        // 'request_contact': requestContact,
        // 'request_location': requestLocation,
        // 'request_sticker': requestSticker,
        // 'request_voice': requestVoice,
        // 'request_text': requestText,
        // 'request_quoted': requestQuoted,
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



