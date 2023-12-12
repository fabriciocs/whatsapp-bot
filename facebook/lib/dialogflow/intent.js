"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Intent = void 0;
const dialogflow_cx_1 = require("@google-cloud/dialogflow-cx");
const functions = require("firebase-functions");
class Intent {
    async getIntent({ id = '', text = '', isSound = false, projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = process.env.AGENT_LANGUAGE_CODE }) {
        var _a, _b, _c, _d, _e, _f, _g;
        const sessionClient = new dialogflow_cx_1.SessionsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const sessionPath = sessionClient.projectLocationAgentSessionPath(projectId, process.env.AGENT_LOCATION, agentId, id);
        const queryInput = {
            languageCode
        };
        if (isSound) {
            queryInput.audio = {
                audio: text,
                config: {
                    audioEncoding: dialogflow_cx_1.protos.google.cloud.dialogflow.cx.v3.AudioEncoding.AUDIO_ENCODING_OGG_OPUS,
                    sampleRateHertz: 16000
                }
            };
        }
        else {
            queryInput.text = {
                text: text
            };
        }
        const request = {
            session: sessionPath,
            queryInput
        };
        // Send request and log result
        const [{ queryResult: result }] = await sessionClient.detectIntent(request);
        functions.logger.info('getIntent', {
            text: result === null || result === void 0 ? void 0 : result.text,
            transcript: (_a = result === null || result === void 0 ? void 0 : result.transcript) !== null && _a !== void 0 ? _a : 'No transcript matched.',
            Intent: (_c = (_b = result === null || result === void 0 ? void 0 : result.intent) === null || _b === void 0 ? void 0 : _b.displayName) !== null && _c !== void 0 ? _c : 'No intent matched.',
            currentPage: (_e = (_d = result === null || result === void 0 ? void 0 : result.currentPage) === null || _d === void 0 ? void 0 : _d.displayName) !== null && _e !== void 0 ? _e : 'No page matched.',
        });
        return (_g = (_f = result === null || result === void 0 ? void 0 : result.responseMessages) === null || _f === void 0 ? void 0 : _f.map((message) => { var _a, _b; return (_b = (_a = message === null || message === void 0 ? void 0 : message.text) === null || _a === void 0 ? void 0 : _a.text) === null || _b === void 0 ? void 0 : _b.join(' ').trim(); }).filter(Boolean)) !== null && _g !== void 0 ? _g : [];
    }
    async updateIntentParams(projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID) {
        var _a;
        const intentsClient = new dialogflow_cx_1.IntentsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const parent = intentsClient.agentPath(projectId, process.env.AGENT_LOCATION, agentId);
        const [intents] = await intentsClient.listIntents({ parent });
        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];
            console.log({ [`${intent.displayName}`]: (_a = intent.parameters) === null || _a === void 0 ? void 0 : _a.map((a) => a.id) });
            //     const request = {
            //         intent: intent,
            //         languageCode: 'pt-br',
            //         updateMask: {
            //             paths: [
            //                 'parameters'
            //             ]
            //         }
            //     };
            // intentsClient.updateIntent(request);
        }
    }
}
exports.Intent = Intent;
//# sourceMappingURL=intent.js.map