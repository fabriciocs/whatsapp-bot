"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ai_1 = require("./ai");
const chat_configs_manager_1 = require("./chat-configs-manager");
const intent_1 = require("./dialogflow/intent");
const io_channel_1 = require("./io-channel");
const secrets_1 = require("./secrets");
const util_1 = require("./util");
const appData = {};
const createATextDirectly = async (msg, prompt) => {
    var _a, _b, _c, _d;
    const result = await (0, ai_1.writeAText)({ stop: ['stop'], prompt });
    const answer = (_b = (_a = result === null || result === void 0 ? void 0 : result.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text;
    if (answer) {
        await ((_c = appData.ioChannel) === null || _c === void 0 ? void 0 : _c.sendAnswer({ msg, content: answer }));
    }
    else {
        await ((_d = appData.ioChannel) === null || _d === void 0 ? void 0 : _d.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" }));
    }
};
const createATextForConfig = async (msg, prompt, config, splitFor = '', isAudio = false) => {
    var _a, _b, _c, _d, _e;
    const result = await (0, ai_1.withConfig)(prompt, config);
    const answer = (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) === null || _c === void 0 ? void 0 : _c.trim();
    if (answer) {
        if (msg.isAudio) {
            splitFor = ' ';
        }
        const response = splitFor ? answer.replace('🤖', splitFor) : answer;
        await ((_d = appData.ioChannel) === null || _d === void 0 ? void 0 : _d.sendAnswer({ msg, content: response }));
    }
    else {
        await ((_e = appData.ioChannel) === null || _e === void 0 ? void 0 : _e.sendAnswer({ msg, content: "Não consegui uma resposta adequada!" }));
    }
};
const getAction = (key) => {
    var _a;
    return (_a = appData === null || appData === void 0 ? void 0 : appData.actions) === null || _a === void 0 ? void 0 : _a[key];
};
const intentChat = async (msg, prompt, agentId = process.env.AGENT_ID) => {
    var _a, _b;
    const text = msg.isAudio ? msg.body : prompt === null || prompt === void 0 ? void 0 : prompt.join(' ');
    const params = {
        id: msg.id, text,
        isSound: msg.isAudio,
        agentId
    };
    const responses = await new intent_1.Intent().getIntent(params);
    for (let i = 0; i < (responses === null || responses === void 0 ? void 0 : responses.length); i++) {
        const resp = msg.isAudio ? responses[i] : `${util_1.botname}: ${responses[i]}`;
        if (i === 0) {
            await ((_a = appData.ioChannel) === null || _a === void 0 ? void 0 : _a.sendReply({ msg, content: resp !== null && resp !== void 0 ? resp : '' }));
            continue;
        }
        await ((_b = appData.ioChannel) === null || _b === void 0 ? void 0 : _b.sendAnswer({ msg, content: resp !== null && resp !== void 0 ? resp : '' }));
    }
};
const bindSessionConfig = async (msg, prompt = [], prefix = '') => {
    var _a, _b, _c;
    if (!prompt.length) {
        prompt.push('auto', 'b');
    }
    const isAutomatic = (prompt === null || prompt === void 0 ? void 0 : prompt[0]) === 'auto';
    const commands = (_b = (_a = prompt === null || prompt === void 0 ? void 0 : prompt[1]) === null || _a === void 0 ? void 0 : _a.split(',')) === null || _b === void 0 ? void 0 : _b.map((cmd) => cmd.trim());
    await ((_c = appData.chatConfigsManager) === null || _c === void 0 ? void 0 : _c.saveConfig(msg.id, commands, isAutomatic, util_1.commandMarkers, prefix));
};
const unbindSessionConfig = async (msg) => {
    var _a;
    await ((_a = appData.chatConfigsManager) === null || _a === void 0 ? void 0 : _a.deleteConfig(msg.id));
};
const isNotString = (msg) => typeof (msg === null || msg === void 0 ? void 0 : msg.body) !== "string";
const getConfig = async (msg) => {
    var _a;
    if (isNotString(msg))
        return;
    const config = await ((_a = appData.chatConfigsManager) === null || _a === void 0 ? void 0 : _a.getBySessionOrNumber(msg.id, msg.from));
    if (!config)
        return;
    if (config.isAutomatic
        || (config.commandMarkers.filter((commandMarker) => { var _a; return (_a = msg === null || msg === void 0 ? void 0 : msg.body) === null || _a === void 0 ? void 0 : _a.startsWith(commandMarker); }).length > 0 && config.commands.filter((command) => { var _a, _b; return ((_b = (_a = msg === null || msg === void 0 ? void 0 : msg.body) === null || _a === void 0 ? void 0 : _a.split(' ')) === null || _b === void 0 ? void 0 : _b[1]) === command; }).length > 0)) {
        return config;
    }
    return;
};
const isCommand = (msg) => {
    if (isNotString(msg))
        return false;
    return util_1.commandMarkers.filter(commandMarker => { var _a; return (_a = msg === null || msg === void 0 ? void 0 : msg.body) === null || _a === void 0 ? void 0 : _a.startsWith(commandMarker); }).length > 0;
};
const extractExecutionInfo = (msg, config) => {
    var _a, _b;
    if (isCommand(msg) || (config === null || config === void 0 ? void 0 : config.isAutomatic)) {
        const buildBody = `${(config === null || config === void 0 ? void 0 : config.isAutomatic) ? 'auto ' : ''}${((_a = config === null || config === void 0 ? void 0 : config.isUnique) === null || _a === void 0 ? void 0 : _a.call(config)) ? `${(_b = config === null || config === void 0 ? void 0 : config.commands) === null || _b === void 0 ? void 0 : _b[0]} ` : ''}${msg === null || msg === void 0 ? void 0 : msg.body}`;
        const [, text, ...params] = buildBody.split(/\s/).filter(Boolean);
        return [text, params];
    }
    return;
};
const runConfig = async (msg) => {
    var _a, _b;
    const config = await getConfig(msg);
    if (!config)
        return;
    try {
        functions.logger.debug('config', { config });
        const info = extractExecutionInfo(msg, config);
        functions.logger.debug('info', { info });
        if (!info)
            return;
        const [text, params] = info;
        functions.logger.debug('text', { text });
        functions.logger.debug('params', { params });
        const command = getAction((_a = text === null || text === void 0 ? void 0 : text.toLowerCase) === null || _a === void 0 ? void 0 : _a.call(text));
        if (!command)
            return;
        functions.logger.debug('command', { command });
        await command(msg, params, config);
    }
    catch (error) {
        functions.logger.error(error);
        const text = `${config.prefix}Executado com falha`;
        await ((_b = appData.ioChannel) === null || _b === void 0 ? void 0 : _b.sendAnswer({ msg, content: text }));
    }
};
const prepareJsonToFirebase = (obj) => {
    if (!obj)
        return null;
    return Object.keys(obj).reduce((acc, fullKey) => {
        const key = (0, util_1.keyReplacer)(fullKey);
        if (typeof obj[fullKey] === 'object') {
            acc[key] = prepareJsonToFirebase(obj[fullKey]);
        }
        else {
            acc[key] = obj[fullKey];
        }
        return acc;
    }, {});
};
const canExecuteCommand = (msg) => {
    if (isCommand(msg)) {
        return true;
    }
    return false;
};
const runCommand = async (msg) => {
    var _a, _b, _c, _d;
    try {
        const [text, params] = (_a = extractExecutionInfo(msg)) !== null && _a !== void 0 ? _a : [];
        if (text) {
            let command = getAction((_b = text === null || text === void 0 ? void 0 : text.toLowerCase) === null || _b === void 0 ? void 0 : _b.call(text));
            if (!command) {
                command = getAction('err');
            }
            ;
            await command(msg, params);
            await ((_c = appData.ioChannel) === null || _c === void 0 ? void 0 : _c.sendReply({ msg, content: 'Executado com sucesso' }));
        }
    }
    catch (error) {
        functions.logger.error(error);
        await ((_d = appData.ioChannel) === null || _d === void 0 ? void 0 : _d.sendReply({ msg, content: 'Executado com falha' }));
    }
};
const run = async () => {
    const db = admin.database();
    appData.secrets = (0, secrets_1.loadSecrets)(process.env.INTEGRATION);
    appData.chatConfigsManager = new chat_configs_manager_1.default(db.ref(`whatsapp/chatConfigs`));
    appData.ioChannel = new io_channel_1.default();
    appData.actions = {
        '-': async (msg, prompt) => await createATextDirectly(msg, prompt === null || prompt === void 0 ? void 0 : prompt.join(' ')),
        'clean-db': async (msg, prompt) => await db.refFromURL('https://bot-4customers-default-rtdb.firebaseio.com/bot-4customers').set(null),
        'vereador': async (msg, prompt, splitFor = '') => await createATextForConfig(msg, prompt === null || prompt === void 0 ? void 0 : prompt.join(' '), 'vereador-c', '*Pré atendimento inteligente*'),
        'suporte-n1': async (msg, prompt, splitFor = '') => { var _a, _b; return await createATextForConfig(msg, (_b = (_a = prompt === null || prompt === void 0 ? void 0 : prompt.concat(['?'])) === null || _a === void 0 ? void 0 : _a.join(' ')) === null || _b === void 0 ? void 0 : _b.trim(), 'suporte-ti', '*Suporte N1*'); },
        '💖': async (msg, prompt, splitFor = '') => await createATextForConfig(msg, prompt === null || prompt === void 0 ? void 0 : prompt.join(' '), 'amor', '*bimbim*'),
        'pastor': async (msg, prompt, splitFor = '') => await createATextForConfig(msg, prompt === null || prompt === void 0 ? void 0 : prompt.join(' '), 'pastor', splitFor),
        'pre-venda': async (msg, prompt, splitFor = '') => await createATextForConfig(msg, prompt === null || prompt === void 0 ? void 0 : prompt.join(' '), 'moveis-estrela', splitFor),
        'gean': async (msg, prompt, splitFor = '') => await createATextForConfig(msg, prompt === null || prompt === void 0 ? void 0 : prompt.join(' '), 'moveis-estrela', splitFor),
        'ping': async (msg) => { var _a; return await ((_a = appData.ioChannel) === null || _a === void 0 ? void 0 : _a.sendAnswer({ msg, content: 'pong' })); },
        'err': async (msg) => { var _a, _b; return await ((_a = appData.ioChannel) === null || _a === void 0 ? void 0 : _a.sendAnswer({ msg, content: `Comando *${(_b = msg === null || msg === void 0 ? void 0 : msg.body.split(' ')) === null || _b === void 0 ? void 0 : _b[1]}* não encontrado` })); },
        'agente': async (msg, prompt) => await bindSessionConfig(msg, prompt, util_1.botname),
        '-agente': async (msg, prompt) => await unbindSessionConfig(msg),
        'agente-from': async (msg, [from, ...prompt]) => {
            msg.from = from;
            functions.logger.info('agente-from', { from, prompt, id: msg.id, msgFrom: msg.from });
            return await bindSessionConfig(msg, prompt, util_1.botname);
        },
        '-agente-from': async (msg, [from, ...prompt]) => {
            msg.from = from;
            functions.logger.info('agente-from', { from, prompt, id: msg.id, msgFrom: msg.from });
            return await unbindSessionConfig(msg);
        },
        b: async (msg, prompt) => await intentChat(msg, prompt),
    };
    appData.processMessage = async (receivedMsg) => {
        var _a, _b;
        try {
            const admins = (_a = appData.secrets) === null || _a === void 0 ? void 0 : _a.phoneNumbers.admins;
            if (admins === null || admins === void 0 ? void 0 : admins.includes(receivedMsg.from)) {
                if (canExecuteCommand(receivedMsg)) {
                    return await runCommand(receivedMsg);
                }
            }
            return await runConfig(receivedMsg);
        }
        catch (error) {
            functions.logger.error(error);
            return await ((_b = appData.ioChannel) === null || _b === void 0 ? void 0 : _b.sendReply({ msg: receivedMsg, content: 'Executado com falha' }));
        }
    };
    return appData;
};
exports.default = {
    run
};
//# sourceMappingURL=client.js.map