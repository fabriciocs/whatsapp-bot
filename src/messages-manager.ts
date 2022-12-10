
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

  async filterByFrom(from: string, size: number = 10): Promise<any> {
    if (!from) return;
    const snapshot = await this.msgsRef.orderByChild('timestamp').equalTo(from.replace(/\D+/gm, '')).limitToFirst(size).once('value');
    const msgs = snapshot.val();
    return msgs;
  }
  async getMessage(id: string): Promise<any> {
    const msg = await this.msgsRef.child(id).once('value');
    return await msg.val();
  }

  async saveMessage(msg: Message): Promise<any> {
    const saved = await this.msgsRef.push().set(msg);
    return saved;
  }
  async updateMessage(id: string, msg: Message): Promise<any> {
    const updated = await this.msgsRef.child(id).update(msg);
    return updated;
  }

}