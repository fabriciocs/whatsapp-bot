const { Translate } = require('@google-cloud/translate').v2;
const translate = new Translate();



const translatePlease = async (text, languageCode = 'pt-BR') => {
  let translations = await translate.translate(text, languageCode);
  return translations;
};
const inPortuguesePlease = async (text) => {
  return await translatePlease(text);
};

const inEnglishPlease = async (text) => {
  return await translatePlease(text, 'en');
};

module.exports = {
  inPortuguesePlease,
  translatePlease,
  inEnglishPlease
}