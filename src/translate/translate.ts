
const { Translate } = require('@google-cloud/translate').v2;

export default class GoogleTranslate {
    constructor() {
    }

    async translateText(text, targetLanguage: string = 'pt-BR') {
        const translate = new Translate();
        let [translations] = await translate.translate(text, targetLanguage);
        translations = Array.isArray(translations) ? translations : [translations];
        return translations;
    }
}