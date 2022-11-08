import { Client, Message, MessageContent, MessageSendOptions } from "whatsapp-web.js";

export default class CommandManager{
    constructor(private appData: any, private client: Client){
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
    
        const proccess = await Promise.all(await steps.map(async (step) => {
            console.log(step);
            const result = await this.appData.defaultSteps[step](msg, prompt);
            await this.appData.contexts.addLog(id, JSON.stringify({ result }));
        }));
        const context = await this.appData.contexts.getContext(id);
        console.log('Executado com sucesso!');
        console.log(...context.log);
    };
    
    listCommands = async (msg: Message) => {
        const commands = await this.appData.commands.getCommands();
        const commandsList = Object.keys(commands)?.join(', ');
        return await this.sendAnswer(msg, commandsList);
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