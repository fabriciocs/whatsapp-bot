
import { IntentsClient, SessionsClient, protos } from '@google-cloud/dialogflow-cx';


import { Entry, Log, Logging } from "@google-cloud/logging";

export class Intent {

    public static LOGGING = new Logging();
    async getIntent({ id, text, isSound = false, projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = process.env.AGENT_LANGUAGE_CODE }) {
        const logger = Intent.LOGGING.log('getIntent');

        const sessionClient = new SessionsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const sessionPath = sessionClient.projectLocationAgentSessionPath(projectId, process.env.AGENT_LOCATION, agentId, id);

        const queryInput: protos.google.cloud.dialogflow.cx.v3.IQueryInput = {
            languageCode
        } as any;
        if (isSound) {
            queryInput.audio = {
                audio: text,
                config: {
                    audioEncoding: protos.google.cloud.dialogflow.cx.v3.AudioEncoding.AUDIO_ENCODING_OGG_OPUS,
                    sampleRateHertz: 16000
                }
            };
        } else {
            queryInput.text = {
                text: text
            };
        }

        const request: protos.google.cloud.dialogflow.cx.v3.IDetectIntentRequest = {
            session: sessionPath,
            queryInput
        };

        // Send request and log result
        const [{ queryResult: result }] = await sessionClient.detectIntent(request);

        await logger.info(new Entry(null, {
            text: result.text,
            transcript: result.transcript ?? 'No transcript matched.',
            Intent: result.intent?.displayName ?? 'No intent matched.',
            currentPage: result.currentPage?.displayName ?? 'No page matched.',
        }));

        return result.responseMessages?.map(message => message?.text?.text?.join(' ').trim()).filter(Boolean) ?? [];
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

