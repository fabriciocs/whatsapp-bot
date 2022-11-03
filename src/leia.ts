import code4devs from '4code4devs';
import { readCnhFile } from './s3';
import { Client } from 'whatsapp-web.js';


type LeiaStartType = { client: Client; msgBody?: string; leiaId?: string; };

const startChat = async ({ client, msgBody = '@RODOCLUBE API-CADASTRO', leiaId = '551140030407@c.us' }: LeiaStartType) => {
    const chat = await client.getChatById(leiaId);
    await chat.sendMessage(msgBody);
    const person = await code4devs.lib.gerar.pessoa({ query: { txt_qtde: 1 } });
    const carro = await code4devs.lib.gerar.veiculo({ query: { pontuacao: "S" } });
    const image = await readCnhFile();
    console.log({ person, carro, image: image?.Contents?.map(a => a.Key) });
    return chat;
};

const questionAnswer = async () => {
    const person = await code4devs.lib.gerar.pessoa({ query: { txt_qtde: 1 } });
    const carro = await code4devs.lib.gerar.veiculo({ query: { pontuacao: "S" } });
    const image = await readCnhFile();
    return {
        'Qual o seu *nome completo*? 🎯': person.nome,
        'Me informe abaixo, os *11 números* do seu *CPF* ✍️': person.cpf,
        'Qual é o seu *e-mail* ? 📧': person.email,
        'Agora preciso que você me envie uma *foto* da sua *CNH*, mas mande ela aberta tá para facilitar a visualização!🤳📇': image,
        'Informe abaixo, o *número* do *CEP* da sua residência 📮': person.cep,
        'Esse aqui é seu endereço atual:': person.endereco,
        'Qual o *número* do seu endereço? 🔢': person.numero,
        'Agora preciso que você me envie uma foto do seu comprovante de residência, pode ser uma conta de luz ou de água 📥': image,
        'Você confirma os seus dados?': 1,
        'Qual o número da *ANTT* do proprietário?': carro.antt,
        'Me diga, qual a *placa* do seu *veículo*? 🚘': 'ABC1234',
        'Por favor, me envie agora uma foto do *documento* do seu *veículo*, mas mande ele aberto tá para facilitar a visualização! 🤳': image,
        'Você possui a *TAG de Pedágio*?': 'Sim',
        'O seu veículo possui rastreador?': 'Sim',
        'Você possui *carrocerias* a serem cadastradas?': 'Sim',
        'A partir de agora, estarei salvando suas informações para concluirmos o seu cadastro. Você está de acordo?': 'Sim',
        'Como deseja prosseguir agora?': 'Finalizar',
    };
};

export default {
    startChat
};

