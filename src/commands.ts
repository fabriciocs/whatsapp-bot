
import * as admin from 'firebase-admin';
export type Command = {
    name: string;
    steps: string[];
};

export default class Commands {


    constructor(private commandsDbRef: admin.database.Reference) {
    }
    async exists(name: string): Promise<boolean> {
        const commands = await this.getCommand(name);
        return !!commands;
    }

    async getCommand(name: string): Promise<Command> {
        const snapshot = await this.commandsDbRef.child(name).once('value');
        const commands = snapshot.val();
        return commands;
    }
    async getCommands(): Promise<Command[]> {
        const snapshot = await this.commandsDbRef.once('value');
        const commands = snapshot.val();
        return commands;
    }

    async addCommand(command: Command): Promise<void> {
        await this.commandsDbRef.child(command.name).set(command);
    }
    async removeCommand(name: string): Promise<void> {
        await this.commandsDbRef.child(name).remove();
    }
    async updateCommand(name: string, command: Partial<Command>): Promise<void> {
        await this.commandsDbRef.child(name).update(command);
    }

}