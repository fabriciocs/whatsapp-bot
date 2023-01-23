import { createTrainingPhrases } from "../ai";
import { chunked } from "../util";

const { Translate } = require('@google-cloud/translate').v2;

export default class GoogleTranslate {
    constructor() {
    }


    async translateChuncked(text: string[], targetLanguage: string = 'pt-BR', chunkSize = 128) {
        const translate = new Translate();
        const chunks = chunked(text, chunkSize);
        const translations = [];
        for (const chunk of chunks) {
            let [chunkTranslations] = await translate.translate(chunk, targetLanguage);
            chunkTranslations = Array.isArray(chunkTranslations) ? chunkTranslations : [chunkTranslations];
            translations.push(...chunkTranslations);
        }
        return translations;
    }



    async translateText(text: string[], targetLanguage: string = 'pt-BR') {
        return await this.translateChuncked(text, targetLanguage);
    }
}