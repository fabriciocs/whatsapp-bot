
import textToSpeech from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';

const client = new textToSpeech.TextToSpeechClient();
const getLanguage = (languageCode: string) => languageCode != null ? languageCode : 'pt-BR';

const tellMe = async (content: string, language) => {
  const languageCode = getLanguage(language);

  console.log({ content });
  const text = content?.substring(0, 5000);

  const [voicesResponse] = await client.listVoices({ languageCode });
  const voice = voicesResponse?.voices?.find(v => v.ssmlGender === 'MALE');
  const selectedVoice = { ...voice, languageCode }
  const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
    // The text to synthesize
    input: { text },

    // The language code and SSML Voice Gender
    voice: selectedVoice,

    // The audio encoding type
    audioConfig: {
      audioEncoding: "MP3",
      "effectsProfileId": [
        "telephony-class-application"
      ],
      "pitch": 4.55,
      "speakingRate": 1
    }
  };


  const [response] = await client.synthesizeSpeech(request);
  return Buffer.from(response.audioContent).toString('base64');
}

export {
  tellMe
}