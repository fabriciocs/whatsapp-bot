import { createTrainingPhrases } from "../ai";

const { Translate } = require('@google-cloud/translate').v2;

export default class GoogleTranslate {
    constructor() {
    }

    async translateText(text: string[], targetLanguage: string = 'pt-BR') {
        //try catch
        let response;
        try {
            response = await createTrainingPhrases(text);
            return JSON.parse(response);
        } catch (error) {
            console.log({text, response, error});
        }
        return null;
    }
}