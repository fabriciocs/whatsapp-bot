"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tellMe = void 0;
const text_to_speech_1 = require("@google-cloud/text-to-speech");
const defaultVoice = { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B', ssmlGender: 'MALE' };
const client = new text_to_speech_1.default.TextToSpeechClient();
const getLanguage = (languageCode) => languageCode != null ? languageCode : 'pt-BR';
const getVoice = async (language) => {
    var _a;
    const languageCode = getLanguage(language);
    const [voicesResponse] = await client.listVoices({ languageCode });
    const voices = (_a = voicesResponse === null || voicesResponse === void 0 ? void 0 : voicesResponse.voices) === null || _a === void 0 ? void 0 : _a.filter(v => { var _a; return (_a = v.languageCodes) === null || _a === void 0 ? void 0 : _a.includes(languageCode); });
    if (!voices) {
        return defaultVoice;
    }
    const voice = voices.find(v => v.ssmlGender === 'MALE');
    const _b = (voice || voices[0]), { languageCodes } = _b, selectedVoice = __rest(_b, ["languageCodes"]);
    return Object.assign(Object.assign({}, selectedVoice), { languageCode });
};
const tellMe = async (content, language) => {
    const text = content === null || content === void 0 ? void 0 : content.substring(0, 5000);
    console.log({ content, text });
    const voice = await getVoice(language);
    const request = {
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
    return Buffer.from(response === null || response === void 0 ? void 0 : response.audioContent).toString('base64');
};
exports.tellMe = tellMe;
//# sourceMappingURL=textToSpeach.js.map