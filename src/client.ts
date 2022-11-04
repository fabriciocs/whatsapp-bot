import { resolve } from 'path';
import { config as dotEnvConfig } from 'dotenv';
dotEnvConfig({ path: resolve('.env') });

import axios from 'axios';
import * as puppeteer from 'puppeteer';

import { SpeechClient, protos } from '@google-cloud/speech';

import * as QRCode from 'qrcode';
import { Chat, Client, LocalAuth, Message, MessageContent, MessageMedia, MessageSendOptions } from 'whatsapp-web.js';

import dbConfig from './db-config';
import { sendResponse, startChat } from './leia';

import { writeAText } from './ai';
import { tellMe } from './textToSpeach';
import { readDocument, whatIsIt } from './vision';
import { getVid } from './xv';

import * as child_process from 'child_process';

const myId = '120363044726737866@g.us';
const leiaId = '551140030407@c.us';

const puppeteerConfig: puppeteer.PuppeteerNodeLaunchOptions & puppeteer.ConnectOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, ignoreHTTPSErrors: true };
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
});

let db = null;

const toMB = (bytes: number) => bytes / (1024 ** 2);

const backup = (msg: Message) => {

    if (!db) return;
    const ref = db.ref('bee-bot');
    const prepared = prepareJsonToFirebase(JSON.parse(JSON.stringify(msg)));
    ref.child('messages').push().set(prepared);
}

const sendAnswer = async (msg: Message, content: MessageContent, options: MessageSendOptions = {}) => {
    await (await msg.getChat()).sendMessage(content, { ...options, sendSeen: true });
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
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

client.on('qr', (qr) => {
    QRCode.toString(qr, { type: 'terminal', small: true }, function (err: any, url: any) {
        console.log(url)
    });
});

const sendVid = async (msg: { to: string; }, page = 1, size = 1, search = '') => {
    try {

        const vids = await getVid(+page, +size, search, puppeteerConfig);

        await Promise.all(await vids.map(async ({ high, image, url, title, low }) => {
            const result = async (vidUrl: string) => {
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



const listMsgs = async (msg: Message, size: string | number) => {
    const chat = await msg.getChat();
    const limit = +size;
    const msgs = await chat.fetchMessages({
        limit
    });
    await sendAsJsonDocument({ msg, msgs });
}

const clearChat = async (msg: { getChat: () => any; delete: (arg0: boolean) => any; }) => {
    const chat = await msg.getChat();
    await chat.clearMessages(true);
    await msg.delete(true);
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
    await Promise.all(await msgs.map(async (m: Message) => await m.delete(true)));
}



const showSimpleInfo = async (msg: Message) => {
    if (msg.hasQuotedMsg) {
        let quotedMsg = await msg.getQuotedMessage();
        if (!quotedMsg) {
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
                await client.sendMessage(myId, details?.join(',') ?? 'não consegui identificar');
                const whatIsWritten = await readDocument(vision);
                const [{ fullTextAnnotation }] = whatIsWritten;
                await client.sendMessage(myId, fullTextAnnotation?.text ?? 'não consegui ler');
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
        await msg.delete(true);
    }
};


const helpMsg = async (msg: Message) => {
    await protectFromError(async () => {
        try {
            const text = Object.keys(funcSelector).join('\n');
            await sendAnswer(msg, text);
        } catch (err) {
            console.log({ helpError: err });
            await msg.delete(true);
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
        let vehicle = await axios.get(`https://apicarros.com/v2/consultas/${placa}/8e976a5c05bd3035c75efa7b459296bd/json`);
        if (full) {
            await sendAnswer(msg, JSON.stringify(vehicle.data, null, 4));
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
                await sendAnswer(msg, JSON.stringify(vehicle.data, null, 4));
                await sendAnswer(msg, `falha na consulta dados extras ${uf}-${chassi}`);
            }
        }
    } catch (err) {
        console.log({ licensePlate: err });
        await client.sendMessage(msg.to, JSON.stringify(err, null, 4));
        await sendAnswer(msg, `falha na consulta da placa ${placa}`);
    }
};
const sweetError = async (msg: Message, err: Record<string, any>) => {
    if (msg) {
        await sendAnswer(msg, 'Não consegui. 😂😂😂');
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


const writeToMe = async (msg: Message) => {
    if (!msg) {
        await sweetError(msg, { err: 'sem mensagem' });
    }
    const songTypes = ['VOICE', 'AUDIO', 'PTT']
    if (songTypes.includes(msg.type?.toUpperCase())) {
        await sweetTry(msg, async () => {
            const audio = await msg.downloadMedia();
            const speechClient = new SpeechClient();
            const content = Buffer.from(audio.data, 'base64');
            const config = {
                encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
                sampleRateHertz: 16000,
                languageCode: "pt-BR"
            };
            const [response] = await speechClient.recognize({
                audio: { content }, config
            });
            const transcription = response?.results?.map((result: { alternatives: { transcript: any; }[]; }) => result?.alternatives?.[0]?.transcript)?.join('\n') ?? '';
            await sendAnswer(msg, transcription);
        });
    }
};

const readToMe = async (msg: Message) => {
    if (!msg) {
        await sweetError(msg, { err: 'sem mensagem' });
        return '';
    }
    const songTypes = ['VOICE', 'PTT']
    if (songTypes.includes(msg.type?.toUpperCase())) {
        return await sweetTry(msg, async () => {
            const audio = await msg.downloadMedia();
            const speechClient = new SpeechClient();
            const content = Buffer.from(audio.data, 'base64');
            const config: protos.google.cloud.speech.v1.RecognitionConfig = {
                encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
                sampleRateHertz: 16000,
                languageCode: "pt-BR",
                enableAutomaticPunctuation: true,
                enableWordTimeOffsets: true,
                enableWordConfidence: true,
                audioChannelCount: 0,
                enableSeparateRecognitionPerChannel: false,
                alternativeLanguageCodes: [],
                maxAlternatives: 0,
                profanityFilter: false,
                speechContexts: [],
                model: '',
                useEnhanced: false,
                toJSON: function (): { [k: string]: any; } {
                    throw new Error('Function not implemented.');
                }
            };
            const [response] = await speechClient.recognize({
                audio: { content }, config
            });
            const transcription = response?.results?.map(result => result?.alternatives?.[0]?.transcript)?.join('\n') ?? '';
            return transcription;
        });
    }
    return 'Não consegui. 😂😂😂';
};



const createATextDirectly = async (msg: Message, prompt: any) => {
    const result = await writeAText({ prompt });
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await sendAnswer(msg, answer);
    } else {
        await sendAnswer(msg, "Sem resposta!!");
    }
};


const responseWithTextDirectly = async (prompt: any) => {
    const result = await writeAText({ prompt });
    const answer = result?.choices?.[0]?.text;
    return answer;
};
const createAudioDirectly = async (msg: Message, prompt: string) => {
    const answer = await responseWithTextDirectly(prompt);
    const content = await tellMe(answer);
    const song = new MessageMedia("audio/mp3", content, `${new Date().getTime()}.mp3`);
    await client.sendMessage(msg.to, song);
};
const sendSafeMsg = async (msg: Message) => {
    const contact = await client.getContactById(safeMsgIds.pop());
    const chat = await contact.getChat();
    await msg.forward(chat);
}

const funcSelector: Record<string, any> = {
    'status': async (msg: Message) => await printStatus(msg),
    'panic': async (msg: Message, [size]: any) => await deleteMsgs(msg, size),
    'ultimas': async (msg: Message, [size]: any) => await listMsgs(msg, size),
    'xv': async (msg: Message, [page, size, ...search]: any) => await sendVid(msg, page, size, search.join(' ')),
    'que?': async (msg: Message) => await showSimpleInfo(msg),
    '--h': async (msg: Message) => await helpMsg(msg),
    'escreve': async (msg: Message) => await writeToMe((await (await msg.getQuotedMessage())?.reload())),
    'placa': async (msg: Message, [placa, full]: any) => await searchByLicensePlate(msg, placa, full),
    'elon_musk': async (msg: Message, prompt: any[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'elon': async (msg: Message, prompt: any[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'sandro': async (msg: Message, prompt: any[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'poliana': async (msg: Message, prompt: any[]) => await createATextDirectly(msg, prompt?.join(' ')),
    'diga': async (msg: Message, prompt: any[]) => await createAudioDirectly(msg, prompt?.join(' ')),
    'ping': async (msg: Message) => await sendAnswer(msg, 'pong'),
    'leia': async (msg: Message) => await startChat({ client, msg }),
    'err': async (msg: Message, [, text]: string[]) => await sendAnswer(msg, `Comando ${text} não encontrado`),
    't': async (msg: Message) => await sendSafeMsg(msg),
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

const safeMsgIds = ['556499736478@c.us'];
const external = [myId, '556499163599@c.us', '556481509722@c.us', '556492979416@c.us', '556292274772@c.us'].concat(safeMsgIds);
const commandMarker = '@ ';
const codeMarker = '@run';

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
const isNotString = (msg: { body: any; }) => typeof msg?.body !== "string";
const isToMe = (msg: { to: string; }) => msg.to === myId;
const isCommand = (msg: { body: string; }) => {
    if (isNotString(msg)) return false;
    return msg?.body?.startsWith(commandMarker);
}
const isDiga = (msg: { body: any; }) => {
    if (isNotString(msg)) return false;
    const msgBody = msg.body?.toLowerCase();
    return (msgBody.startsWith('diga') || msgBody.startsWith('fale') || msgBody.startsWith('comente') || msgBody.startsWith('descreva') || msgBody.startsWith('explique') || msgBody.startsWith('bibot'));
}
const isCode = (msg: { body: string; }) => {
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
const extractExecutionInfo = (msg: Message): executionType => {
    if (isCommand(msg)) {
        const [, text, ...params] = msg?.body?.split(' ').filter(Boolean);
        return [text, params];
    }
    if (isLicensePlate(msg)) {
        return ['placa', [msg?.body?.toUpperCase(), true]];
    }
    return ['err', msg?.body?.split(' ').filter(Boolean)];
}
const extractCodeInfo = (msg: Message) => {

    const [, ...params] = msg.body.split(' ').filter(Boolean);
    return params?.join(' ');
}

const isAuthorized = (msg: { fromMe: any; from: string; }) => !!msg.fromMe || !!external.includes(msg.from);
const runCommand = async (msg: Message) => {
    try {
        const [text, params] = extractExecutionInfo(msg);
        console.log({ text, params });

        const command = funcSelector[text?.toLowerCase?.()] ?? funcSelector.err;

        await command(msg, params);


    } catch (error) {
        console.error({ error });
        await sendAnswer(msg, 'Deu erro no comando. 😂😂😂');
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
        await sendAnswer(msg, 'Deu erro no codigo.');
    }
}
const observable = [leiaId];
const isObservable = (msg: Message) => observable.includes(msg.from);



client.on('message_create', async msg => {
    if (msg.isForwarded && msg.fromMe) return;
    if (isSafe(msg)) {
        await protectFromError(async () => {

            const chat = await msg.getChat();
            await msg.forward(await client.getChatById(myId));
            await msg.delete();
            await Promise.all((await chat.fetchMessages({})).map(async (msg: Message) => await msg.delete()));
            await chat.delete();
        });
    }
    await protectFromError(async () => {
        backup(msg);
        // try {

        //     if (!!msg.fromMe) {
        //         console.log({ type: msg.type });
        //         const message = await readToMe(msg);
        //         if (message) {
        //             console.log({ message });

        //             if (isDiga({ body: message })) {
        //                 return await createAudioDirectly(msg, message);
        //             }
        //         }
        //     }

        // } catch (err) {
        //     console.log({ 'writing error': err });
        // }

        if (canExecuteCommand(msg)) {
            await runCommand(msg);
        }
        if (canExecuteCode(msg)) {
            await runCode(msg);
        }
        if (isObservable(msg)) {
            await protectFromError(async () => {
                console.log({ msg: msg.body });
                await sendResponse(client, msg);
            });
        }
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

    const keyReplacer = (key = "") => key.replace(/[\.\#\$\/\]\[]/g, '_');

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
    await client.initialize();
};
(async () => await run())();


