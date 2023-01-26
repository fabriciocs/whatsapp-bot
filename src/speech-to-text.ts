import { protos, SpeechClient } from "@google-cloud/speech";

export const readToMe = async (base64Content: string, config: protos.google.cloud.speech.v1.IRecognitionConfig = {
    encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
    sampleRateHertz: 16000,
    languageCode: 'pt-BR',
    enableAutomaticPunctuation: true,
    enableSeparateRecognitionPerChannel: false,
    profanityFilter: false,
}) => {

    const speechClient = new SpeechClient();
    const [response] = await speechClient.recognize({
        audio: { content: base64Content }, config
    });
    const transcription = response?.results?.map(result => result?.alternatives?.[0]?.transcript)?.join('\n') ?? '';
    return transcription;
};