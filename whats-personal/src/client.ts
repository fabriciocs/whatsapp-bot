
import * as functions from 'firebase-functions';
import { withConfig, writeAText, writeInstructions } from './ai';
import ChatConfigsManager from './chat-configs-manager';
import { Intent } from './dialogflow/intent';
import IoChannel, { SendAnswerParams } from './io-channel';
import { Msg } from './msg/msg';
import { readToMe } from './speech-to-text';
import { baseName, botname, ChatConfigType, commandMarkers, keyReplacer } from './util';


const appData: {
    processMessage?: (receivedMsg: Msg) => Promise<void>;
    actions?: Record<string, any>,
    ioChannel?: IoChannel;
    chatConfigsManager?: ChatConfigsManager;
} = {};




const createATextDirectly = async (msg: Msg, prompt: string) => {
    const result = await writeAText({ stop: ['stop'], prompt });
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await appData.ioChannel?.sendAnswer({ msg, content: answer });
    } else {
        await appData.ioChannel?.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
    }
};

const createInstructionsDirectly = async (msg: Msg, prompt: string) => {
    const result = await writeInstructions(prompt);
    const answer = result?.choices?.[0]?.text;
    if (answer) {
        await appData.ioChannel?.sendAnswer({ msg, content: answer });
    } else {
        await appData.ioChannel?.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
    }
};


const createATextForConfig = async (msg: Msg, prompt: any, config: string, splitFor: string = '', isAudio = false) => {
    const result = await withConfig(prompt, config);
    const answer = result?.choices?.[0]?.text?.trim();
    if (answer) {
        if (msg.isAudio) {
            splitFor = ' ';
        }
        const response = splitFor ? answer.replace('🤖', splitFor) : answer;
        await appData.ioChannel?.sendAnswer({ msg, content: response });
    } else {
        await appData.ioChannel?.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" });
    }
};


const responseWithTextDirectly = async (prompt: string) => {
    const result = await writeAText({ stop: ['stop', '\n🤖'], prompt, max_tokens: prompt?.length + 495 });
    const answer = result?.choices?.[0]?.text ?? '';
    return answer;
};

const createAudioDirectly = async (msg: Msg, languageCode: string, prompt: string) => {
    const answer = await responseWithTextDirectly(prompt);
    await onlySay({ msg, options: { languageCode }, content: answer });
};


const extractLanguageAndAnswer = ([first, ...prompt]: string[]) => {
    const language = first?.includes?.('::') ? first.replace('::', '') : 'pt-BR';
    const answer = [!language ? first : '', ...prompt].join(' ');
    return { language, answer };
}
const om = async (msg: Msg, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await createAudioDirectly(msg, language, answer);
}
const onlySay = async (params: SendAnswerParams) => {
    return await appData.ioChannel?.sendAnswer({ ...params, onlyText: false });
}
const voice = async (msg: Msg, prompt: string[]) => {
    const { language, answer } = extractLanguageAndAnswer(prompt);
    return await onlySay({ msg, content: answer, options: { languageCode: language } });
}

const escreve = async (msg: Msg) => await readToMe(msg.body);

const getAction = (key: string) => {
    return appData?.actions?.[key];
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
            await appData.ioChannel?.sendReply({ msg, content: resp ?? '' });
            continue;
        }
        await appData.ioChannel?.sendAnswer({ msg, content: resp ?? '' });
    }
}
const bindChatConfig = async (msg: Msg, prompt: string[]) => {
    const from = msg.to;
    const isAutomatic = prompt?.[0] === 'auto';
    const commands = prompt?.[1]?.split(',')?.map((cmd: string) => cmd.trim());
    await appData.chatConfigsManager?.saveConfig(from, commands, isAutomatic);

}


const bindSessionConfig = async (msg: Msg, prompt: string[] = [], prefix = '') => {
    if (!prompt.length) {
        prompt.push('auto', 'b');
    }
    const isAutomatic = prompt?.[0] === 'auto';
    const commands = prompt?.[1]?.split(',')?.map((cmd: string) => cmd.trim());
    await appData.chatConfigsManager?.saveConfig(msg.id, commands, isAutomatic, commandMarkers, prefix);


}

const unbindSessionConfig = async (msg: Msg) => {
    await appData.chatConfigsManager?.deleteConfig(msg.id);

}

const unbindChatConfig = async (msg: Msg) => {
    const from = msg.to;
    await appData.chatConfigsManager?.deleteConfig(from);

}

const isNotString = (msg: Msg) => typeof msg?.body !== "string";
const getConfig = async (msg: Msg) => {
    if (isNotString(msg)) return;
    const config = await appData.chatConfigsManager?.getByNumberOrSession(msg.from, msg.id);
    if (!config) return;

    if (config.isAutomatic
        || (config.commandMarkers.filter((commandMarker: any) => msg?.body?.startsWith(commandMarker)).length > 0 && config.commands.filter((command: any) => msg?.body?.split(' ')?.[1] === command).length > 0)
    ) {
        return config;
    }
    return;
}
const isCommand = (msg: Msg) => {

    if (isNotString(msg)) return false;
    return commandMarkers.filter(commandMarker => msg?.body?.startsWith(commandMarker)).length > 0;
}


type executionType = [string, string[], any] | [string, string[]] | [string, any] | [string];

const extractExecutionInfo = (msg: Msg, config?: ChatConfigType): executionType | undefined => {
    if (isCommand(msg) || config?.isAutomatic) {
        const buildBody = `${config?.isAutomatic ? 'auto ' : ''}${config?.isUnique?.() ? `${config?.commands?.[0]} ` : ''}${msg?.body}`;
        const [, text, ...params] = buildBody.split(/\s/).filter(Boolean);
        return [text, params];
    }
    return;
}


const runConfig = async (msg: Msg) => {
    const config = await getConfig(msg);
    functions.logger.debug('config', {config});
    if (!config) return;
    try {
        const info = extractExecutionInfo(msg, config);
        functions.logger.debug('info', {info});
        if (!info) return;
        const [text, params] = info;

        
        functions.logger.debug('text', {text});
        functions.logger.debug('params', {params});

        const command = getAction(text?.toLowerCase?.());
        if (!command) return;
        functions.logger.debug('command', {command});
        await command(msg, params, config);

    } catch (error) {
        functions.logger.error(error);
        const text = `${config.prefix}Executado com falha`
        await appData.ioChannel?.sendAnswer({ msg, content: text });
    }
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

const canExecuteCommand = (msg: Msg) => {
    if (isCommand(msg)) {
        return true;
    }
    return false;
}

const runCommand = async (msg: Msg) => {
    try {
        const [text, params] = extractExecutionInfo(msg) ?? [];
        if (text) {
            let command = getAction(text?.toLowerCase?.());
            if (!command) {
                command = getAction('err');
            };

            await command(msg, params);
            await appData.ioChannel?.sendReply({ msg, content: 'Executado com sucesso' });
        }
    } catch (error) {
        functions.logger.error(error);
        await appData.ioChannel?.sendReply({ msg, content: 'Executado com falha' });
    }
}
const run = async () => {
    const fullBaseName = `${baseName}/${process.env.ME}`;
    const db = functions.app.admin.database();
    const adminsObj = (await db.ref('whatsapp').child('admins').get())?.val();
    functions.logger.info('adminsObj', {adminsObj});
    const admins = Object.keys(adminsObj);
    functions.logger.info('admins', {admins});
    appData.chatConfigsManager = new ChatConfigsManager(db.ref(`${fullBaseName}/chatConfigs`));
    appData.ioChannel = new IoChannel();


    appData.actions = {
        '-': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        escreve,
        '✏': escreve,
        // 'chassi': async (msg: Msg, [placa,]: string[]) => await searchByLicensePlate(msg, placa),
        'elon_musk': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')), 'demostenes': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
        'maru': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'candidato-c', splitFor),
        'deivid': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', '*Pré atendimento inteligente*'),
        'suporte-n1': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.concat(['?'])?.join(' ')?.trim(), 'suporte-ti', '*Suporte N1*'),
        'juarez': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', splitFor),
        'sextou': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
        '🍻': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'sextou', splitFor),
        '💖': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'amor', '*bimbim*'),
        '😔': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        '😭': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        '😢': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        'triste': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'triste', splitFor),
        'meupastor': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'wenderson': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'pastor': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'abrão': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'danilo': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'renato': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'dinho': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        '🚚': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        '🚜': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'boso': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'agro': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'goel': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        'wellen-beu': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'bolsonarista', splitFor),
        '🛋': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'pre-venda': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'gean': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'carla': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'wdany': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'constelacao-familiar', splitFor),
        'sandro': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        'poliana': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        'diga': om,
        om,
        '🔈': voice,
        voice,
        'fala': voice,
        'ping': async (msg: Msg) => await appData.ioChannel?.sendAnswer({ msg, content: 'pong' }),

        'err': async (msg: Msg) => await appData.ioChannel?.sendAnswer({ msg, content: `Comando *${msg?.body.split(' ')?.[1]}* não encontrado` }),
        'bind': async (msg: Msg, prompt: string[]) => await bindChatConfig(msg, prompt),
        'unbind': async (msg: Msg, prompt: string[]) => await unbindChatConfig(msg),

        'agente': async (msg: Msg, prompt: string[]) => await bindSessionConfig(msg, prompt, botname),
        '-agente': async (msg: Msg, prompt: string[]) => await unbindSessionConfig(msg),

        ins: async (msg: Msg, prompt: string[]) => await createInstructionsDirectly(msg, prompt?.join(' ')),
        b: async (msg: Msg, prompt: string[]) => await intentChat(msg, prompt),
        tcr: async (msg: Msg, prompt: string[]) => await intentChat(msg, prompt, process.env.TRAVEL_CAR_RENT_AGENT_ID),
        par: async (msg: Msg, [id, ...prompt]: string[]) => await new Intent().updateIntentParams(),
    };


    appData.processMessage = async (receivedMsg: Msg) => {
        if (admins?.includes(receivedMsg.from)) {
            if (canExecuteCommand(receivedMsg)) {
                return await runCommand(receivedMsg);
            }
        }
        return await runConfig(receivedMsg);
    }
    return appData;
};

export default {
    run
};

