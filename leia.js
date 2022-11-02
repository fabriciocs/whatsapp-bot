const { lib } = require('4code4devs');
const { readCnhFile } = require('./s3.js');

const startChat = async ({ client, msgBody = '@RODOCLUBE API-CADASTRO', leiaId = '551140030407@c.us' }) => {
    const chat = await client.getChatById(leiaId);
    await chat.sendMessage(msgBody);
    const person = await lib.gerar.pessoa({ query: { txt_qtde: 1 } });
    console.log({ person });
    return chat;
};
const questionAnswer = async () => {
    const person = await lib.gerar.pessoa({ query: { txt_qtde: 1 } });
    const image = await readCnhFile();
    return {
        'Qual o seu *nome completo*? 🎯': person.nome,
        'Me informe abaixo, os *11 números* do seu *CPF* ✍️': person.cpf,
        'Qual é o seu *e-mail* ? 📧': person.email,
        'Agora preciso que você me envie uma *foto* da sua *CNH*, mas mande ela aberta tá para facilitar a visualização!🤳📇': image,
        'Informe abaixo, o *número* do *CEP* da sua residência 📮': '12345678',
        'Esse aqui é seu endereço atual:': 'Rua dos Bobos, 0',
        'Qual o *número* do seu endereço? 🔢': '0',
        'Agora preciso que você me envie uma foto do seu comprovante de residência, pode ser uma conta de luz ou de água 📥': image,
        'Você confirma os seus dados?': 'Sim',
        'Qual o número da *ANTT* do proprietário?': '12345678901234567890',
        'Me diga, qual a *placa* do seu *veículo*? 🚘': 'ABC1234',
        'Por favor, me envie agora uma foto do *documento* do seu *veículo*, mas mande ele aberto tá para facilitar a visualização! 🤳': image,
        'Você possui a *TAG de Pedágio*?': 'Sim',
        'O seu veículo possui rastreador?': 'Sim',
        'O seu veículo possui rastreador?': 'Sim',
        'Você possui *carrocerias* a serem cadastradas?': 'Sim',
        'A partir de agora, estarei salvando suas informações para concluirmos o seu cadastro. Você está de acordo?': 'Sim',
        'Como deseja prosseguir agora?': 'Finalizar',
    };
};

module.exports = {
    startChat
};

