import { BufferMemory, BufferWindowMemory, ConversationSummaryBufferMemory } from "langchain/memory";
import { FirestoreChatMessageHistory } from "@langchain/community/stores/message/firestore";
import { ConversationChain } from "langchain/chains";
import { ChatMessageHistory } from "langchain/stores/message/in_memory"
import { SystemMessage, HumanMessage } from "langchain/schema";
import { OpenAI } from 'openai';


import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { AgentExecutor } from "langchain/agents";
import { Calculator } from "langchain/tools/calculator";
import { pull } from "langchain/hub";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { renderTextDescription } from "langchain/tools/render";
import { ReActSingleInputOutputParser } from "langchain/agents/react/output_parser";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentStep } from "@langchain/core/agents";
import { BaseMessage } from "@langchain/core/messages";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { compile } from "html-to-text";
import { RecursiveUrlLoader } from "langchain/document_loaders/web/recursive_url";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
// import { HandlebarsPromptTemplate } from "@langchain/community/prompts/handlebars";
// import { StringOutputParser } from "@langchain/core/output_parsers";
import "@tensorflow/tfjs-backend-cpu";
import { TensorFlowEmbeddings } from "langchain/embeddings/tensorflow";




const modelName = 'gpt-3.5-turbo';
const configuration = {
    apiKey: process.env.OPENAI_API_KEY
};

export type LoadSiteParams = {
    id:string; url: string;
}
const load_site = async ({id, url}: LoadSiteParams) => {

    const compiledConvert = compile({ wordwrap: 130 }); // returns (text: string) => string;

    const loader = new RecursiveUrlLoader(url, {
      extractor: compiledConvert,
      maxDepth: 5,
      preventOutside: true
    });
    
    const docs = await loader.load();

const privateKey = process.env.SUPABASE_PRIVATE_KEY;
if (!privateKey) throw new Error(`Expected env var SUPABASE_PRIVATE_KEY`);

const supabase_url = process.env.SUPABASE_URL;
if (!supabase_url) throw new Error(`Expected env var SUPABASE_URL`);


 try {
     const client = createClient(supabase_url, privateKey);
     const  embeddings = new TensorFlowEmbeddings();

     const vectorStore = await SupabaseVectorStore.fromDocuments(
       docs,
       embeddings,
       {
         client,
         tableName: "documents",
         queryName: "match_documents",
       }
     );
   
     const resultOne = await vectorStore.similaritySearch("Quem é Gimenes", 1);
   
     console.log(resultOne);
 } catch (error) {
    console.error('erro', error)
 }
};


const conversation: Record<string, AgentExecutor> = {};

const noMemoryChat = async (system: string, message: string) => {

    try {

        // const llamaPath = "/home/fabri/gpt/LLama2/llama-2-7b.Q3_K_M.gguf";

        const model = new ChatOpenAI({
            modelName
        });
        const memory = new BufferWindowMemory({

            chatHistory: new ChatMessageHistory([new SystemMessage(system)]),
            k: 1

        })
        const chain = new ConversationChain({ llm: model, memory });
        // You can also use the model as part of a chain
        const res = await chain.call({ input: message })
        return res.response;
    } catch (error) {
        console.error('No memmory Failed to send message:', error);
        return 'Sorry, an error occurred.';
    }

}


type SimpleChatParams = {
    clientWid: string, chatId: string, from: string, system: string, message: string, conversationId: string, prompt: PromptTemplate<any,any>
}
const memorized_chat = async ({ clientWid, chatId, from, prompt }: SimpleChatParams) => {
    const chatHistory = new FirestoreChatMessageHistory({
        collectionName: clientWid,
        sessionId: chatId,
        userId: from,
        config: { projectId: process.env.AGENT_PROJECT }
    });
    const model = new ChatOpenAI();
    await chatHistory.clear();
    const memory = new BufferMemory({
        memoryKey: "chat_history",
        chatHistory
    })
    const modelWithStop = model.bind({
        stop: ["\nObservation"],
    });

    // const vectorStore = await Chroma.fromExistingCollection(
    //     embeddings,
    //     { collectionName: chatId }
    // );
    // const store = new GoogleCloudStorageDocstore({
    //     bucket: `${process.env.GOOGLE_CLOUD_STORAGE_BUCKET!}/${chatId}`,
    //     prefix: from
    // });

    // const config = {
    //     index: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEX!,
    //     indexEndpoint: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEXENDPOINT!,
    //     apiVersion: "v1beta1",
    //     docstore: store,
    // };

    // const engine = new MatchingEngine(embeddings, config);

    /* Create the agent */
    // const vectorStoreInfo: VectorStoreInfo = {
    //     name: "chat_shared_files",
    //     description: "the files shared in the conversation",
    //     vectorStore
    // };

    // const toolkit = new VectorStoreToolkit(vectorStoreInfo, model);
    // const agent = createVectorStoreAgent(model, toolkit);
    const tools = [
        new SerpAPI('9393b290377acf6b03a22e95c2a67188bc90dd8c', {
            location: "Brazil",
            hl: "pt",
            gl: "br",
        }),
        new Calculator(),
        // new GooglePlacesAPI(),
        // ...agent.tools
    ];
    
    /** Add input variables to prompt */
    const toolNames = tools.map((tool) => tool.name);
    const promptWithInputs = await prompt.partial({
        tools: renderTextDescription(tools),
        tool_names: toolNames.join(","),
    });

    const runnableAgent = RunnableSequence.from([
        {
            input: (i: {
                input: string;
                steps: AgentStep[];
                chat_history: BaseMessage[];
            }) => i.input,
            agent_scratchpad: (i: {
                input: string;
                steps: AgentStep[];
                chat_history: BaseMessage[];
            }) => formatLogToString(i.steps),
            chat_history: (i: {
                input: string;
                steps: AgentStep[];
                chat_history: BaseMessage[];
            }) => i.chat_history,
        },
        promptWithInputs,
        modelWithStop,
        new ReActSingleInputOutputParser({ toolNames }),
    ]);
    const executor = AgentExecutor.fromAgentAndTools({
        agent: runnableAgent,
        tools,
        memory,
        verbose: true,
         maxIterations: 5
    });
    return executor;
}

const simpleChat = async (params: SimpleChatParams) => {
    const { system, message, conversationId } = params;
    try {
        if (!conversation[conversationId]) {
            conversation[conversationId] = await memorized_chat(params);
        }
        const res = await conversation[conversationId].invoke({ input: message })
        const response = res.output;
        console.log({ system, message, response, })
        return response;
    } catch (error) {
        console.error('Failed to send message:', error);
        return 'Sorry, an error occurred.';
    }

}
export { load_site
};

