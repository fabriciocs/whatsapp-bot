
import * as admin from 'firebase-admin';
import { Store } from 'whatsapp-web.js';

export default class StorageStore implements Store {

    constructor(private storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
    }
    async sessionExists(params: any): Promise<boolean> {
        const { session } = params;
        const [exists] = await this.storage.file(`${session}.zip`).exists();
        return exists;
    }

    async delete(params: any) {
        const { session } = params;
        const id = `${session}.zip`;
        const file = this.storage.file(id, { preconditionOpts: { ifGenerationMatch: 0 } });
        const [fileExists] = await file.exists();
        if (fileExists) {
            await file.delete();
        }
    }

    async save(params: any) {
        const { session } = params;
        const id = `${session}.zip`;

        await this.storage.upload(id, {
            destination: id,
            gzip: true,
            metadata: {
                // Enable long-lived HTTP caching headers
                // Use only if the contents of the file will never change
                // (If the contents will change, use cacheControl: 'no-cache')
                cacheControl: 'public, max-age=31536000',
            },
        });
        return id;

    };

    async extract(params: any) {
        try {
            const { session, path: s } = params;
            const file = this.storage.file(`${session}.zip`, { preconditionOpts: { ifGenerationMatch: 0 } });
            await file.download({
                destination: s
            });
        } catch (e) {
            console.error('extract', {
                message: 'extract error',
                json_payload: e
            })
        }

    };

}


