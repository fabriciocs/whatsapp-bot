
import * as admin from 'firebase-admin';
import { Message, Store } from 'whatsapp-web.js';
export default class SessionsManager implements Store {

  constructor(private sessionsRef: admin.database.Reference) {
  }

  private base64(session: string) {
    return Buffer.from(session).toString('base64');
  }
  async sessionExists(option: { session: string; }): Promise<boolean> {
    return !!(await this.extract(option));
  }

  async delete(options: { session: string; }) {
    const ref = await this.extractRef(options);
    await ref.remove();
  }

  async save(options: { session: string; }) {
    const ref = await this.extractRef(options);
    await ref.set(true);
  };

  async extract(options: { session: string; }) {
    const ref = await this.extractRef(options);
    const snapshot = await ref.once('value');
    return await snapshot.val();
  };

  async extractRef({ session }: { session: string; }) {
    if (!session) throw new Error('No session found');
    return await this.sessionsRef.child(this.base64(session));
  };

}