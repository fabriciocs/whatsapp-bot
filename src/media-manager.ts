
import * as admin from 'firebase-admin';
import { resolve } from 'path';
import { Store } from 'whatsapp-web.js';
import fs from 'fs';

export default class MediaManager {

  constructor(private storage = admin.storage().bucket(process.env.BUCKET_URL)) {
  }

  async base64ToUrl(base64: string, fileName: string): Promise<string> {
    //add proccess.env.ME to fileName
    const fullFilename = `${process.env.ME}-${fileName}`;
    //send base64 to firebase storage without saving to disk and return url
    const buffer = Buffer.from(base64, 'base64');
    const file = this.storage.file(fullFilename);
    await file.save(buffer);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491'
    });
    return url;

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


