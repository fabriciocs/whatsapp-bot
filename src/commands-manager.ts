import { Client, Message, MessageContent, MessageSendOptions } from "whatsapp-web.js";
import { IoChannelOptions } from "./io-channel";
import { Msg } from "./msg/msg";
export type CommandResponse = {
    data: any,
    chatId: string

};
export type StepFunctionParams = {
    msg: Msg,
    prompt?: string,
    lastResult?: CommandResponse,
    receivedId?: string
};
export type StepFunction = (params: StepFunctionParams) => Promise<CommandResponse>;

export default class CommandManager {
    constructor(private appData: any) {
    }

    private sendAnswer = async (msg: Msg, content: string, options: IoChannelOptions = {}) => {
        return await msg.sendMessage(content, options);
    }


    addCommand = async (msg: Msg, prompt: string) => {
        if (!prompt) {
            return await this.sendAnswer(msg, 'Preciso de um comando para adicionar');
        }
        const command = prompt.split(' ')[0];
        const instruction = prompt.split(' ').slice(1);
        if (!command || !instruction.length) {
            return await this.sendAnswer(msg, 'Preciso de um comando e uma instrucao para adicionar');
        }

        if (await this.appData.commands.exists(command)) {
            return await this.sendAnswer(msg, 'Esse comando já existe');
        }
        await this.appData.commands.addCommand({ name: command, steps: instruction });
        return await this.sendAnswer(msg, 'Comando adicionado com sucesso');
    }
    executeCommand = async (msg: Msg, prompt: string) => {
        if (!prompt) {
            return await this.sendAnswer(msg, 'Preciso de um comando para executar');
        }
        const command = prompt.split(' ')[0];
        if (!command) {
            return await this.sendAnswer(msg, 'Preciso de um comando para executar');
        }
        if (!await this.appData.commands.exists(command)) {
            return await this.sendAnswer(msg, 'Esse comando não existe');
        }
        const commandData = await this.appData.commands.getCommand(command);
        const steps = commandData.steps;
        const id = msg.id;
        const chatId = msg.chatId;
        const msgId = `${id}-${chatId}`;

        let lastResult: CommandResponse = null;
        for (const step of steps) {
            console.log(step);
            lastResult = await this.appData.defaultSteps[step]({ msg, prompt, lastResult, id: msg });
            await this.appData.contexts.addLog(id, JSON.stringify({ lastResult, step, msgId, chatId }));
        };
        const context = await this.appData.contexts.getContext(id);
        console.log('Executado com sucesso!');
        console.log(...context.log);
    };

    listCommands = async (msg: Msg) => {
        const commands = await this.appData.commands.getCommands();
        if (!commands) {
            return await this.sendAnswer(msg, 'Nenhum comando encontrado');
        }
        const commandsList = Object.keys(commands)?.reduce((acc, command) => [...acc, `*${command}* - [${commands[command].steps.join(',')}]`], []);
        return await this.sendAnswer(msg, commandsList.join('\n'));
    }

    removeCommand = async (msg: Msg, prompt: string) => {
        if (!prompt) {
            return await this.sendAnswer(msg, 'Preciso de um comando para remover');
        }
        const command = prompt.split(' ')[0];
        if (!command) {
            return await this.sendAnswer(msg, 'Preciso de um comando para remover');
        }
        if (!await this.appData.commands.exists(command)) {
            return await this.sendAnswer(msg, 'Esse comando não existe');
        }
        await this.appData.commands.removeCommand(command);
        return await this.sendAnswer(msg, 'Comando removido com sucesso');
    }

}