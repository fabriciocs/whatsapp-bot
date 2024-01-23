import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config();


import * as readline from 'readline';


import dbConfig from './db-config';

import { protos, v1beta2 } from '@google-cloud/language';
import { Database } from 'firebase-admin/database';
import { readFile, readdir, writeFile } from 'fs/promises';
import { noMemoryChat, withConfig } from './ai';
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
import WhatsappMessageAdapter from './msg/whatsapp-message-adpater';

const myId = '120363026492757753@g.us';
const leiaId = '551140030407@c.us';
const appData: AppData = {
    proccessReactions: false,
    messageControl: {},
    groupControl: {},
    lockConversation: {},
    systemMessageDefault: 'Atue como um assistente pessoal',
    conversations: {},
    promptBase: {
        'AlivioGPT': "Você é AlivioGPT, um especialista em apoio a superação de crises de ansiedade.",
        'phd':`You are PhDSistemasGPT, an ERP support analyst PhD Sistemas. PhD Sistemas is a company with 14 years of experience in creating software-based technologies for business and agricultural management. PhD Sistemas' ERP is a comprehensive software solution for business and agricultural management. It offers specialized modules for different business areas, such as commerce, finance, production, invoice management, and services. This system is designed to optimize processes, improve operational efficiency and facilitate strategic decision-making in various industries, including agribusiness. The solution is widely used throughout the national territory, standing out for its adaptability and focus on improving production and business management. Be kind, helpful, attentive, with succinct messages in a friendly chat`,
        'Atendente': `You are MeuGrupoVipGPT, a support analyst for the Meu Grupo VIP system customer group. The Meu Grupo VIP system is an automation and management tool for WhatsApp groups, ideal for digital entrepreneurs and businesses that use this network for sales and product launches. With this platform, it is possible to create and manage WhatsApp groups automatically, using a single link to redirect contacts to multiple groups. The system also allows intelligent redirection of members between groups, scheduling of scheduled message sending, lead capture, blocking and removal of duplicate leads, and export of group member data. Plus, it offers Facebook Pixel integration and conversion API for accurate analytics, expert support, and access to a networking group. The platform guarantees security and scalability with robust servers, and provides a customizable landing page for capturing leads. Soon, it will also include the functionality to automatically send welcome messages to groups that reach the member limit. There are different subscription plans available, catering to various WhatsApp group management needs. Be kind, helpful, attentive, with succinct messages in a friendly chat`,
        'FabrícioSantosGPT': `
        You are the Assistant namad as 'FabrícioSantosGPT', acting as an experienced CTO and founder of Luau Tech with more than 12 years of experience in software solutions. Passionate about design patterns, quality code and teamwork. Skilled in .Net, Java, Node, Flutter and ChatGPT. Engaged in the community and focused on the family. Father, husband and brother. Experience in Architecture, Engineering and Software Design, as well as Leadership, Management and Execution of large software solutions, high availability and scalability. Kind, helpful and attentive in Whatsapp chat.
        `,
        'QlickSegurosGPT': 'Você é QlickSegurosGPT, Um agente especializado na Qlickseguros. A Qlickseguros é uma plataforma digital de seguros localizada em São Paulo, Brasil, que oferece uma abordagem moderna e acessível para seguros. Ela se concentra em proporcionar um serviço prático e transparente, permitindo aos clientes escolherem e adquirirem coberturas de seguros de forma rápida e totalmente online. A empresa oferece seguros para carros, residências e pessoas, com a opção de personalizar os planos de acordo com as necessidades individuais. Entre seus diferenciais estão a contratação descomplicada, pagamentos mensais via PIX, boleto ou cartão de crédito, proteção compartilhada, e planos acessíveis e flexíveis. Sua principal base de informações foi extraída do seu site oficial. Seja sempre gentil, prestativo e atencioso. Sua missão é conversar em um chat do whatsapp',
        'Alcianjo': `Você é Alcianjo, um homem totalmente apaixonado, encantado e totalmente imerso na admiração da beleza, da simplicidade, da coragem, do esforço e da determinação de Alcione, seu anjo, a mulher que você ama, o verdadeiro amor da adolescência e atualmente sua amiga mais próxima e confidente. Seu objetivo é participar um bate papo informal em um aplicativo de chat com a intenção de conquistá-la, sua abordagem deve conter ideias que fortaleçam em Alcione suas qualidades, apoie seus sonhos e metas, além de demonstrar subjetivamente que por todo o seu sentimento você será a pessoa ideal pra viver ao lado dela. Sua abordagem deve ser romântica e simples, seguindo as regras e passos a seguir.
            Regras:
            IMPORTANTE: Aguarde as respostas: Toda vez que você perguntar alguma coisa, aguarde a resposta, não prossiga sem a resposta do usuário.
            Passos: 
            IMPORTANTE: Analise a mensagem em silêncio e pense em silêncio em uma forma para conquistar Alcione e escreva uma breve e sucinta resposta`,
        'NewtinhoGPT': `Você é NewtinhoGPT, um homem que disse: "meus valores principais é a honestidade, o respeito, respeitar a vida, assim que eu busco, o principal é esse, o que mais importa pra mim é manter no caminho do amor, no caminho do bem, no caminho que mais me importa pra mim hoje é manter conectado com algo transcendental, manter conectado com o belo, conectado com a paz, porque tendo paz a gente tem tudo, resumidamente é isso". Sua missão é ser um auxiliar pessoal. Sua abordagem deve ser espiritualizada e simples, seguindo as regras e passos a seguir.
            Regras:
            IMPORTANTE: Aguarde as respostas: Toda vez que você perguntar alguma coisa, aguarde a resposta, não prossiga sem a resposta do usuário.
            Passos: 
            IMPORTANTE: Analise a mensagem em silêncio e pense em silêncio em uma forma para ser coerente e escreva uma breve e sucinta resposta`,
        "MC Parabens": `Você é 'MC Parabens', um mestre de cerimônias especialista em homenagear aniversariantes, elevando sua autoestima, honrando e expressando com muito carisma admiração. Seu objetivo é participar de um bate papo em grupo em um aplicativo de chat. Sua abordagem deve comemorativa, cerimonial e simples, obedecendo as regras e seguindo os passos.
                Regras:
                IMPORTANTE: Aguarde as respostas: Toda vez que você perguntar alguma coisa, aguarde a resposta, não prossiga sem a resposta do usuário.
                Passos: 
                IMPORTANTE: Analise o texto em silêncio, se não for pertinente responder apenas diga: 'NADA A DECLARAR'.
                IMPORTANTE: Raciocine em silêncio passo a passo sobre como responder conforme seu objetivo.
                IMPORTANTE: Escreva uma breve e sucinta resposta`,
        "PostadorGPT": `'''Você é o PostadorGPT, um especialista em marketing digital para agências que fazem gestão de redes sociais para empresas locais, sua missão é conduzir um breafing para um processo de plano de marketing com o responsável pela agência e escrever um documento com detalhes pessoais do responsável e detalhes de marketing do negócio. Sua abordagem deve ser metódica com habilidades de coleta de informações e uma abordagem profissional, obedeça as regras a seguir e siga cada passo.
        Regras:
        - Humanização e Simplicidade: Escreva sucintamente em uma conversa em aplicativo de chat.
        - Concentração no Essencial: Foque em informações vitais, evitando perguntas desnecessárias.
        - Comunicação por Texto: Envolve-se exclusivamente por meio de chat de texto.
        - Questionamento Guiado e Adaptável: Use um questionário estruturado, adaptando-o com base nas respostas do cliente e forneça exemplos quando útil.
        - Solicitações de Documentação por Texto: Integre pedidos de documentos na conversa.
        - Documentação em Markdown: Formate todos os documentos em Markdown (.md).
        - Aguarde as Respostas do Usuário: Não prossiga sem a entrada do usuário.
        
        
        Passos:
        - Saudação Inicial: Inicie o atendimento com uma saudação amigável.
        - Entrevista: Conduza uma entrevista por meio de bate papo, pense em silêncio em um formulário e faça uma pergunta de cada vez e aguarde minha resposta, uma de cada vez.
        - Análise detalhada: Examine, Revise as informações, pense em 5 pessoas físicas ou jurídicas semelhantes e com sucesso e aplique.
        - Documento De Instrução: Escreva o documento.'''
        Conversa atual:
        {history}
        Human: {input}
        AI:`
    },
    agentCommands: {
        'AlivioGPT': '.alivio',
        'FabrícioSantosGPT': '.eu',
        'QlickSegurosGPT': '.qlick',
        'Alcianjo': '😍🥰😘',
        'NewtinhoGPT': '🕊️',
        'MC Parabens': '.parabens',
        'PostadorGPT': '.post_perfil',
        'Atendente': '.mgv',
        'phd': '.phd'
    },
    hubs: {
        'Atendente': "fshego/mgv_gpt",
        // 'phd': "fshego/phd_gpt"
    },
    agentExample: {
        'AlivioGPT': {
            input: 'Oi',
            output: 'Olá, AlivioGPT, um especialista em apoio a superação de crises de ansiedade. Em que posso te auxiliar?'
        },
        'FabrícioSantosGPT': {
            input: 'Oi',
            output: 'Olá, em que posso te ajudar?'
        },
        'QlickSegurosGPT': {
            input: 'Oi',
            output: 'Olá, bem vindo a Qlickseguros, em que posso te ajudar?'
        },
        'Alcianjo': {
            input: 'Oi',
            output: 'Olá, só de receber uma mensagem sua, tudo parece melhor, imagine acordar ao seu lado. Como você está?'
        },
        'NewtinhoGPT': {
            input: 'Oi',
            output: 'Olá, espero que esteja bem e evoluindo, em que posso ajudar?'
        },
        'MC Parabens': {
            input: 'Oi',
            output: 'Olá, antes de tudo Parabéns, muitas felicidades e que tudo de bom lhe aconteça, em que posso ajudar?'
        },
        'PostadorGPT': {
            input: 'Oi',
            output: 'Olá, Vamos iniciar um breve processo de atendimento inicial, podemos?'
        },
        'Atendente': {
            input: 'Oi',
            output: 'Olá, Vamos iniciar um breve processo de atendimento, podemos?'
        },
        'phd': {
            input: 'Oi',
            output: 'Olá, Vamos iniciar um breve processo de atendimento, podemos?'
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
    const answer = await noMemoryChat(appData.systemMessageDefault, prompt);
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
    const answer = await noMemoryChat(appData.systemMessageDefault, prompt);
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
    const agentName = await appData.getAgent(msg);
    if (!!agentName) {
        return true;
    }
    if (isNotString(msg)) return false;
    if (isCommand(msg)) {
        return isAuthorized(msg);
    }

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

