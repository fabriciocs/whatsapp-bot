
import * as admin from 'firebase-admin';
import { ChatConfigType, commandMarkers, keyReplacer } from './util';
export default class ChatConfigsManager {

  constructor(private chatConfigsRef: admin.database.Reference) {
  }

  private getRef(from: string): admin.database.Reference {
    return this.chatConfigsRef.child(keyReplacer(from));
  }

  async getByNumber(from: string): Promise<ChatConfigType | undefined> {
    if (!from) return;
    const snapshot = await this.getRef(from).once('value');
    const config = await snapshot.val();
    if (!config) return;
    const isUnique = () => config.commands.length === 1;
    config.isUnique = isUnique;
    return config;
  }
  async getByNumberOrSession(from: string, id: string): Promise<ChatConfigType | undefined> {
    if (!from && !id) return;
    let config = await this.getByNumber(id);
    if (!config) config = await this.getByNumber(from);
    if (!config) return;
    return config;
  }

  async saveConfig(from: string, commands: string[], isAutomatic = false, cmdMarkers = commandMarkers, prefix = ''): Promise<void> {
    if (!from) return;
    await this.getRef(from).set({ commands, isAutomatic, commandMarkers: cmdMarkers, prefix });
  }

  async deleteConfig(from: string): Promise<void> {
    if (!from) return;
    await this.getRef(from).remove();
  }
}