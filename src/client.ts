import { config as dotEnvConfig } from 'dotenv';
import { resolve } from 'path';
dotEnvConfig({ path: resolve('.env') });

import { Entry, Log, Logging } from "@google-cloud/logging";

import * as readline from 'readline/promises';


import dbConfig from './db-config';
import { loadPersonAndCar } from './leia';

import { Database } from 'firebase-admin/database';
import OpenAIManager, { giveMeImage, withConfig, writeAText, writeInstructions } from './ai';
import ChatConfigsManager from './chat-configs-manager';
import CommandConfigsManager from './command-configs-manager';
import Commands from './commands';
import CommandManager from './commands-manager';
import Contexts from './context';
import CurrierModel from './currier';
import AgentTranslation from './dialogflow/agent-translation';
import { Intent } from './dialogflow/intent';
import IoChannel, { SendAnswerParams } from './io-channel';
import MessagesManager from './messages-manager';
import ConsoleMsg from './msg/console-msg';
import { Msg } from './msg/msg';
import SessionsManager from './sessions-manager';
import { readToMe } from './speech-to-text';
import { baseName, botname, ChatConfigType, commandMarkers, keyReplacer } from './util';
import Wikipedia from './wiki';
import Wordpress from './wordpress';
import { initWhatsappClient } from './client-whatsjs';
import { Client } from 'whatsapp-web.js';
import AgentTranslationRemove from './dialogflow/agent-translation-remove';
import * as admin from 'firebase-admin';

const myId = '120363026492757753@g.us';
const leiaId = '551140030407@c.us';

const appData: {
    processMessage?: (receivedMsg: Msg) => Promise<void>;
    actions?: Record<string, any>,
    consoleClient?: readline.Interface;
    ioChannel?: IoChannel;
    commands?: Commands,
    contexts?: Contexts,
    msgs?: MessagesManager,
    sessionManager?: SessionsManager;
    chatConfigsManager?: ChatConfigsManager;
    commandConfigsManager?: CommandConfigsManager;
    logger?: Log;
    fullBaseName?: string;
    whatsappRef?: admin.database.Reference;
    client?: Client;
} = {
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
    const result = await writeAText({ stop: ['stop'], prompt });
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await appData.ioChannel.sendAnswer({ msg, content: answer });
    } else {
        await appData.ioChannel.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
    }
};

const createInstructionsDirectly = async (msg: Msg, prompt: string) => {
    const result = await writeInstructions(prompt);
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await appData.ioChannel.sendAnswer({ msg, content: answer });
    } else {
        await appData.ioChannel.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
    }
};


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
    const result = await writeAText({ stop: ['stop', '\n🤖'], prompt, max_tokens: prompt?.length + 495 });
    const answer = result?.choices?.[0]?.text;
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
const om = async (msg: Msg, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await createAudioDirectly(msg, language, answer);
}
const onlySay = async (params: SendAnswerParams) => {
    return await appData.ioChannel.sendAnswer({ ...params, onlyText: false });
}
const voice = async (msg: Msg, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await onlySay({ msg, content: answer, options: { languageCode: language } });
}

const escreve = async (msg: Msg) => await readToMe(msg.body);
const curie = new CurrierModel(new OpenAIManager().getClient());
const wikipedia = new Wikipedia();
const createPost = async (msg: Msg, prompt?: string[]) => {
    return await sweetTry(msg, async () => {
        const wordpress = new Wordpress(curie);
        const { title, content } = extractPostParams(prompt?.join(' '));
        const response = await wordpress.createAiPost({
            title,
            prompt: content,
            status: 'publish',
        });
        if (!response) {
            return await appData.ioChannel.sendAnswer({ msg, content: `Não consegui criar o post` });
        }
        await appData.ioChannel.sendAnswer({ msg, content: `Post criado com sucesso: ${response.link}` });
    });
}
const forzinhoTranslationAgent = new AgentTranslation('bimbim');
const moveisEstrelaRm = new AgentTranslationRemove('moveis_estrela');
const moveisEstrelaTr = new AgentTranslation('moveis_estrela');

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

const addAdmin = async (msg: Msg) => {
    await appData.commandConfigsManager.save(msg.to);
}

const delAdmin = async (msg: Msg) => {
    await appData.commandConfigsManager.delete(msg.to);
}

const bindChatConfig = async (msg: Msg, prompt: string[]) => {
    const from = msg.to;
    const isAutomatic = prompt?.[0] === 'auto';
    const commands = prompt?.[1]?.split(',')?.map((cmd: string) => cmd.trim());
    await appData.chatConfigsManager.saveConfig(from, commands, isAutomatic);

}


const bindSessionConfig = async (msg: Msg, prompt: string[] = [], prefix = '') => {
    if (!prompt.length) {
        prompt.push('auto', 'b');
    }
    const isAutomatic = prompt?.[0] === 'auto';
    const commands = prompt?.[1]?.split(',')?.map((cmd: string) => cmd.trim());
    await appData.chatConfigsManager.saveConfig(msg.id, commands, isAutomatic, commandMarkers, prefix);


}

const unbindSessionConfig = async (msg: Msg) => {
    await appData.chatConfigsManager.deleteConfig(msg.id);

}

const unbindChatConfig = async (msg: Msg) => {
    const from = msg.to;
    await appData.chatConfigsManager.deleteConfig(from);

}
const safeMsgIds = [];
const external = [myId].concat(safeMsgIds);

const quoteMarkers = ['<add/>', '<add>', '<add />', '<add >', '</>'];
const codeMarker = '@run';
const cmdMarker = '-';
const isUnique = (config) => config.commands.length === 1;


const isSafe = (msg: Msg) => safeMsgIds.includes(msg.from);

const licensePlateSearch = ['556481509722@c.us'];
const isLicensePlate = (msg: Msg) => {
    if (isNotString(msg)) return false;

    const msgContent = msg?.body?.toUpperCase().split(' ').slice(1).join(' ');
    if (isCommand(msg) || msgContent?.split(' ').length > 1 || msgContent?.length > 7) return false;

    return /([A-Z]{3}\d[A-Z]\d{2})|([A-Z]{3}\d{4})/g.test(msgContent.replace(/[^A-Z0-9]+/g, ''));
}


const isNotString = (msg: Msg) => typeof msg?.body !== "string";
const isToMe = (msg: { to: string; }) => msg.to === myId;
const isCommand = (msg: Msg) => {

    if (isNotString(msg)) return false;
    return commandMarkers.filter(commandMarker => msg?.body?.startsWith(commandMarker)).length > 0;
}

const getConfig = async (msg: Msg) => {
    if (isNotString(msg)) return;
    const config = await appData.chatConfigsManager.getByNumberOrSession(msg.from, msg.id);
    if (!config) return;

    if (config.isAutomatic
        || (config.commandMarkers.filter(commandMarker => msg?.body?.startsWith(commandMarker)).length > 0 && config.commands.filter(command => msg?.body?.split(' ')?.[1] === command).length > 0)
    ) {
        return config;
    }
    return;
}
const isCode = (msg: Msg) => {
    if (isNotString(msg)) return false;
    return msg.body.startsWith(codeMarker);
}
const canExecuteCommand = (msg: Msg) => {
    if (isNotString(msg)) return false;
    if (isCommand(msg)) {
        return isAuthorized(msg);
    }
    if (isLicensePlate(msg)) {
        return licensePlateSearch.includes(msg.from) || !!msg.fromMe;
    }
}



type executionType = [string, string[], any] | [string, string[]] | [string, any] | [string];

const extractExecutionInfo = (msg: Msg, config?: ChatConfigType): executionType => {
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

const getEntry = (data: any) => {
    return new Entry(null, data);
}

const isAuthorized = (msg: Msg) => !!msg.fromMe || !!external.includes(msg.from);

const runCommand = async (msg: Msg) => {
    try {
        const [text, params] = extractExecutionInfo(msg, null);
        let command = getAction(text?.toLowerCase?.());
        if (!command) {
            command = getAction('err');
        };

        await command(msg, params);
        await appData.ioChannel.sendReply({ msg, content: 'Executado com sucesso' });
    } catch (error) {
        appData.logger.error(getEntry(error));
        await appData.ioChannel.sendReply({ msg, content: 'Executado com falha' });
    }
}

const runConfig = async (msg: Msg) => {
    const config = await getConfig(msg);
    if (!config) return;
    try {
        const info = extractExecutionInfo(msg, config);
        if (!info) return;
        const [text, params] = info;

        const command = getAction(text?.toLowerCase?.());
        if (!command) return;

        await command(msg, params, config);

    } catch (error) {
        await appData.logger.error(getEntry(error));
        const text = `${config.prefix}Executado com falha`
        await appData.ioChannel.sendAnswer({ msg, content: text });
    }
}



const jsonToText = (err: Record<string, any>) => JSON.stringify(err, null, 4);

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

const quit = async () => {
    await appData.logger.info(getEntry('quit'));
    appData.consoleClient.close();
    process.exit(0);
}
// }

// const desenha = async (msg: Msg, prompt: string) => {
//     if (!prompt) {
//         return  await appData.ioChannel.sendAnswer({msg, content: 'informe o que deseja desenhar'});
//     }
//         const url = await giveMeImage(prompt);
//         const image = await MessageMedia.fromUrl(url)
//         return await chat.sendMessage(image, { sendMediaAsDocument: true, caption: prompt });
//     }
// }
const run = async () => {
    const { admin, app } = await dbConfig()
    db = admin.database();
    const fullBaseName = `${baseName}/${process.env.ME}`;
    appData.fullBaseName = fullBaseName;
    appData.commands = new Commands(db.ref(`${fullBaseName}/commands`));
    appData.contexts = new Contexts(db.ref(`${fullBaseName}/contexts`));
    appData.msgs = new MessagesManager(db.ref(`${fullBaseName}/messages`));
    appData.whatsappRef = db.ref(`${fullBaseName}/whatsapp/update`);
    appData.sessionManager = new SessionsManager();
    appData.chatConfigsManager = new ChatConfigsManager(db.ref(`${fullBaseName}/chatConfigs`));
    appData.commandConfigsManager = new CommandConfigsManager(db.ref(`${fullBaseName}/commandConfigs`));
    appData.logger = new Logging().log(fullBaseName);
    appData.ioChannel = new IoChannel();


    appData.actions = {
        '-': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        escreve,
        '✏': escreve,
        // 'chassi': async (msg: Msg, [placa,]: string[]) => await searchByLicensePlate(msg, placa),
        'elon_musk': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        'key': async (msg: Msg, prompt: string[]) => await appData.ioChannel.sendAnswer({ msg, content: await curie.keyPoints(prompt?.join(' ')) }),
        'keyw': async (msg: Msg, prompt: string[]) => await appData.ioChannel.sendAnswer({ msg, content: await curie.keyWords(prompt?.join(' ')) }),
        'wiki': async (msg: Msg, prompt: string[]) => await appData.ioChannel.sendAnswer({ msg, content: await wikipedia.sumary(prompt?.join(',')) }),
        'demostenes': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
        'maru': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
        'deivid': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', '*Pré atendimento inteligente*'),
        'suporte-n1': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.concat(['?'])?.join(' ')?.trim(), 'suporte-ti', '*Suporte N1*'),
        'juarez': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', splitFor),
        'sextou': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
        '🍻': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
        '💖': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'amor', '*bimbim*'),
        '😔': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        '😭': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        '😢': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        'triste': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        'meupastor': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'wenderson': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'pastor': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'abrão': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'danilo': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'renato': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'dinho': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        '🚚': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        '🚜': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'boso': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'agro': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'goel': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'wellen-beu': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        '🛋': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'pre-venda': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'gean': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'carla': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'wdany': async (msg: Msg, prompt: string[], splitFor = null) => await createATextForConfig(msg, prompt?.join(' '), 'constelacao-familiar', splitFor),
        'sandro': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        'poliana': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        'diga': om,
        om,
        '🔈': voice,
        voice,
        'fala': voice,
        'add': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).addCommand(msg, prompt?.join(' ')),
        'remove': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).removeCommand(msg, prompt?.join(' ')),
        'cmd': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).executeCommand(msg, prompt?.join(' ')),
        'cmd-h': async (msg: Msg, prompt: string[]) => await new CommandManager(appData).listCommands(msg),
        'ping': async (msg: Msg) => await appData.ioChannel.sendAnswer({ msg, content: 'pong' }),
        'fake': async (msg: Msg) => await fakePersonAndCar(msg),
        'err': async (msg: Msg) => await appData.ioChannel.sendAnswer({ msg, content: `Comando *${msg?.body.split(' ')?.[1]}* não encontrado` }),
        'bind': async (msg: Msg, prompt: string[]) => await bindChatConfig(msg, prompt),
        'unbind': async (msg: Msg, prompt: string[]) => await unbindChatConfig(msg),

        'agente': async (msg: Msg, prompt: string[]) => await bindSessionConfig(msg, prompt, botname),
        '-agente': async (msg: Msg, prompt: string[]) => await unbindSessionConfig(msg),
        'admin-add': async (msg: Msg, prompt: string[]) => await addAdmin(msg),
        'admin-del': async (msg: Msg, prompt: string[]) => await delAdmin(msg),
        'posts': async (msg: Msg, prompt: string[]) => console.info(await new Wordpress(curie).getPosts()),
        'post': async (msg: Msg, prompt: string[]) => await createPost(msg, prompt),
        ins: async (msg: Msg, prompt: string[]) => await createInstructionsDirectly(msg, prompt?.join(' ')),
        b: async (msg: Msg, prompt: string[]) => await intentChat(msg, prompt),
        tcr: async (msg: Msg, prompt: string[]) => await intentChat(msg, prompt, process.env.TRAVEL_CAR_RENT_AGENT_ID),
        par: async (msg: Msg, [id, ...prompt]: string[]) => await new Intent().updateIntentParams(),
        tra: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateAgent(),
        trai: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateIntents(),
        traf: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateFlows(),
        trap: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translatePages(),
        trat: async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation().translateTestCases(),
        '4i': async (msg: Msg, [id, ...prompt]: string[]) => await forzinhoTranslationAgent.translateAgent(),
        '4ta': async (msg: Msg, [id, ...prompt]: string[]) => await new AgentTranslation(id).translateAgent(),
        '4mer': async (msg: Msg, [id, ...prompt]: string[]) => await moveisEstrelaRm.removeAgent(),
        '4met': async (msg: Msg, [id, ...prompt]: string[]) => await moveisEstrelaTr.translateEntities(),
        '4t': async (msg: Msg, [id, ...prompt]: string[]) => await forzinhoTranslationAgent.translateTransitionRouteGroup(),
        'quit': async (msg: Msg) => await quit(),
    };


    appData.processMessage = async (receivedMsg: Msg) => {
        if (receivedMsg.fromMe) {
            if (canExecuteCommand(receivedMsg)) {
                return await runCommand(receivedMsg);
            }
        } else {

            return await runConfig(receivedMsg);
        }

    }
};



const initConsoleClient = async (fromMe = false) => {


    appData.consoleClient = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${baseName} > `,
        terminal: true
    });
    appData.consoleClient.write('Bem vindo ao console do bot\n\n');
    appData.consoleClient.prompt();

    appData.consoleClient.on('line', async (line) => {
        const receivedMsg = new ConsoleMsg(line, fromMe);
        await appData.processMessage(receivedMsg);
        appData.consoleClient.prompt();
    });
    appData.consoleClient.on('close', async () => {
        console.info('\nAté mais!\n');
    });
    appData.consoleClient.on('error', async (err) => {
        console.error(err);
    });
}
(async () => {
    await run();
    const exectParam = process.argv[2];
    const runner = {
        'console': async () => await initConsoleClient(true),
        'whats': async () => await initWhatsappClient(appData),
        'both': async () => {
            await initConsoleClient();
            await initWhatsappClient(appData);
        }
    };
    await runner[exectParam]?.();

})();

