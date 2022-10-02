const speech = require('@google-cloud/speech');

const tellMe = async (text) => {
  const client = new speech.SpeechClient();
  
}

module.exports = {
  tellMe
}