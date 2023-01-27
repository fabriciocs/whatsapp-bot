
import * as admin from 'firebase-admin';
import { resolve } from 'path';
import { Store } from 'whatsapp-web.js';
export default class SessionsManager implements Store {

  constructor(private storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
  }
  async sessionExists(options: { session: string; }): Promise<boolean> {
    const { id } = this.getZipDestination(options);
    const [exists] = await this.storage.file(id).exists();
    return exists;
  }

  async delete(options: { session: string; }) {
    const { id } = this.getZipDestination(options);
    await this.storage.file(id).delete();
  }

  async save(options: { session: string; }) {
    const { destination, id } = this.getZipDestination(options);

    const [response] = await this.storage.upload(id, {
      destination
    });
    return destination;
  };

  async extract(options: { session: string; path?: string; }) {
    const { destination, id } = this.getZipDestination(options);
    await this.storage.file(id).download({
      destination
    });
  };
  private getZipDestination(options: { session: string; path?: string; }) {
    const id = `${options.session}.zip`;
    const destination = resolve(options.path ?? id);
    return { destination, id };
  }

}


