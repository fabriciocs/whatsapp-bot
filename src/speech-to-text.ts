import { protos, SpeechClient } from "@google-cloud/speech";


export const readToMe = async (base64Content: string, languageCode = 'pt-BR') => {
    const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
        encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
        sampleRateHertz: 16000,
        languageCode,
        enableAutomaticPunctuation: true,
        enableSeparateRecognitionPerChannel: false,
        profanityFilter: false,
    }
    const speechClient = new SpeechClient();
    const [response] = await speechClient.recognize({
        audio: { content: base64Content }, config
    });
    const transcription = response?.results?.map(result => result?.alternatives?.[0]?.transcript)?.join('\n') ?? '';
    return transcription;
};




export const readUint8ArrayToMe = async (content: Uint8Array, languageCode = 'pt-BR') => {
    const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
        encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
        sampleRateHertz: 16000,
        languageCode,
        enableAutomaticPunctuation: true,
        enableSeparateRecognitionPerChannel: false,
        profanityFilter: false,
    }
    const speechClient = new SpeechClient();
    const [response] = await speechClient.recognize({
        audio: { content }, config
    });
    const transcription = response?.results?.map(result => result?.alternatives?.[0]?.transcript)?.join('\n') ?? '';
    return transcription;
};

// PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9InB0IiBpZD0iZmFjZWJvb2siIGNsYXNzPSJub19qcyI+CjxoZWFkPjxtZXRhIGNoYXJzZXQ9InV0Zi04IiAvPjxtZXRhIG5hbWU9InJlZmVycmVyIiBjb250ZW50PSJkZWZhdWx0IiBpZD0ibWV0YV9yZWZlcnJlciIgLz48c2NyaXB0IG5vbmNlPSJ6WkdTTFV2aCI+ZnVuY3Rpb24gZW52Rmx1c2goYSl7ZnVuY3Rpb24gYihiKXtmb3IodmFyIGMgaW4gYSliW2NdPWFbY119d2luZG93LnJlcXVpcmVMYXp5P3dpbmRvdy5yZXF1aXJlTGF6eShbIkVudiJdLGIpOih3aW5kb3cuRW52PXdpbmRvdy5FbnZ8fHt9LGIod2luZG93LkVudikpfWVudkZsdXNoKHsidXNlVHJ1c3RlZFR5cGVzIjpmYWxzZSwiaXNUcnVzdGVkVHl…F9LCIxODI5MzE5Ijp7cjoxfSwiMTgyOTMyMCI6e3I6MX0sIjE4NDM5ODgiOntyOjF9fSxna3hEYXRhOnsiOTk2OTQwIjp7cmVzdWx0OmZhbHNlLGhhc2g6IkFUN29wWXVFR3kzc2pHMWFhV0EifSwiMTA5OTg5MyI6e3Jlc3VsdDpmYWxzZSxoYXNoOiJBVDVrbHkyTFNaVl9ES0dSYTQ0In19LHFleERhdGE6eyIyMDQiOntyOm51bGx9fX0saGJscDp7Y29uc2lzdGVuY3k6e3JldjoxMDA3OTk4ODAwfX19LGFsbFJlc291cmNlczpbIkJ2R1VYaDQiLCI4a1NlMXR5IiwiWWdzZkUwVyIsIk5SeVpoOVkiLCI2aWErZDZ2IiwiaFVuZzkxdiIsImcwTnZTZ1kiLCJUUFZISXg5IiwiTG9oNUZTYSIsIk9KL1ZZUGEiXX0pO30pKTs8L3NjcmlwdD48L2JvZHk+PC9odG1sPg==