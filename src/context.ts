
import * as admin from 'firebase-admin';
import { Command } from './commands';
import { keyReplacer } from './util';
export type ContextStep = {
    command: string;
    step: string;
    status: 'pending' | 'completed';
    result?: string;
};

export type Context = {
    id: string;
    msgId: string;
    chatId: string;
    steps: ContextStep[];
    status: 'pending' | 'completed';
    log?: string[];
};

export default class Contexts {

    constructor(private contextsDbRef: admin.database.Reference) {

    }

    async getContexts(): Promise<Context[]> {
        const snapshot = await this.contextsDbRef.once('value');
        const contexts = snapshot.val();
        return contexts;
    }

    async createContext(command: Command, { id, chatId, msgId }: Partial<Context>): Promise<Context> {
        return {
            id,
            chatId,
            msgId,
            steps: command.steps.map(step => ({ command: command.name, step, status: 'pending' })),
            status: 'pending'
        };
    }

    async addContext(context: Context): Promise<void> {
        await this.contextsDbRef.child(keyReplacer(context.id)).set(context);
    }

    async getContext(id: string): Promise<Context> {
        const context = await this.contextsDbRef.child(keyReplacer(id)).once('value');
        return await context.val();
    }
    async removeContext(id: string): Promise<Context> {
        await this.contextsDbRef.child(keyReplacer(id)).set({ status: 'completed' });
        return await this.getContext(id);
    }
    async updateContext(id: string, context: Partial<Context>): Promise<Context> {
        await this.contextsDbRef.child(keyReplacer(id)).update(context);
        return await this.getContext(id);
    }
    async addLog(plainId: string, log: string): Promise<Context> {
        const id = keyReplacer(plainId);
        const context = await this.getContext(id);
        const logs = context?.log || [];
        logs.push(log);
        await this.contextsDbRef.child(id).update({ log: logs });
        return await this.getContext(id);
    }

}
