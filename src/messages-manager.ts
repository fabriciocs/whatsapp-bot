
import * as admin from 'firebase-admin';
import { Message } from 'whatsapp-web.js';
import { keyReplacer } from './util';
export default class MessagesManager {

  constructor(private msgsRef: admin.database.Reference) {
  }

  async getMsgs(size = 10): Promise<any[]> {
    const snapshot = await this.msgsRef.limitToFirst(size).once('value');
    return await snapshot.val();
  }

  async filterByFrom(from: string, size: number = 10): Promise<any> {
    if (!from) return;
    const snapshot = await this.msgsRef.orderByChild('fromParsed').equalTo(keyReplacer(from)).limitToFirst(size).once('value');
    return await snapshot.val();
  }
  async getMessage(id: string): Promise<any> {
    const msg = await this.msgsRef.child(id).once('value');
    return await msg.val();
  }

  async saveMessage(msg: Message): Promise<void> {
    await this.msgsRef.push().set({ fromParsed: keyReplacer(msg.from), ...msg });
  }
  
  async updateMessage(id: string, msg: Message): Promise<any> {
    const updated = await this.msgsRef.child(id).update(msg);
    return updated;
  }

}