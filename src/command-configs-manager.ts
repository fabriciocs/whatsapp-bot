
import * as admin from 'firebase-admin';
import { ChatConfigType, commandMarkers, keyReplacer } from './util';
export default class CommandConfigsManager {

  constructor(private commandConfigsRef: admin.database.Reference) {
  }

  private getRef(id: string): admin.database.Reference {
    return this.commandConfigsRef.child(keyReplacer(id));
  }

  async getByNumber(id: string): Promise<ChatConfigType> {
    if (!id) return;
    const snapshot = await this.getRef(id).once('value');
    const commands = await snapshot.val();
    if (!commands) return;
    const isUnique = () => commands.commands.length === 1;
    commands.isUnique = isUnique;
    return commands;
  }

  async save(id: string, cmdMarkers = commandMarkers): Promise<void> {
    if (!id) return;
    await this.getRef(id).set({ commandMarkers: cmdMarkers });
  }

  async delete(from: string): Promise<void> {
    if (!from) return;
    await this.getRef(from).remove();
  }

}