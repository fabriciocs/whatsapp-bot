
const textToSpeech = require('@google-cloud/text-to-speech');

const client = new textToSpeech.TextToSpeechClient();

const tellMe = async (text) => {

  const request = {
    // The text to synthesize
    input: { text: text?.substring(0, 5000) },

    // The language code and SSML Voice Gender
    voice: { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B', ssmlGender: 'MALE' },

    // The audio encoding type
    audioConfig: {
      audioEncoding: "MP3",
      "effectsProfileId": [
        "telephony-class-application"
      ],
      "pitch": 3.2,
      "speakingRate": 1
    }
  };


  const [response] = await client.synthesizeSpeech(request);
  return Buffer.from(response.audioContent).toString('base64');
}

module.exports = {
  tellMe
}