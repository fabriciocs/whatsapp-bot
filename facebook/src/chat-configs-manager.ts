
import * as admin from 'firebase-admin';
import { ChatConfigType, commandMarkers, keyReplacer } from './util';
export default class ChatConfigsManager {

  constructor(private chatConfigsRef: admin.database.Reference) {
  }

  private getChildRef(from: string): admin.database.Reference {
    const key = keyReplacer(from);
    return this.chatConfigsRef.child(key);
  }

  async getByKey(from: string): Promise<ChatConfigType | undefined> {
    if (!from) return;
    const snapshot = await this.getChildRef(from).get();
    if (!snapshot.exists()) return;

    const config = snapshot.val();
    if (!config) return;
    
    const isUnique = () => config.commands.length === 1;
    config.isUnique = isUnique;
    return config;
  }
  async getBySessionOrNumber(id: string, from: string): Promise<ChatConfigType | undefined> {
    if (!from && !id) return;
    let config = await this.getByKey(id);
    if (!config) {
      return await this.getByKey(from);
    }
    return config;
  }

  async saveConfig(from: string, commands: string[], isAutomatic = false, cmdMarkers = commandMarkers, prefix = ''): Promise<void> {
    if (!from) return;
    await this.getChildRef(from).set({ commands, isAutomatic, commandMarkers: cmdMarkers, prefix });
  }

  async deleteConfig(from: string): Promise<void> {
    if (!from) return;
    await this.getChildRef(from).remove();
  }
}