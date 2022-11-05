import { Configuration, CreateCompletionRequest, OpenAIApi } from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { Message } from 'whatsapp-web.js';

const imageSize = '512x512';
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const clientAi = new OpenAIApi(configuration);
const params: Partial<CreateCompletionRequest> = {
    prompt: "",
    temperature: 0.2,
    best_of: 1,
    max_tokens: 900,
    frequency_penalty: 1,
    presence_penalty: 0,
    stop: 'stop'
}

const doIt = async (config: Partial<CreateCompletionRequest>) => {
    const response = await clientAi.createCompletion({ ...params, ...config } as CreateCompletionRequest);
    console.log({ response: JSON.stringify(response.data, null, 4) });
    return response.data;
}

const writeAText = async (config: Partial<CreateCompletionRequest>) => {
    return await doIt({ ...config, "model": "text-davinci-002" })
};
const giveMeImage = async (msg: Message, prompt: string) => {
    const response = await clientAi.createImage({
        prompt,
        n: 1,
        size: imageSize,
    });
    console.log(JSON.stringify({ response: response.data, prompt }, null, 4));
    return response.data.data[0].url;
};

const createVariation = async (f: File) => {
    const response = await clientAi.createImageVariation(f, 1, imageSize);
    console.log(JSON.stringify({ response: response.data, prompt }, null, 4));
    return response.data.data[0].url;
};

const editImage = async (image: File, mask: File, msg: Message, prompt: string) => {
    const response = await clientAi.createImageEdit(image, mask, prompt, 1, imageSize);
    console.log(JSON.stringify({ response: response.data, prompt }, null, 4));
    return response.data.data[0].url;
}
export {
    writeAText,
    giveMeImage,
    createVariation,
    editImage
};
