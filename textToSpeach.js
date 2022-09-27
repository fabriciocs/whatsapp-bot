const { Translate } = require('@google-cloud/translate').v2;


const tellMe = async (text) => {

  let escapedLines = text.replace(/&/g, '&amp;');
  escapedLines = escapedLines.replace(/"/g, '&quot;');
  escapedLines = escapedLines.replace(/</g, '&lt;');
  escapedLines = escapedLines.replace(/>/g, '&gt;');

  let translations = await translate.translate(text, 'pt-BR');
  console.log({ translations });
  return translations;
}

module.exports = {
  tellMe
}