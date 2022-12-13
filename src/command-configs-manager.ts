
import * as admin from 'firebase-admin';
import { Message } from 'whatsapp-web.js';
import { ChatConfigType, commandMarkers, keyReplacer } from './util';
export default class CommandConfigsManager {

  constructor(private commandConfigsRef: admin.database.Reference) {
  }

  private getRef(from: string): admin.database.Reference {
    return this.commandConfigsRef.child(keyReplacer(from));
  }

  async getByNumber(from: string): Promise<ChatConfigType> {
    if (!from) return;
    const snapshot = await this.getRef(from).once('value');
    const commands = await snapshot.val();
    if (!commands) return;
    const isUnique = () => commands.commands.length === 1;
    commands.isUnique = isUnique;
    return commands;
  }

  async save(to: string, cmdMarkers = commandMarkers): Promise<void> {
    if (!to) return;
    await this.getRef(to).set({ commandMarkers: cmdMarkers });
  }

  async delete(from: string): Promise<void> {
    if (!from) return;
    await this.getRef(from).remove();
  }

}