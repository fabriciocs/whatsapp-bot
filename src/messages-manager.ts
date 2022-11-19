
import * as admin from 'firebase-admin';
import { Message } from 'whatsapp-web.js';
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
  async getMessage(id: string): Promise<any> {
    const msg = await this.msgsRef.child(id).once('value');
    return await msg.val();
  }

}