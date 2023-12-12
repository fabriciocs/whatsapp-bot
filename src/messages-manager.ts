
import * as admin from 'firebase-admin';
import { Msg } from './msg/msg';
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

  async saveMessage(msg: Msg): Promise<void> {
    await this.msgsRef.push().set({ ...msg, fromParsed: keyReplacer(msg.from) });
  }


  async save(msg: any): Promise<void> {
    await this.msgsRef.push().set(msg);
  }

  async updateMessage(id: string, msg: Msg): Promise<any> {
    const updated = await this.msgsRef.child(id).update(msg);
    return updated;
  }

}