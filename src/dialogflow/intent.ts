
import { IntentsClient, SessionsClient } from '@google-cloud/dialogflow-cx';

export class Intent {
    async getIntent(id, text, isSound = false, projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = process.env.AGENT_LANGUAGE_CODE) {

        const sessionClient = new SessionsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const sessionPath = sessionClient.projectLocationAgentSessionPath(projectId, process.env.AGENT_LOCATION, agentId, id);
        
        const queryInput = {
            languageCode
        } as any;
        if (isSound) {
            queryInput.audio = {
                audio: text,
                config: {
                    audioEncoding: 'AUDIO_ENCODING_OGG_OPUS',
                    sampleRateHertz: 16000
                }
            };
        } else {
            queryInput.text = {
                text: text
            };
        }

        const request = {
            session: sessionPath,
            queryInput
        };

        // Send request and log result
        const [response] = await sessionClient.detectIntent(request);
        const responseMsgs = [];
        console.log('Detected intent');
        const result = response.queryResult;
        console.log(`  text: ${result.text}`);
        console.log(`  transcript: ${result.transcript}`);
        responseMsgs.push(...result.responseMessages?.map(message => message?.text?.text?.join(' ')));
        if (result.currentPage) {
            console.log(`  currentPage: ${result.currentPage.displayName}`);

        }
        if (result.intent) {
            console.log(`  Intent: ${result.intent.displayName}`);
        } else {
            console.log(`  No intent matched.`);
            return [];
        }
        return responseMsgs;
    }
    async updateIntentParams(projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID) {

        const intentsClient = new IntentsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const parent = intentsClient.agentPath(projectId, process.env.AGENT_LOCATION, agentId);
        const [intents] = await intentsClient.listIntents({ parent });
        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];
            console.log({ [`${intent.displayName}`]: intent.parameters?.map(({ id }) => id) });
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

