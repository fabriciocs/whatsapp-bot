
import * as admin from 'firebase-admin';
import { resolve } from 'path';
import { Store } from 'whatsapp-web.js';
import fs from 'fs';

export default class SessionsManager implements Store {

  constructor(private storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
  }
  async sessionExists({ session }: { session: string; }): Promise<boolean> {
    const [exists] = await this.storage.file(`${session}.zip`).exists();
    return exists;
  }

  async delete({ session }: { session: string; }) {
    const id = `${session}.zip`;
    const file = this.storage.file(id);
    const [fileExists] = await file.exists();
    if (fileExists) {
      await file.delete();
    }
  }

  async save({ session }: { session: string; }) {
    const id = `${session}.zip`;
    const [response] = await this.storage.upload(id, {
      destination: id
    });
    return id;

  };

  async extract({ session, path }: { session: string; path?: string; }) {
    const file = this.storage.file(`${session}.zip`);
    await file.download({
      destination: path
    });

  };

}


