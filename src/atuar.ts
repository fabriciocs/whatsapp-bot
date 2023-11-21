import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({
    path: resolve(__dirname, '../.env'),
});

import { createModelTrainingPhrases, createModelTrainingPhrasesToAgente } from './ai';
import { writeFileSync } from 'fs';
import { Axios } from 'axios';

const models = require('./models.json');
const agentNameFormatted = (agentName) => {
    const agentNameLowerCase = agentName.toLowerCase();
    const agentNameWithoutAccent = agentNameLowerCase.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const agentNameWithoutSpaces = agentNameWithoutAccent.replace(/ /g, '-');
    const agentNameWithoutSlashes = agentNameWithoutSpaces.replace(/\//g, '-');

    const agentNameFormatted = `agente.${agentNameWithoutSlashes}`;
    return agentNameFormatted;
};
(async () => {
    const phrases = [];
    const hash = new Date().getTime();
    for (let i = 0; i < models.length; i++) {
        try {
            const model = models[i];
            const name = Object.keys(model)[0];
            const intents = model[name];
            const modelPhrases = await createModelTrainingPhrasesToAgente(name);
            //remove o último ponto final da frase utilizando regex
            const modelPhrasesFormatted = modelPhrases.replace(/\.$/, '');
            const text = `[${modelPhrasesFormatted}]`;
            phrases.push(text);
            console.log(text);
            const path = resolve(`./src/training/${hash}-${agentNameFormatted(name)}.json`);
            writeFileSync(path, text);
        } catch (e) {
            if (e.response) {
                console.log(e.response.data);
            } else if (e.message) {
                console.log(e.message);
            } else {
                console.log(e);
            }
        }
    }
    writeFileSync(resolve(`./src/training/${hash}.json`),phrases.join(''));
})();


// const modelsNames = Object.keys(models);
// /**
//     * crie uma função que receba o nome do agente e faça o seguinte:
//     * 1 - transforme o nome do agente para minúsculo.
//     * 2 - remova os acentos, cedilha e outros caracteres especiais do nome do agente.
//     * 3 - substitua os espaços por hífens do nome do agente.
//     * 4 - inclua a palava "agente." no início do nome do agente.
//     * resultado esperado: agente.conselheiro-de-profissoes
//     */


// /**
//  * crie uma função que receba o nome de um agente e faça o seguinte:
//  * 1 - construa a frase de prompt para o OpenAI descrever o agente, por exemplo: ;
//  * 2 - armazene o prompt em uma variável chamada openAiAgenteDescriptionPrompt;
//  * 3 - execute uma requisição POST para o endpoint do OpenAI com o prompt:openAiAgenteDescriptionPrompt e o token de autenticação;
//  * 4 - construa a frase de prompt para o OpenAI gerar frases de treinamento para o agente, por exemplo: 'Quero que você atue como um gerador de frases de treinamento para serem usadas nas Intents do Dialogflow-cx. Fornecerei a você uma descrição do agente, por exemplo: "${}". Sua tarefa é atuar como um usuário que deseja solicitar os serviços do Conselheiro de Profissões e escrever 15 frases para mim, separadas por ";". Não inclua explicações ou informações adicionais em sua resposta, simplesmente forneça as frases. Por exemplo:"Estou consa`;
//  *
//  * **/
// const openAiExplain = 'explique de forma sucinta o que é um "Conselheiro De Profissões":';
// const openAiPrompt = `Quero que você atue como um gerador de frases de treinamento para serem usadas nas Intents do Dialogflow-cx. Fornecerei a você uma descrição do agente, por exemplo: "O Conselheiro Profissões é uma pessoa qualificada que ajuda os indivíduos a tomar decisões informadas sobre suas carreiras. Eles fornecem orientação profissional, aconselhamento e recursos para ajudar os indivíduos a encontrar o caminho certo para alcançar seus objetivos profissionais.". Sua tarefa é atuar como um usuário que deseja solicitar os serviços do Conselheiro de Profissões e escrever 15 frases para mim, separadas por ";". Não inclua explicações ou informações adicionais em sua resposta, simplesmente forneça as frases. Por exemplo:"Estou consa`;


// /**
//  *
// "Execute este comando",
// "Digite este comando no terminal",
// "Vamos usar este comando",
// "Vamos executar este comando",
// "Me ajude a executar este comando",
// "Vamos ver o que acontece quando executamos este comando",
// "Me ajude a digitar este comando",
// "Vamos ver o que acontece quando digitamos este comando",
// "Vamos ver o que o terminal retorna quando executamos este comando",
// "Vamos ver o que o terminal retorna quando digitamos este comando",
// "Eu quero que você execute este comando",
// "Eu quero que você digite este comando no terminal",
// "Vamos ver o que acontece quando eu digito este comando",
// "Vamos ver o que o terminal retorna quando eu digito este comando",
// "Ajude-me a executar este comando",
// "cd /home/users/",
// "IA roda rm -rf",
// "ls -l > file.log",
// "sudo reboot",
// "ls -la no linux, por favor",
// "Executa o comando 'cat /etc/passwd'",
// "Executa o comando 'df -h'",
// "Qual a saída do 'cat /etc/hosts'?",
// "Executa 'uname -a'",
// "IA, executa 'whoami'",
// "Executa 'cat /proc/cpuinfo'",
// "Executa 'ps -ef'",
// "Qual a saída do 'lsblk'?",
// "Qual a saída do comando 'df -i'?",
// "Qual a saída do comando 'cat /proc/version'?",
//  */
