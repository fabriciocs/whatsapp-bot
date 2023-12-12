import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config();


import * as readline from 'readline';


import dbConfig from './db-config';

import { protos, v1beta2 } from '@google-cloud/language';
import { Database } from 'firebase-admin/database';
import { readFile, readdir, writeFile } from 'fs/promises';
import { simpleChat, withConfig } from './ai';
import { AppData } from './app-data';
import { initWhatsappClient } from './client-whatsjs';
import Commands from './commands';
import Contexts from './context';
import { Intent } from './dialogflow/intent';
import IoChannel, { SendAnswerParams } from './io-channel';
import { geradorCpf, loadPersonAndCar } from './leia';
import ConsoleMsg from './msg/console-msg';
import { Msg, MsgTypes } from './msg/msg';
import { readToMe } from './speech-to-text';
import { tellMe } from './textToSpeach';
import { ChatConfigType, baseName, botname, commandMarkers } from './util';
import Wikipedia from './wiki';

const myId = '120363026492757753@g.us';
const leiaId = '551140030407@c.us';
const appData: AppData = {
    lockConversation: {},
    systemMessageDefault: 'Atue como um assistente pessoal',
    conversations: {},
    promptBase: {
        'AlivioGPT': "Você é AlivioGPT, um especialista em apoio a superação de crises de ansiedade.",
        'FabrícioSantosGPT': "Você é FabrícioSantosGPT, CTO experiente e fundador da Luau Tech com mais de 12 anos de experiência em soluções software. Apaixonado por padrões de design, código de qualidade e trabalho em equipe. Habilidoso em .Net, Java, Node, Flutter e ChatGPT. Engajado na comunidade e focado na família. Pai, marido e irmão. Experiência em Arquitetura, Engenharia e Design de Software, além de Liderança, Gestão e Execução de soluções de software de grande porte, alta disponibilidade e escalabilidade. Gentil, prestativo e atencioso. Sua missão é conversar em um chat do whatsapp"
    },
    agentCommands: {
        'AlivioGPT': '.alivio',
        'FabrícioSantosGPT': '.eu'
    },
    agentExample: {
        'AlivioGPT': {
            input: 'Oi',
            output: 'Olá, AlivioGPT, um especialista em apoio a superação de crises de ansiedade. Em que posso te auxiliar?'
        },
        'FabrícioSantosGPT': {
            input: 'Oi',
            output: 'Olá, em que posso te ajudar?'
        }
    }
};



let db: Database = null;

const sweetError = async (msg: Msg, err: Record<string, any>) => {
    if (msg && err?.err) {
        await appData.ioChannel.sendAnswer({ msg, content: err.err });
    }
    if (err) {
        await appData.ioChannel.sendAnswer({ msg, content: jsonToText(err) });
    }
}


const sweetTry = async <T>(msg: Msg, func: () => Promise<T>): Promise<T | string> => {
    try {
        return await func?.();
    } catch (err) {
        await sweetError(msg, err);
        return 'Erro ao executar instrução';
    }

}





const createATextDirectly = async (msg: Msg, prompt: string) => {
    const answer = await simpleChat(appData.systemMessageDefault, prompt);
    if (answer) {
        await appData.ioChannel.sendAnswer({ msg, content: answer });
    } else {
        await appData.ioChannel.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
    }
};

// const createInstructionsDirectly = async (msg: Msg, prompt: string) => {
//     const result = await writeInstructions(prompt);
//     const answer = result?.choices?.[0]?.text;
//     if (answer) {
//         await appData.ioChannel.sendAnswer({ msg, content: answer });
//     } else {
//         await appData.ioChannel.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
//     }
// };


const createATextForConfig = async (msg: Msg, prompt: any, config: string, splitFor: string = null, isAudio = false) => {
    const result = await withConfig(prompt, config);
    const answer = result?.choices?.[0]?.text?.trim();
    if (answer) {
        if (msg.isAudio) {
            splitFor = ' ';
        }
        const response = splitFor ? answer.replace('🤖', splitFor) : answer;
        await appData.ioChannel.sendAnswer({ msg, content: response });
    } else {
        await appData.ioChannel.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
    }
};


const responseWithTextDirectly = async (prompt: string) => {
    // const result = await writeAText({ stop: ['stop', '\n🤖'], prompt, max_tokens: prompt?.length + 495 });
    const answer = await simpleChat(appData.systemMessageDefault, prompt);
    return answer;
};

const createAudioDirectly = async (msg: Msg, languageCode: string, prompt: string) => {
    const answer = await responseWithTextDirectly(prompt);
    await onlySay({ msg, options: { languageCode }, content: answer });
};



const fakePersonAndCar = async (msg: Msg) => {
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
    await appData.ioChannel.sendAnswer({ msg, content });

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

const extractParams = (requestText: string) => {
    const groups = requestText.matchAll(/([a-zA-Z0-9]+?:.*?\/>)+/gm);
    const [, , title, , content] = groups?.next()?.value;
    return { title, content };
}
const om = async (msg: Msg, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await createAudioDirectly(msg, language, answer);
}
const onlySay = async ({ msg, ...params }: SendAnswerParams) => {
    msg.type = MsgTypes.AUDIO;
    return await appData.ioChannel.sendAnswer({ ...params, msg, onlyText: false });
}
const voice = async (msg: Msg, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await onlySay({ msg, content: answer, options: { languageCode: language } });
}


// const curie = new CurrierModel(new OpenAIManager().getClient());
const wikipedia = new Wikipedia();
const createPost = async (msg: Msg, prompt?: string[]) => {
    return await sweetTry(msg, async () => {
        // const wordpress = new Wordpress(curie);
        // const { title, content } = extractPostParams(prompt?.join(' '));
        // const response = await wordpress.createAiPost({
        //     title,
        //     prompt: content,
        //     status: 'publish',
        // });
        // if (!response) {
            return await appData.ioChannel.sendAnswer({ msg, content: `Não consegui criar o post` });
        // }
        // await appData.ioChannel.sendAnswer({ msg, content: `Post criado com sucesso: ${response.link}` });
    });
}


const listPosts = async (msg: Msg, prompt?: string[]) => {
    return await sweetTry(msg, async () => {
        // const wordpress = new Wordpress(curie);
        // const { title, content } = extractPostParams(prompt?.join(' '));
        // const response = await wordpress.createAiPost({
        //     title,
        //     prompt: content,
        //     status: 'publish',
        // });
        // if (!response) {
            return await appData.ioChannel.sendAnswer({ msg, content: `Não consegui criar o post` });
        // }
        // await appData.ioChannel.sendAnswer({ msg, content: `Post criado com sucesso: ${response.link}` });
    });
}
// const forzinhoTranslationAgent = new AgentTranslation('bimbim');
// const moveisEstrelaRm = new AgentTranslationRemove('moveis_estrela');
// const moveisEstrelaTr = new AgentTranslation('moveis_estrela');

const getAction = (key: string) => {
    return appData.actions[key];
}

const intentChat = async (msg: Msg, prompt: string[], agentId = process.env.AGENT_ID) => {

    const text = msg.isAudio ? msg.body : prompt?.join(' ');
    const params = {
        id: msg.id, text,
        isSound: msg.isAudio,
        agentId
    };
    const responses = await new Intent().getIntent(params);

    for (let i = 0; i < responses?.length; i++) {
        const resp = msg.isAudio ? responses[i] : `${botname}: ${responses[i]}`;
        if (i === 0) {
            await appData.ioChannel.sendReply({ msg, content: resp });
            continue;
        }
        await appData.ioChannel.sendAnswer({ msg, content: resp });
    }
}

// const addAdmin = async (msg: Msg) => {
//     await appData.commandConfigsManager.save(msg.to);
// }

// const delAdmin = async (msg: Msg) => {
//     await appData.commandConfigsManager.delete(msg.to);
// }

// const bindChatConfig = async (msg: Msg, prompt: string[]) => {
//     const from = msg.to;
//     const isAutomatic = prompt?.[0] === 'auto';
//     const commands = prompt?.[1]?.split(',')?.map((cmd: string) => cmd.trim());
//     await appData.chatConfigsManager.saveConfig(from, commands, isAutomatic);

// }


// const bindSessionConfig = async (msg: Msg, prompt: string[] = [], prefix = '') => {
//     if (!prompt.length) {
//         prompt.push('auto', 'b');
//     }
//     const isAutomatic = prompt?.[0] === 'auto';
//     const commands = prompt?.[1]?.split(',')?.map((cmd: string) => cmd.trim());
//     await appData.chatConfigsManager.saveConfig(msg.id, commands, isAutomatic, commandMarkers, prefix);


// }

// const unbindSessionConfig = async (msg: Msg) => {
//     await appData.chatConfigsManager.deleteConfig(msg.id);

// }

// const unbindChatConfig = async (msg: Msg) => {
//     const from = msg.to;
//     await appData.chatConfigsManager.deleteConfig(from);

// }
const safeMsgIds = [];
const external = [myId].concat(safeMsgIds);

const quoteMarkers = ['<add/>', '<add>', '<add />', '<add >', '</>'];
const codeMarker = '@run';
const cmdMarker = '-';
const isUnique = (config) => config.commands.length === 1;


const isSafe = (msg: Msg) => safeMsgIds.includes(msg.from);

// const licensePlateSearch = ['556481509722@c.us'];
// const isLicensePlate = (msg: Msg) => {
//     if (isNotString(msg)) return false;

//     const msgContent = msg?.body?.toUpperCase().split(' ').slice(1).join(' ');
//     if (isCommand(msg) || msgContent?.split(' ').length > 1 || msgContent?.length > 7) return false;

//     return /([A-Z]{3}\d[A-Z]\d{2})|([A-Z]{3}\d{4})/g.test(msgContent.replace(/[^A-Z0-9]+/g, ''));
// }


const isNotString = (msg: Msg) => typeof msg?.body !== "string";
// const isToMe = (msg: { to: string; }) => msg.to === myId;
const isCommand = (msg: Msg) => {

    if (isNotString(msg)) return false;
    return commandMarkers.filter(commandMarker => msg?.body?.startsWith(commandMarker)).length > 0;
}

// const getConfig = async (msg: Msg) => {
//     if (isNotString(msg)) return;
//     const config = await appData.chatConfigsManager.getByNumberOrSession(msg.from, msg.id);
//     if (!config) return;

//     if (config.isAutomatic
//         || (config.commandMarkers.filter(commandMarker => msg?.body?.startsWith(commandMarker)).length > 0 && config.commands.filter(command => msg?.body?.split(' ')?.[1] === command).length > 0)
//     ) {
//         return config;
//     }
//     return;
// }
const isCode = (msg: Msg) => {
    if (isNotString(msg)) return false;
    return msg.body.startsWith(codeMarker);
}
const canExecuteCommand = async (msg: Msg) => {
    // return false;
    if (isNotString(msg)) return false;
    if (isCommand(msg)) {
        return isAuthorized(msg);
    }
    const agentName = await appData.getAgent(msg);
    return !!agentName;
    // if (isLicensePlate(msg)) {
    //     return licensePlateSearch.includes(msg.from) || !!msg.fromMe;
    // }
}



type executionType = [string, string[], any] | [string, string[]] | [string, any] | [string];

const extractExecutionInfo = async (msg: Msg, config?: ChatConfigType): Promise<executionType> => {

    const agentName = await appData.getAgent(msg);
    if (!!agentName) {
        const agentCommand = appData.agentCommands?.[agentName];
        if (!!agentCommand) {
            let params = msg?.body?.split(/\s/).filter(Boolean);
            if (isCommand(msg)) {
                params = params.slice(2);
            }
            return [agentCommand, params];
        }
    }
    if (isCommand(msg) || config?.isAutomatic) {
        const buildBody = `${config?.isAutomatic ? 'auto ' : ''}${config?.isUnique?.() ? `${config?.commands?.[0]} ` : ''}${msg?.body}`;
        const [, text, ...params] = buildBody.split(/\s/).filter(Boolean);
        return [text, params];
    }

    // if (isLicensePlate(msg)) {
    //     return ['placa', [msg?.body?.toUpperCase(), true]];
    // }
    return null;
}

// const getEntry = (data: any) => {
//     return new Entry(null, data);
// }

const isAuthorized = (msg: Msg) => !!msg.fromMe || !!external.includes(msg.from);

const runCommand = async (msg: Msg) => {
    try {
        const [text, params] = await extractExecutionInfo(msg, null);
        console.log(`${msg.from}: ${text} ${params?.length ?? 0}`);
        let command = getAction(text?.toLowerCase?.());
        if (!command) {
            command = getAction('err');
        };

        await command(msg, params);
        // await appData.ioChannel.sendReply({ msg, content: 'Executado com sucesso' });
    } catch (error) {
        console.error(error);
        await appData.ioChannel.sendReply({ msg, content: 'Executado com falha' });
    }
}

// const runConfig = async (msg: Msg) => {
//     const config = await getConfig(msg);
//     if (!config) return;
//     try {
//         const info = extractExecutionInfo(msg, config);
//         if (!info) return;
//         const [text, params] = info;

//         const command = getAction(text?.toLowerCase?.());
//         if (!command) return;

//         await command(msg, params, config);

//     } catch (error) {
//         await appData.logger.error(getEntry(error));
//         const text = `${config.prefix}Executado com falha`
//         await appData.ioChannel.sendAnswer({ msg, content: text });
//     }
// }



const jsonToText = (err: Record<string, any>) => JSON.stringify(err, null, 4);
// 
// const prepareJsonToFirebase = (obj: Record<string, any>) => {
//     if (!obj) return null;
//     return Object.keys(obj).reduce((acc, fullKey) => {
//         const key = keyReplacer(fullKey);

//         if (typeof obj[fullKey] === 'object') {
//             acc[key] = prepareJsonToFirebase(obj[fullKey]);
//         } else {
//             acc[key] = obj[fullKey];
//         }
//         return acc;
//     }, {} as Record<string, any>);
// };

// const quit = async () => {
//     await appData.logger.info(getEntry('quit'));
//     appData.consoleClient.close();
//     process.exit(0);
// }
const buildAIDocument = async (msg: Msg, prompt: string[]) => {
    //analize as entidades do documento
    const service = new v1beta2.LanguageServiceClient();
    const request: protos.google.cloud.language.v1beta2.IAnalyzeEntitiesRequest = {
        document: {
            content: prompt.join(' '),
            type: 'PLAIN_TEXT'
        },
        encodingType: 'UTF8'
    };
    const [result] = await service.analyzeEntities(request);
    const entities = result.entities;
    const entityMap = entities.reduce((acc, entity) => {
        acc[entity.name] = entity.type;
        return acc;
    }, {} as Record<string, any>);

    console.log({
        entityMap,
    })
    await appData.ioChannel.sendReply({ msg, content: JSON.stringify({ entityMap }, null, 4) });
}
const run = async () => {
    const { admin, app } = await dbConfig()
    db = admin.database();
    const fullBaseName = `${baseName}/${process.env.ME}`;
    // appData.fullBaseName = fullBaseName;
    appData.commands = new Commands(db.ref(`${fullBaseName}/commands`));
    appData.contexts = new Contexts(db.ref(`${fullBaseName}/contexts`));
    // appData.msgs = new MessagesManager(db.ref(`${fullBaseName}/messages`));
    // appData.whatsappRef = db.ref(`${fullBaseName}/whatsapp/update`);
    // appData.chatConfigsManager = new ChatConfigsManager(db.ref(`${fullBaseName}/chatConfigs`));
    // appData.commandConfigsManager = new CommandConfigsManager(db.ref(`${fullBaseName}/commandConfigs`));
    appData.ioChannel = new IoChannel();
    // appData.mediaManager = new MediaManager();

    // appData.logger = new Logger(dbh.ref(`${fullBaseName}/logs`));
    const escreve = async (msg: Msg, prompt: string[]) => {
        await createATextDirectly(msg, prompt?.join(' '));
    }
    appData.actions = {
        'todo': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, `Analise o texto e reponda com um TODO list:"""${prompt?.join(' ')}"""`),
        escreve,
        '✏': escreve,
        // 'chassi': async (msg: Msg, [placa,]: string[]) => await searchByLicensePlate(msg, placa),
        // 'elon_musk': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        // 'key': async (msg: Msg, prompt: string[]) => await appData.ioChannel.sendAnswer({ msg, content: await curie.keyPoints(prompt?.join(' ')) }),
        // 'keyw': async (msg: Msg, prompt: string[]) => await appData.ioChannel.sendAnswer({ msg, content: await curie.keyWords(prompt?.join(' ')) }),
        // 'wiki': async (msg: Msg, prompt: string[]) => await appData.ioChannel.sendAnswer({ msg, content: await wikipedia.sumary(prompt?.join(',')) }),
        // 'demostenes': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
        // 'maru': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
        'deivid': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', '*Pré atendimento inteligente*'),
        // 'suporte-n1': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.concat(['?'])?.join(' ')?.trim(), 'suporte-ti', '*Suporte N1*'),
        // 'juarez': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', splitFor),
        // 'sextou': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
        // '🍻': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
        // '💖': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'amor', '*bimbim*'),
        // '😔': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        // '😭': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        // '😢': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        // 'triste': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        // 'meupastor': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        // 'wenderson': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        // 'pastor': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        // 'abrão': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        // 'danilo': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // 'renato': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // 'dinho': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // '🚚': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // '🚜': async (msg: Msg,Fq prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // 'boso': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // 'agro': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // 'goel': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // 'wellen-beu': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        // '🛋': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'pre-venda': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        // 'gean': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        // 'carla': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        // 'wdany': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'constelacao-familiar', splitFor),
        // 'sandro': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        // 'poliana': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        'diga': om,
        // desenha: async (msg: Msg, prompt: string[]) => await giveMeImage(prepareText(imagePrompt), '1024x1024');
        om,
        '🔈': voice,
        voice,
        'fala': voice,
        // 'add': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).addCommand(msg, prompt?.join(' ')),
        // 'remove': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).removeCommand(msg, prompt?.join(' ')),
        // 'cmd': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).executeCommand(msg, prompt?.join(' ')),
        // 'cmd-h': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).listCommands(msg),
        // 'ping': async (msg: Msg) => await appData.ioChannel.sendAnswer({ msg, content: 'pong' }),
        // 'fake': async (msg: Msg) => await fakePersonAndCar(msg),
        // 'err': async (msg: Msg) => await appData.ioChannel.sendAnswer({ msg, content: `Comando *${msg?.body.split(' ')?.[1]}* não encontrado` }),
        // 'bind': async (msg: Msg, prompt: string[]) => await bindChatConfig(msg, prompt),
        // 'unbind': async (msg: Msg, prompt: string[]) => await unbindChatConfig(msg),

        // 'agente': async (msg: Msg, prompt: string[]) => await bindSessionConfig(msg, prompt, botname),
        // '-agente': async (msg: Msg, prompt: string[]) => await unbindSessionConfig(msg),
        // 'admin-add': async (msg: Msg, prompt: string[]) => await addAdmin(msg),
        // 'admin-del': async (msg: Msg, prompt: string[]) => await delAdmin(msg),
        // 'posts': async (msg: Msg, prompt: string[]) => console.info(await new Wordpress(curie).getPosts()),
        // 'post': async (msg: Msg, prompt: string[]) => await createPost(msg, prompt),
        // ins: async (msg: Msg, prompt: string[]) => await createInstructionsDirectly(msg, prompt?.join(' ')),
        sheguinho: async (msg: Msg, prompt: string[]) => await intentChat(msg, prompt),
        // tcr: async (msg: Msg, prompt: string[]) => await intentChat(msg, prompt, process.env.TRAVEL_CAR_RENT_AGENT_ID),
        // par: async (msg: Msg, [id, ...prompt]: string[]) => await new Intent().updateIntentParams(),
        // tra: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateAgent(),
        // trai: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateIntents(),
        // traf: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateFlows(),
        // trap: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translatePages(),
        // trat: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateTestCases(),
        // '4i': async (msg: Msg, [id, ...prompt]: string[]) => await forzinhoTranslationAgent.translateAgent(),
        // '4ta': async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation(id).translateAgent(),
        // '4mer': async (msg: Msg, [id, ...prompt]: string[]) => await moveisEstrelaRm.removeAgent(),
        // '4met': async (msg: Msg, [id, ...prompt]: string[]) => await moveisEstrelaTr.translateEntities(),
        // '4t': async (msg: Msg, [id, ...prompt]: string[]) => await forzinhoTranslationAgent.translateTransitionRouteGroup(),
        // 'quit': async (msg: Msg) => await quit(),
        'document': async (msg: Msg, prompt: string[]) => await buildAIDocument(msg, prompt),
        'cpf': async (msg: Msg, prompt: string[]) => await msg.reply(await geradorCpf())
    };


    appData.processMessage = async (receivedMsg: Msg) => {

        if (await canExecuteCommand(receivedMsg)) {

            return await runCommand(receivedMsg);
        }

    }
};



const initConsoleClient = async (fromMe = false) => {

    const escreve = async (msg: Msg, prompt: string[]): Promise<void> => {
        const { language, answer } = extractLanguageAndAnswer(prompt);
        const filePath = await resolve(answer);
        const base64 = await readFile(filePath, { encoding: 'base64' });
        console.log({ language, answer, filePath });
        const content = await readToMe(base64, language);
        await appData.ioChannel.sendAnswer({ msg, content, onlyText: true });
    };

    const escreveTodos = async (msg: Msg, prompt: string[]): Promise<void> => {
        const { language, answer } = extractLanguageAndAnswer(prompt);
        const folderPath = await resolve(answer);
        const files = await readdir(folderPath);
        const filePaths = files?.filter(file => file.endsWith('.ogg'))?.map(file => resolve(folderPath, file)) ?? [];
        const allTexts = [];
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const base64 = await readFile(filePath, { encoding: 'base64' });
            const content = await readToMe(base64, language ?? 'pt-BR');
            allTexts.push(content);
        }
        await appData.ioChannel.sendAnswer({ msg, content: allTexts.join('\n\n - '), onlyText: true });
    };
    const tell = async (msg: Msg, prompt: string[]): Promise<void> => {
        const buffer = await tellMe(prompt?.join(' '), 'pt-BR');
        const fileName = `${Date.now()}.ogg`;
        const fullPath = resolve('./', fileName);
        await writeFile(fullPath, buffer);

        await appData.ioChannel.sendAnswer({ msg, content: fullPath, onlyText: true });
    };
    appData.actions['tell'] = tell;
    appData.actions['escreve'] = escreve;
    appData.actions['wr'] = escreve;
    appData.actions['et'] = escreveTodos;

    appData.consoleClient = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${baseName} > `,
        terminal: true
    });
    // All the files with blue arrow are the build files of my Portfolio Web Application, while the Copyable 
    appData.consoleClient.write('Bem vindo ao console do bot\n\n');
    appData.consoleClient.prompt();

    appData.consoleClient.on('line', async (line) => {
        const receivedMsg = new ConsoleMsg(line, fromMe);
        await appData.processMessage(receivedMsg);
        appData.consoleClient.prompt();
    });
    appData.consoleClient.on('close', async () => {
        console.info('\nAté mais!\n');
        process.exit(0);
    });
    appData.consoleClient.on('error', async (err) => {
        console.error(err);
    });
}
(async () => {
    await run();
    await initWhatsappClient(appData);
})();

