import { CreateCompletionRequest, CreateCompletionResponse, OpenAIApi } from "openai";

export default class CurrierModel {
    private readonly maxTokens = 1000;
    private params = {
        model: "text-curie-001",
        temperature: 0.5,
        max_tokens: this.maxTokens,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: [`"""`],
    }
    constructor(private client: OpenAIApi) {

    }

    private async execCompletion(basePrompt: string, config: CreateCompletionRequest = { ...this.params, max_tokens: basePrompt?.length + this.maxTokens }): Promise<string> {
        try {
            const { data } = await this.client.createCompletion({
                ...config,
                prompt: basePrompt
            });
            const result = data?.choices?.[0]?.text;
            return result ? `${result}` : '';
        } catch (e) {
            console.log(e)
        }
        return null;
    }

    public async keyPoints(text: string): Promise<string> {

        const basePrompt = `Quais são os pontos chave desse texto:\n\n"""\n${text}\n"""\n\nOs pontos chave são:\n\n`;
        return await this.execCompletion(basePrompt);

    }


    public async keyWords(text: string): Promise<string> {
        const basePrompt = `Quais são as palavras chave desse texto:\n\n"""\n${text}\n"""\n\nAs palavras chave são:\n`;
        return await this.execCompletion(basePrompt);
    }
}