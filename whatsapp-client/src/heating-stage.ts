import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';

export class HeatingStage {
    stage?: number;
    msgsPerHour?: number;
}


export class HeatingStageManager {

    private readonly COLLECTION_NAME = 'heatingStages';
    heatingStages: HeatingStage[];

    constructor(private db: Firestore = admin.firestore()) {
        this.heatingStages = [];
    }

    async getHeatingStages() {
        const heatingStages = await this.db.collection(this.COLLECTION_NAME).get();
        this.heatingStages = heatingStages.docs.map((doc) => doc.data() as HeatingStage);
        return this.heatingStages;
    }
}