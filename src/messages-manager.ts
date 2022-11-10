
import * as admin from 'firebase-admin';
export default class MessagesManager {

  constructor(private msgsRef: admin.database.Reference) {
  }

  async getMsgs(): Promise<any[]> {
    const snapshot = await this.msgsRef.once('value');
    const msgs = snapshot.val();
    return msgs;
  }

  async filterByFrom(from: string, size: number = 10): Promise<any[]> {
    const snapshot = await this.msgsRef.orderByChild('from').equalTo(from).limitToLast(size).once('value');
    const msgs = snapshot.val();
    return msgs;
  }

}