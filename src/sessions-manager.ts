
import * as admin from 'firebase-admin';
import { Message, Store } from 'whatsapp-web.js';
export default class SessionsManager implements Store {

  constructor(private storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
  }
  async sessionExists(option: { session: string; }): Promise<boolean> {
    const [exists] = await this.storage.file(option.session).exists();
    return exists;
  }

  async delete(options: { session: string; }) {
    await this.storage.file(options.session).delete();
  }

  async save(options: { session: string; }) {
    await this.storage.upload(`${options.session}.zip`, {
      destination: options.session,
    });
  };

  async extract(options: { session: string; path?: string; }) {
    const destination = options.path ?? `${options.session}.zip`;
    await this.storage.file(options.session).download({
      destination
    });
  };

}