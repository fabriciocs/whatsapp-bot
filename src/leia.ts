import code4devs from '4code4devs';
import { readCnhFile } from './s3';
import { resolve } from 'path';
import { Client, Message, MessageContent, MessageMedia } from 'whatsapp-web.js';

const fixedQuestions = [
    '🐙 rodoclube diz: \r\n⚠ Todas as execuções foram encerradas!!!',
    'Qual o seu *nome completo*? 🎯',
    'Me informe abaixo, os *11 números* do seu *CPF* ✍️',
    'Qual é o seu *e-mail* ? 📧',
    'Agora preciso que você me envie uma *foto* da sua *CNH*, mas mande ela aberta tá para facilitar a visualização!🤳📇',
    'Informe abaixo, o *número* do *CEP* da sua residência 📮',
    'Esse aqui é seu endereço atual:',
    'Qual o *número* do seu endereço? 🔢',
    'Agora preciso que você me envie uma foto do seu comprovante de residência, pode ser uma conta de luz ou de água 📥',
    'Você confirma os seus dados?',
    'Qual o número da *ANTT* do proprietário?',
    'Me diga, qual a *placa* do seu *veículo*? 🚘',
    'Por favor, me envie agora uma foto do *documento* do seu *veículo*, mas mande ele aberto tá para facilitar a visualização! 🤳',
    'Você possui a *TAG de Pedágio*?',
    'O seu veículo possui rastreador?',
    'Você possui *carrocerias* a serem cadastradas?',
    'A partir de agora, estarei salvando suas informações para concluirmos o seu cadastro. Você está de acordo?',
    'Como deseja prosseguir agora?',
];

const getFromFixedQuestions = (question) => fixedQuestions.find(key => key.includes(question) || question.includes(key));


const leiaBridgeIds = ['79EBC336962BD9F08D'];
const leiaCttId = '551140030407@c.us';
const myId = '120363044726737866@g.us';

type LeiaStartType = { client: Client; msg: Message, msgBody?: string; leiaId?: string; };


const questionAnswerCtrl = [];
const addQuestionAnswer = ({ pessoa, carro, imagem }) => {
    questionAnswerCtrl.push(questionAnswer({ pessoa, carro, imagem }));
}

const getFirstAnswerFromQuestion = (leiaQuestion) => {
    const question = getFromFixedQuestions(leiaQuestion);
    const answer = questionAnswerCtrl.find((qa) => !!qa[question]);

    if (answer) {
        const response = answer[question]();
        delete answer[question];
        return response;
    }
    return null;
}

const doTheBridge = async (client: Client, msg: Message, content: MessageContent, isMedia = false) => {
    const constact = await client.getContactById(leiaCttId);
    const chat = await constact.getChat();
    return await chat.sendMessage(content, { sendMediaAsDocument: isMedia });

    // return await Promise.all(await leiaBridgeIds.map(async id => {
    //     if (msg.from === id) {
    //         return await msg.forward(await client.getChatById(leiaCttId));
    //     }
    //     if (msg.from === leiaCttId) {
    //         return await msg.forward(await client.getChatById(id));
    //     }
    // }));
}
const leiaFeedback = ['5519992057430-1631105563@g.us'];
const isLeiafeedback = (msg: Message) => false;//leiaFeedback.includes(msg.from);

const sendFeedback = async (client: Client, msg: Message, cpf: string) => {
    const chat = await client.getChatById(leiaFeedback[0]);
    // return await chat.sendMessage(`Vou mandar esse cpf: *${cpf}*`);
}

const loadPersonAndCar = async () => {
    const [pessoa] = await code4devs.lib.gerar.pessoa({ query: { txt_qtde: 1 } }) as any[];
    const carro = await code4devs.lib.gerar.veiculo({ query: { pontuacao: "N" } }) as any;
    return { pessoa, carro };
}
const geradorCpf = async () => {
    const pessoas = await code4devs.lib.gerar.pessoa({ query: { txt_qtde: 30 } }) as any[];
    console.log(pessoas);
    return pessoas.map(p=> p.cpf).join('\n');

}



const fillRandomData = async () => {
    const { pessoa, carro } = await loadPersonAndCar();
    const imagem = await readCnhFile();
    const data = { pessoa, carro, imagem: await MessageMedia.fromFilePath(resolve(imagem)) };
    addQuestionAnswer(data);
    return data;
}



const startChat = async ({ client, msg, msgBody = '@endall', leiaId = leiaCttId }: LeiaStartType) => {
    const data = await fillRandomData();
    try {

        await sendFeedback(client, msg, data.pessoa.cpf);

    } catch (err) {
        console.log(err);
    }
    await doTheBridge(client, msg, msgBody);
    return data;
};

const questionAnswer = ({ pessoa, carro, imagem }) => ({
    '🐙 rodoclube diz: \r\n⚠ Todas as execuções foram encerradas!!!': () => '@RODOCLUBE API-CADASTRO',
    'Qual o seu *nome completo*? 🎯': () => pessoa.nome,
    'Me informe abaixo, os *11 números* do seu *CPF* ✍️': () => pessoa.cpf,
    'Qual é o seu *e-mail* ? 📧': () => pessoa.email,
    'Agora preciso que você me envie uma *foto* da sua *CNH*, mas mande ela aberta tá para facilitar a visualização!🤳📇': () => ({ imagem, isImage: true }),
    'Informe abaixo, o *número* do *CEP* da sua residência 📮': () => pessoa.cep,
    'Esse aqui é seu endereço atual:': () => '1',
    'Qual o *número* do seu endereço? 🔢': () => pessoa.numero,
    'Agora preciso que você me envie uma foto do seu comprovante de residência, pode ser uma conta de luz ou de água 📥': () => ({ imagem, isImage: true }),
    'Você confirma os seus dados?': () => '1',
    'Qual o número da *ANTT* do proprietário?': () => carro.renavam,
    'Me diga, qual a *placa* do seu *veículo*? 🚘': () => carro.placa_veiculo,
    'Por favor, me envie agora uma foto do *documento* do seu *veículo*, mas mande ele aberto tá para facilitar a visualização! 🤳': () => ({ imagem, isImage: true }),
    'Você possui a *TAG de Pedágio*?': () => '2',
    'O seu veículo possui rastreador?': () => '2',
    'Você possui *carrocerias* a serem cadastradas?': () => '2',
    'A partir de agora, estarei salvando suas informações para concluirmos o seu cadastro. Você está de acordo?': () => '1',
    'Como deseja prosseguir agora?': () => '3',
});


const sendResponse = async (client: Client, msg: Message, leiaId = leiaCttId) => {
    if (!questionAnswerCtrl?.length) {
        await fillRandomData();
    }
    const { body } = msg;
    const firstAnswer = getFirstAnswerFromQuestion(body);
    if (firstAnswer) {

        if (firstAnswer.isImage) {
            const { imagem } = firstAnswer;
            return await doTheBridge(client, msg, imagem,);

        }
        console.log({ question: body, answer: firstAnswer });
        return await doTheBridge(client, msg, `${firstAnswer}`);
    }
}

export { startChat, sendResponse, loadPersonAndCar, geradorCpf };

