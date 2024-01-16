import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { OpenAI } from "langchain/llms/openai";
import { JsonSpec, JsonObject } from "langchain/tools";
import { JsonToolkit, createJsonAgent } from "langchain/agents";
import { JSONLoader } from "langchain/document_loaders/fs/json";

const loadJson = async () => {
    let data: JsonObject;
    try {

        const response = await fetch('https://www.insurtech.com.br/wp-json/wp/v2/posts');
        const loader = new JSONLoader(await response.blob());
        const data = await loader.load();

        if (!data) {
            throw new Error("Failed to load OpenAPI spec");
        }
    } catch (e) {
        console.error(e);
        return;
    }

    const toolkit = new JsonToolkit(new JsonSpec(data));
    const model = new OpenAI({ temperature: 0 });
    const executor = createJsonAgent(model, toolkit);

    const input = `Where is yost posts`;

    console.log(`Executing with input "${input}"...`);

    const result = await executor.invoke({ input });

    console.log(`Got output ${result.output}`);

    console.log(
        `Got intermediate steps ${JSON.stringify(
            result.intermediateSteps,
            null,
            2
        )}`
    );
}
(async () => await loadJson())()