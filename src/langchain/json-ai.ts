// import { createOpenAPIChain } from "langchain/chains";
// import { ChatOpenAI } from "@langchain/openai";
// import * as fs from 'fs';
// import * as yaml from "js-yaml";
// import { JsonObject, JsonSpec } from "langchain/tools";

// const chatModel = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
// export const run = async () => {
//   let data: JsonObject;
//     try {
//       const postman_collection = fs.readFileSync("/home/fabri/projects/whatsapp-bot/src/langchain/openapi.yaml", "utf8");
//       if (!postman_collection) {
//         throw new Error("Failed to load Postman Collection");
//       }
//       data = yaml.load(postman_collection) as JsonObject;
//       const input = `Quanto custa um da nmarca fiat modelo uno mile a gasolina do ano 95 na data de Janeiro de 2024`;

//       console.log(`Executing with input "${input}"...`);
//       const chain = await createOpenAPIChain(
//         postman_collection,
//         {
//           llm: chatModel
//         }
//       );
//       const result = await chain.run(input);

//       console.log(JSON.stringify(result, null, 2));
//     } catch (e) {
//       console.error(e);
//       return;
//     }
  
// };

import * as fs from "fs";
import * as yaml from "js-yaml";
import { OpenAI } from "@langchain/openai";
import { JsonSpec, JsonObject } from "langchain/tools";
import { createOpenApiAgent, OpenApiToolkit } from "langchain/agents";

export const runTest = async () => {
  let data: JsonObject;
  try {
    const yamlFile = fs.readFileSync("/home/fabri/projects/whatsapp-bot/src/langchain/openapi.yaml", "utf8");
    data = yaml.load(yamlFile) as JsonObject;
    if (!data) {
      throw new Error("Failed to load OpenAPI spec");
    }
  } catch (e) {
    console.error(e);
    return;
  }

  const headers = {
    "Content-Type": "application/json"
  };
  const model = new OpenAI({ modelName:'gpt-3.5-turbo', temperature: 0 });
  const toolkit = new OpenApiToolkit(new JsonSpec(data), model, headers);
  const executor = createOpenApiAgent(model, toolkit);

  const input = `Make all requests to discover: 'Quanto custa um da nmarca fiat modelo uno mile a gasolina do ano 95 na data de Janeiro de 2024'`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input, config:{
    recursionLimit: 5
  } });
  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );
};