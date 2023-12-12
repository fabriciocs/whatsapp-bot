
import * as path from 'path';


import * as admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const getServiceAccountData = async () => {
    const serviceAccount = await readFile(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8');
    return JSON.parse(serviceAccount) as admin.ServiceAccount;
}
const dbConfig = async () => {
    const app = admin.initializeApp({
        credential: admin.credential.cert(await getServiceAccountData()),
        databaseURL: 'https://elevate-luau-tech-default-rtdb.firebaseio.com',
        storageBucket: process.env.BUCKET_URL
    });
    return { admin, app };
}

export default dbConfig;
