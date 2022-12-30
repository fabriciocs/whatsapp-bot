
import * as admin from 'firebase-admin';
import { Message } from 'whatsapp-web.js';
import { ChatConfigType, commandMarkers, keyReplacer } from './util';
export default class ChatConfigsManager {

  constructor(private chatConfigsRef: admin.database.Reference) {
  }

  private getRef(from: string): admin.database.Reference {
    return this.chatConfigsRef.child(keyReplacer(from));
  }

  async getByNumber(from: string): Promise<ChatConfigType> {
    if (!from) return;
    const snapshot = await this.getRef(from).once('value');
    const config = await snapshot.val();
    if(!config) return;
    const isUnique = () => config.commands.length === 1;
    config.isUnique = isUnique;
    return config;
  }

  async saveConfig(from: string, commands: string[], isAutomatic = false, cmdMarkers = commandMarkers): Promise<void> {
    if (!from) return;
    await this.getRef(from).set({ commands, isAutomatic, commandMarkers: cmdMarkers });
  }

  async deleteConfig(from: string): Promise<void> {
    if (!from) return;
    await this.getRef(from).remove();
  }
}