const { Translate } = require('@google-cloud/translate').v2;
const translate = new Translate();

const inPortuguesePlease = async (text) => {

  let translations = await translate.translate(text, 'pt-BR');
  console.log({ translations });
  return translations;
}

module.exports = {
  inPortuguesePlease
}