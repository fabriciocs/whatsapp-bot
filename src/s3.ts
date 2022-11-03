import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3';

import list from './amazon-folder-list';

const client = new S3Client({
    region: process.env.AWS_REGION
});

const { folders } = list;
const randomImagePath = folders[Math.floor(Math.random() * folders.length)];

const readCnhFile = async () => {
    const bucket = process.env.AWS_BUCKET_NAME;
    const params = {
        Bucket: bucket,
        MaxKeys: 1,
        Delimiter: '/',
        Prefix: `${bucket}/Motoristas/**/*`,
        StartAfter: `**/*${randomImagePath}/**/*`

    };

    const command = new ListObjectsCommand(params);
    return await client.send(command);
};

export {
    readCnhFile
};
