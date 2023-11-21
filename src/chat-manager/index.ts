import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
export type SimpleMsg = {
    input: string;
    output: string;
}
export class ChatSimppleMsgBuilder{
    private input: string;
    private output: string;
    constructor() {
        this.input = "";
        this.output = "";
    }

    fromMsg(msg: SimpleMsg) {
        this.input = msg.input;
        this.output = msg.output;
        return this;
    }
    addInput(input: string) {
        this.input = `${this.input}\n${input}`;
        return this;
    }
    addOutput(output: string) {
        this.output = `${this.output}\n${output}`;
        return this;
    }
    setInput(input: string) {
        this.input = input;
        return this;
    }
    setOutput(output: string) {
        this.output = output;
        return this;
    }
    build(): SimpleMsg {
        return {
            input: this.input,
            output: this.output
        }
    }
}
export class ChatSimpleMsgs {
    msgs: SimpleMsg[] = [];
    constructor(private inputter: string, private outputter: string) {
        this.msgs = [];
    }
    getMsgs() {
        return this.msgs;
    }

    addMsg(simpleMsg: SimpleMsg) {
        this.msgs.push(simpleMsg);
    }
}
export default class ChatManager {
    model: ChatOpenAI;
    tools: any[];
    executor: AgentExecutor;

    constructor() {
    }

    async init(){

        process.env.LANGCHAIN_HANDLER = "langchain";
        this.model = new ChatOpenAI({ temperature: 0 });
        this.tools = [
          new SerpAPI(process.env.SERPAPI_API_KEY, {
            location: "Luziânia,Goiás,Brazil",
            hl: "pt",
            gl: "br",
          }),
          new Calculator(),
        ];
        this.executor = await initializeAgentExecutorWithOptions(this.tools, this.model, {
            agentType: "chat-conversational-react-description",
            verbose: true,
          });
          console.log("Loaded agent.");
    }
    async doit(msgs: ChatSimpleMsgs ) {
          const chatMsgs = msgs.getMsgs();
          return await Promise.all(chatMsgs.map(async (msg) => {
                const result = await this.executor.call({ input: msg.input });
                console.log(`Got output ${result.output}`);
                msg.output = result.output;
                return msg;
            }));
    }
    
}