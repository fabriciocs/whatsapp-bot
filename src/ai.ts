import * as path from 'path';

import { Configuration, CreateCompletionRequest, OpenAIApi } from 'openai';

// import { Dalle } from 'dalle-node';

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const clientAi = new OpenAIApi(configuration);
// const dalle = new Dalle(configuration.apiKey);
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

export {
    writeAText
    // giveMeImage: async (prompt) => {
    //     return await dalle.generate(prompt);
    // }
};
