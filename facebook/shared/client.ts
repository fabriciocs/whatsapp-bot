
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { withConfig, writeAText } from './ai';
import ChatConfigsManager from './chat-configs-manager';
import { Intent } from './dialogflow/intent';
import IoChannel from './io-channel';
import { Msg } from './msg/msg';
import { loadSecrets, Secrets } from './secrets';
import { botname, ChatConfigType, commandMarkers, keyReplacer } from './util';


const appData: {
    processMessage?: (receivedMsg: Msg) => Promise<void>;
    actions?: Record<string, any>,
    ioChannel?: IoChannel;
    chatConfigsManager?: ChatConfigsManager;
    secrets?: Secrets
} = {
};




const createATextDirectly = async (msg: Msg, prompt: string) => {
    const result = await writeAText({ stop: ['stop'], prompt });
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

const isNotString = (msg: Msg) => typeof msg?.body !== "string";
const getConfig = async (msg: Msg) => {
    if (isNotString(msg)) return;
    const config = await appData.chatConfigsManager?.getBySessionOrNumber(msg.id, msg.from);
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
    if (!config) return;
    try {
        functions.logger.debug('config', { config });
        const info = extractExecutionInfo(msg, config);
        functions.logger.debug('info', { info });
        if (!info) return;
        const [text, params] = info;


        functions.logger.debug('text', { text });
        functions.logger.debug('params', { params });

        const command = getAction(text?.toLowerCase?.());
        if (!command) return;
        functions.logger.debug('command', { command });
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

    const db = admin.initializeApp().database();
    appData.secrets = loadSecrets(process.env.INTEGRATION!)
    appData.chatConfigsManager = new ChatConfigsManager(db.ref(`whatsapp/chatConfigs`));
    appData.ioChannel = new IoChannel();

    appData.actions = {
        '-': async (msg: Msg, prompt: string[]) => await createATextDirectly(msg, prompt?.join(' ')),
        'clean-db': async (msg: Msg, prompt: string[]) => await db.refFromURL('https://bot-4customers-default-rtdb.firebaseio.com/bot-4customers').set(null),
        'vereador': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'vereador-c', '*Pré atendimento inteligente*'),
        'suporte-n1': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.concat(['?'])?.join(' ')?.trim(), 'suporte-ti', '*Suporte N1*'),
        '💖': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'amor', '*bimbim*'),
        'pastor': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'pastor', splitFor),
        'pre-venda': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'gean': async (msg: Msg, prompt: string[], splitFor = '') => await createATextForConfig(msg, prompt?.join(' '), 'moveis-estrela', splitFor),
        'ping': async (msg: Msg) => await appData.ioChannel?.sendAnswer({ msg, content: 'pong' }),

        'err': async (msg: Msg) => await appData.ioChannel?.sendAnswer({ msg, content: `Comando *${msg?.body.split(' ')?.[1]}* não encontrado` }),
        'agente': async (msg: Msg, prompt: string[]) => await bindSessionConfig(msg, prompt, botname),

        '-agente': async (msg: Msg, prompt: string[]) => await unbindSessionConfig(msg),
        'agente-from': async (msg: Msg, [from, ...prompt]: string[]) => {
            msg.from = from;
            functions.logger.info('agente-from', { from, prompt, id: msg.id, msgFrom: msg.from });
            return await bindSessionConfig(msg, prompt, botname)
        },
        '-agente-from': async (msg: Msg, [from, ...prompt]: string[]) => {
            msg.from = from;
            functions.logger.info('agente-from', { from, prompt, id: msg.id, msgFrom: msg.from });
            return await unbindSessionConfig(msg)
        },
        b: async (msg: Msg, prompt: string[]) => await intentChat(msg, prompt),
    };


    appData.processMessage = async (receivedMsg: Msg) => {
        try {
            const admins = appData.secrets?.phoneNumbers.admins;
            if (admins?.includes(receivedMsg.from)) {
                if (canExecuteCommand(receivedMsg)) {
                    return await runCommand(receivedMsg);
                }
            }
            return await runConfig(receivedMsg);
        } catch (error) {
            functions.logger.error(error);
            return await appData.ioChannel?.sendReply({ msg: receivedMsg, content: 'Executado com falha' });
        }
    };
    return appData;
}

export default {
    run
};

