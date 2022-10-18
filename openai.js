const dotenv = require('dotenv');
dotenv.config();
const { Configuration, OpenAIApi } = require("openai");
// import { Dalle } from "dalle-node";
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
// const dalle = new Dalle(process.env.OPENAI_API_KEY);
const params = {
    prompt: "",
    temperature: 0.2,
    best_of: 1,
    max_tokens: 900, 
    frequency_penalty: 1,
     presence_penalty: 0,
     stop: 'stop'
}

const doIt = async (config) => {
    const response = await openai.createCompletion({ ...params, ...config });
    console.log({ response: JSON.stringify(response.data, null, 4) });
    return response.data;
}

const writeAText = async (config) => {
    return await doIt({ ...config, "model": "text-davinci-002" })
};

module.exports = {
    writeAText,
    // giveMeImage
};
