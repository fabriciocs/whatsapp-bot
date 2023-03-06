
import textToSpeech from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';

const defaultVoice: google.cloud.texttospeech.v1.IVoiceSelectionParams = { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B', ssmlGender: 'MALE' };
const client = new textToSpeech.TextToSpeechClient();
const getLanguage = (languageCode: string) => languageCode != null ? languageCode : 'pt-BR';
const getVoice = async (language: string): Promise<google.cloud.texttospeech.v1.IVoiceSelectionParams> => {
  const languageCode = getLanguage(language);
  const [voicesResponse] = await client.listVoices({ languageCode });
  const voices = voicesResponse?.voices?.filter(v => v.languageCodes?.includes(languageCode));
  if (!voices) {
    return defaultVoice;
  }
  const voice = voices.find(v => v.ssmlGender === 'MALE');
  const { languageCodes, ...selectedVoice } = (voice || voices[0]);
  return { ...selectedVoice, languageCode };
}

const tellMe = async (content: string, language: string) => {
  const text = content?.substring(0, 5000);
  console.log({ content, text });
  const voice = await getVoice(language);
  const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
    input: { text },
    voice,
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
  return Buffer.from(response?.audioContent!).toString('base64');
}

export {
  tellMe
}