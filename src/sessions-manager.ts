
import * as admin from 'firebase-admin';
import { Store } from 'whatsapp-web.js';
export default class SessionsManager implements Store {

  constructor(private storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
  }
  async sessionExists(options: { session: string; }): Promise<boolean> {
    const destination = this.getZipDestination(options);
    const [exists] = await this.storage.file(destination).exists();
    return exists;
  }

  async delete(options: { session: string; }) {
    const destination = this.getZipDestination(options);
    await this.storage.file(destination).delete();
  }

  async save(options: { session: string; }) {
    const destination = this.getZipDestination(options);
    await this.storage.upload(destination, {
      destination
    });
  };

  async extract(options: { session: string; path?: string; }) {
    const destination = this.getZipDestination(options);
    await this.storage.file(destination).download({
      destination
    });
  };
  private getZipDestination(options: { session: string; path?: string; }) {
    return options.path ?? `${options.session}.zip`;
  }

}


