import { S3Client, ListObjectsCommand, ListObjectsCommandInput, ListObjectsCommandOutput, GetObjectCommandInput, GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import list from './amazon-folder-list';
import { pipeline, PassThrough } from 'stream';
const client = new S3Client({
    region: process.env.AWS_REGION
});

const { folders } = list;
const readCnhFile = async (): Promise<string> => {
    const randomImagePath = folders[Math.floor(Math.random() * folders.length)];
    const bucket = process.env.AWS_BUCKET_NAME;

    const params: ListObjectsCommandInput = {
        Bucket: bucket,
        MaxKeys: 1,
        Delimiter: '/',
        Prefix: `Motoristas/${randomImagePath}/cnh_`,
    };

    try {
        const command = new ListObjectsCommand(params);
        return await backupImageLocally(await getImageContent(await extractSingleKey(await client.send(command))));
    } catch (e) {
        console.error(e);
    }
    return '';
};

const extractSingleKey = (response: ListObjectsCommandOutput) => {
    const { Contents: [{ Key }] = [{ Key: null }] } = response;
    return Key ?? null;
};

const getImageContent = async (key: string) => {
    const bucket = process.env.AWS_BUCKET_NAME;
    const params: GetObjectCommandInput = {
        Bucket: bucket,
        Key: key
    };
    return await client.send(new GetObjectCommand(params));
};

const backupImageLocally = async (commandOutput: GetObjectCommandOutput) => {
    const { Body } = commandOutput;
    let path = resolve(join('./imageBackup', 'cnh/'));
    await mkdir(path, { recursive: true });
    path = join(path, `${randomBytes(4).toString('hex')}.jpg`);
    await writeFile(path, await Body.transformToByteArray());
    console.log(`Image saved to ${path}`);
    return path;
};
export {
    readCnhFile
};
