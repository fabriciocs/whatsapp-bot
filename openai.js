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
    prompt: "", temperature: 0.4, top_p: 1, best_of: 1, max_tokens: 2048
}

const doIt = async (config) => {
    const response = await openai.createCompletion({ ...params, ...config });
    console.log({ response: JSON.stringify(response.data, null, 4) });
    return response.data;
}

const writeAText = async (config) => {
    return await doIt({ ...config, "model": "text-davinci-002" })
};
// const giveMeImage = async (prompt)=>{
//     return await dalle.generate(prompt);
// };

module.exports = {
    writeAText,
    // giveMeImage
};
