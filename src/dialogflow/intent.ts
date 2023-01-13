
import { AgentsClient, FlowsClient, IntentsClient, PagesClient, SessionsClient, TransitionRouteGroupsClient } from '@google-cloud/dialogflow-cx';
const { v4 } = require('uuid');
import { writeFile, readFile } from 'fs/promises';
import { translateTrainingPhrases } from '../ai';
import { waitFor } from '../util';


//crie uma classe para incluir frases de treinamento no intent Default Welcome Intent
export class Intent {
    async getIntent(id, text, projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = 'pt-br') {
        // A new session needs to be created for each request.
        const sessionClient = new SessionsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const sessionPath = sessionClient.projectLocationAgentSessionPath(projectId, process.env.AGENT_LOCATION, agentId, id);
        console.log(sessionPath);
        // The text query request.
        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text
                },
                languageCode: languageCode,
            },
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

    async intentsFix(projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = 'en') {
        const intentsClients = new IntentsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const parent = intentsClients.agentPath(projectId, process.env.AGENT_LOCATION, agentId);
        const [intents] = await intentsClients.listIntents({ parent });
        const ptBr = {};
        const en = {};
        for (const intent of intents) {
            console.log('====================');
            console.log(`Intent name: ${intent.name}`);
            console.log(`Intent display name: ${intent.displayName}`);
            console.log(`# Parameters: ${intent.parameters.length}`);
            console.log(`# Training Phrases: ${intent.trainingPhrases.length}`);


            const training = JSON.stringify(intent.trainingPhrases.map(t => t.parts[0].text));
            ptBr[intent.name] = await translateTrainingPhrases(training);
            en[intent.name] = training;


        }
        await writeFile('ptbr.json', JSON.stringify(ptBr, null, 4), { encoding: 'utf8' });
        await writeFile('en.json', JSON.stringify(en, null, 4), { encoding: 'utf8' });
        return 'lidos';
    }
    async updatePage(projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = 'en') {
        try {

            const routesGroupClient = new TransitionRouteGroupsClient({
                apiEndpoint: process.env.AGENT_ENDPOINT
            });
            const flowPath = routesGroupClient.flowPath(projectId, process.env.AGENT_LOCATION, agentId, process.env.AGENT_FLOW_ID);
            const [transitionRouteGroups] = await routesGroupClient.listTransitionRouteGroups({ parent: flowPath });
            for (let index = 0; index < transitionRouteGroups.length; index++) {
                const transitionRouteGroup = transitionRouteGroups[index];
                for (let k = 0; k < transitionRouteGroup.transitionRoutes.length; k++) {
                    const route = transitionRouteGroup.transitionRoutes[k];
                    const fulfillment = route.triggerFulfillment;
                    const msgs = [];
                    for (let j = 0; j < fulfillment.messages.length; j++) {
                        const m = fulfillment.messages[j];
                        await waitFor(1000);
                        try {
                            const mText = await translateTrainingPhrases(JSON.stringify(m.text.text));
                            msgs.push({ ...m, text: { text: JSON.parse(mText) } });
                        } catch (error) {
                            console.error(error);
                        }
                    }
                    route.triggerFulfillment.messages = msgs;
                }
                const [result] = await routesGroupClient.updateTransitionRouteGroup({ transitionRouteGroup, updateMask: { paths: ['transition_routes'] }, languageCode: 'pt-br' });
            }

        } catch (error) {
            console.error(error);
        }
        return 'pages';
    }

    async updateFlow(projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = 'en') {
        try {

            const flowClient = new FlowsClient({
                apiEndpoint: process.env.AGENT_ENDPOINT
            });
            const flowPath = flowClient.flowPath(projectId, process.env.AGENT_LOCATION, agentId, process.env.AGENT_FLOW_ID);
            const [flow] = await flowClient.getFlow({ name: flowPath });
            flow.eventHandlers = await Promise.all(await flow.eventHandlers?.filter(e => e.triggerFulfillment?.messages?.length > 0).map(async (e) => {
                const fulfillment = e.triggerFulfillment;
                const msgs = await Promise.all(await fulfillment.messages?.map(async m => ({ ...m, text: { text: JSON.parse(await translateTrainingPhrases(JSON.stringify(m.text.text))) } })));
                e.triggerFulfillment.messages = msgs;
                return e;
            }));
            const [result] = await flowClient.updateFlow({ flow, updateMask: { paths: ['event_handlers'] }, languageCode: 'pt-br' });
            await waitFor(1000);
        } catch (error) {
            console.log(error);
        }
        return 'flow';
    }

    async updateIntent(projectId = process.env.AGENT_PROJECT, agentId = process.env.AGENT_ID, languageCode = 'en') {
        try {
            const intentsClients = new IntentsClient({
                apiEndpoint: process.env.AGENT_ENDPOINT,
            });
            const ptBr = JSON.parse(await readFile('ptbr.json', { encoding: 'utf8' }));
            const intentList = Object.keys(ptBr);
            const parent = intentsClients.agentPath(projectId, process.env.AGENT_LOCATION, agentId);
            const [intents] = await intentsClients.listIntents({ parent });
            for (let i = 0; i < intentList.length; i++) {
                const intentPath = intentList[i];
                const intent = intents.find(i => i.name === intentPath);
                const repeatCount = 1;
                try {
                    const parts = JSON.parse(ptBr[intentPath])?.map(t => ({ parts: [{ text: t }], repeatCount }));
                    intent.trainingPhrases = parts;
                    const updateIntentRequest = {
                        intent: intent,
                        updateMask: {
                            paths: ['training_phrases'],
                        },
                        languageCode: 'pt-br',
                    };
                    const result = await intentsClients.updateIntent(updateIntentRequest);
                    await waitFor(1000);
                } catch (e) {
                    console.log({ intentPath, e });
                }
            }

            return 'done';
        } catch (e) {
            console.log(e);
        }
        // const intent = await intentsClients.getIntent({name: intentPath});
    }
}

