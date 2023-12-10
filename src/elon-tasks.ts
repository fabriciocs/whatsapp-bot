
import * as admin from 'firebase-admin';



export type ElonTask = {
    name: string;
    steps: string[];
};

export default class ElonTasks {
    private elonTasksDbRef: admin.database.Reference;

    constructor(private db: admin.database.Database) {
        this.elonTasksDbRef = db.ref('elon');
    }

    async getElonTasks(): Promise<ElonTask[]> {
        const snapshot = await this.elonTasksDbRef.once('value');
        const elonTasks = snapshot.val();
        return elonTasks;
    }

    async addElonTask(elonTask: ElonTask): Promise<void> {
        await this.elonTasksDbRef.push(elonTask);
    }
}