
import * as admin from 'firebase-admin';
import { resolve } from 'path';
import { Store } from 'whatsapp-web.js';
import fs from 'fs';

export default class SessionsManager implements Store {

  constructor(private storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
  }
  async sessionExists(options: { session: string; }): Promise<boolean> {
    const { id, destination } = this.getZipDestination(options);
    const [exists] = await this.storage.file(id).exists();
    if (!exists) {
      if (fs.existsSync(destination)) {
        return true;
      }
    }
    return exists;
  }

  async delete(options: { session: string; }) {
    const { id, destination } = this.getZipDestination(options);
    const file = this.storage.file(id);
    const [fileExists] = await file.exists();
    if (fileExists) {
      await file.delete();
    } else if (fs.existsSync(destination)) {
      fs.unlinkSync(destination);
    }
  }

  async save(options: { session: string; }) {
    const { destination, id } = this.getZipDestination(options);
    try {
      const [response] = await this.storage.upload(id, {
        destination
      });
      
    } catch (e) {
      console.error(e);
    }
    return destination;
  };

  async extract(options: { session: string; path?: string; }) {
    const { destination, id } = this.getZipDestination(options);
    const file = this.storage.file(id);
    const [fileExists] = await file.exists();
    if (fileExists) {
      await file.download({
        destination
      });
    }
  };
  private getZipDestination(options: { session: string; path?: string; }) {
    const id = `${options.session}.zip`;
    const destination = resolve(options.path ?? id);
    return { destination, id };
  }

}


