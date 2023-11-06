import CreateCompletionRequest, { OpenAI } from "openai";
import { simpleChat } from "./ai";

export default class CurrierModel {
    private readonly maxTokens = 100;

    constructor(private client: OpenAI) { }

    public async categories(text: string): Promise<string> {
        const basePrompt = `Extraia as categorias do texto:\n\n"${text}"\n\nExemplo: "Tecnologia; Ciência; Saúde".`;
        return await simpleChat(basePrompt);
    }
}