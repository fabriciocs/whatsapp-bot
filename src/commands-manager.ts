import { Client, Message, MessageContent, MessageSendOptions } from "whatsapp-web.js";
export type CommandResponse = {
    data: any,
    chatId: string

};
export type StepFunctionParams = {
    msg: Message,
    prompt?: string,
    lastResult?: CommandResponse,
    receivedId?: string
};
export type StepFunction = (params: StepFunctionParams) => Promise<CommandResponse>;

export default class CommandManager {
    constructor(private appData: any, private client: Client) {
    }

    private sendAnswer = async (msg: Message, content: MessageContent, options: MessageSendOptions = {}) => {
        await (await msg.getChat()).sendMessage(content, { ...options, sendSeen: true });
    }


    addCommand = async (msg: Message, prompt: string) => {
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
    executeCommand = async (msg: Message, prompt: string) => {
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

        const msgId = msg.id._serialized;
        const chatId = (await msg.getChat()).id._serialized;
        const id = `${msg.from}${chatId}`;
        let lastResult: CommandResponse = null;
        for (const step of steps) {
            console.log(step);
            lastResult = await this.appData.defaultSteps[step]({ msg, prompt, lastResult, id });
            await this.appData.contexts.addLog(id, JSON.stringify({ lastResult, step, msgId, chatId }));
        };
        const context = await this.appData.contexts.getContext(id);
        console.log('Executado com sucesso!');
        console.log(...context.log);
    };

    listCommands = async (msg: Message) => {
        const commands = await this.appData.commands.getCommands();
        if (!commands) {
            return await this.sendAnswer(msg, 'Nenhum comando encontrado');
        }
        const commandsList = Object.keys(commands)?.reduce((acc, command) => [...acc, `*${command}* - [${commands[command].steps.join(',')}]`], []);
        return await this.sendAnswer(msg, commandsList.join('\n'));
    }

    removeCommand = async (msg: Message, prompt: string) => {
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