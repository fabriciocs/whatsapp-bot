import { CreateCompletionRequest, CreateCompletionResponse, OpenAIApi } from "openai";

export default class CurrierModel {
    private readonly maxTokens = 100;

    private params: CreateCompletionRequest = {
        model: "text-curie-001",
        temperature: 0.5,
        max_tokens: this.maxTokens,
        top_p: 1,
        frequency_penalty: 0.8,
        presence_penalty: 0
    }
    constructor(private client: OpenAIApi) {

    }
    private getMaxTokens(prompt: string) {
        const tokensCount = prompt?.length + this.maxTokens;
        return tokensCount > 2048 ? 1000 : tokensCount;
    }
    private async execCompletion(prompt: string, config?: CreateCompletionRequest): Promise<string> {
        const request = {...config,  ...this.params, max_tokens: this.getMaxTokens(prompt), prompt };
        try {
            const { data } = await this.client.createCompletion(request);
            const result = data?.choices?.[0]?.text;
            return result ? `${result}` : '';
        } catch (e) {
            console.log(e)
        }
        return null;
    }

    public async keyPoints(text: string): Promise<string> {

        const basePrompt = `Extraia as ideias principais do texto:\n\n"${text}"`;
        return await this.execCompletion(basePrompt);

    }


    public async keyWords(text: string): Promise<string> {
        const basePrompt = `Extraia as palavras chaves do texto:\n\n"${text}"`;
        return await this.execCompletion(basePrompt);
    }

    
    public async categories(text: string): Promise<string> {
        const basePrompt = `Extraia as categorias do texto:\n\n"${text}"\n\nExemplo: "Tecnologia; Ciência; Saúde".`;
        return await this.execCompletion(basePrompt, {model: 'text-davinci-003'});
    }
}