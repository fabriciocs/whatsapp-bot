
import { AgentsClient } from '@google-cloud/dialogflow-cx';
import { google } from '@google-cloud/dialogflow-cx/build/protos/protos';
import { readFile, writeFile, readdir, stat, unlink } from 'fs/promises';
import { resolve, dirname } from 'path';
import { createTrainingPhrases } from '../ai';
import GoogleTranslate from '../translate/translate';

export default class AgentTranslationRemove {
    constructor(
        private agentFolderName = 'travel_car_rental',
        private projectId = process.env.AGENT_PROJECT!,
        private agentId = process.env.AGENT_ID!,
        private agentLocation = process.env.AGENT_LOCATION!,
        private basePath = './src/dialogflow/agents-exported/',
    ) {
    }


    async getAgent() {
        const agentsClient = new AgentsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const agentName = agentsClient.agentPath(this.projectId, this.agentLocation, this.agentId);
        return await agentsClient.getAgent({ name: agentName });

    }

    private async walk(dir: string, endsWithFile = 'en.json') {
        let results: string[] = [];
        const list = await readdir(dir);
        for (const file of list) {
            const path = resolve(dir, file);
            const statFile = await stat(path);
            if (statFile && statFile.isDirectory()) {
                results = results.concat(await this.walk(path, endsWithFile));
            } else if (file.endsWith(endsWithFile)) {
                results.push(path);
            }
        }
        return results;
    }
    async removeEnIntentFiles() {
        const intentsFolder = resolve(this.basePath, this.agentFolderName, 'intents');
        const files = await this.walk(intentsFolder);
        let list = [];
        let translatedList = [];
        for (const file of files) {
            await unlink(file);
        }
    }

    async flowsAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows');
        const files = await this.walk(flowsFolder, 'Flow.json');
        return [files];
    }
    async testCasesAsList() {
        const testCasesFolder = resolve(this.basePath, this.agentFolderName, 'testCases');
        const files = await this.walk(testCasesFolder, '.json');
        return [files];

    }


    async getTestFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const test = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.ITestCase;
        return test;
    }
    async pagesAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows/Default Start Flow/pages');
        const files = await this.walk(flowsFolder, '.json');
        return [files];
    }
    async transitionRouteGroupsAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows/Default Start Flow/transitionRouteGroups');
        const files = await this.walk(flowsFolder, '.json');
        return [files];
    }

    async removeAgent() {
        await this.removeEnIntentFiles();
        await this.removeEnDataFromFlows();
        await this.removeEnFromPages();
        await this.removeEnConversationsFromTestCases();
        await this.removeEnFromTransitionRouteGroups();
    }

    async removeEnDataFromFlows() {
        const [files] = await this.flowsAsList();

        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const flow = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.IFlow;
            for (let i = 0; i < flow.transitionRoutes.length; i++) {
                const triggerFulfillment = flow.transitionRoutes[i].triggerFulfillment;
                triggerFulfillment.messages = triggerFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
            }
            for (let i = 0; i < flow.eventHandlers.length; i++) {
                const triggerFulfillment = flow.eventHandlers[i].triggerFulfillment;
                triggerFulfillment.messages = triggerFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(flow, null, 2));
        }
    }
    async removeEnConversationsFromTestCases() {
        const [files] = await this.testCasesAsList();
        const idx = { t: 0, responses: 0 };
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const testCase = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.ITestCase;
            testCase.testCaseConversationTurns = testCase.testCaseConversationTurns.filter(t => t.userInput.input['languageCode'] !== 'en' && t.virtualAgentOutput.textResponses[0]['languageCode'] !== 'en');
            
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(testCase, null, 2));
        }
    }

    async removeEnFromPages() {
        const [files] = await this.pagesAsList();
        const idx = { entry: 0, event: 0, form: 0, transition: 0, reprompt: 0 };
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const page = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.IPage;
            for (let i = 0; i < page.transitionRoutes.length; i++) {
                const triggerFulfillment = page.transitionRoutes[i].triggerFulfillment;
                triggerFulfillment.messages = triggerFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
               
            }
            const params = page.form?.parameters;
            for (let i = 0; i < params?.length; i++) {
                const initialFulfillment = params[i]?.fillBehavior?.initialPromptFulfillment;
                initialFulfillment.messages = initialFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
               

                for (let k = 0; k < params[i].fillBehavior.repromptEventHandlers?.length; k++) {
                    const triggerFulfillment = params[i].fillBehavior.repromptEventHandlers[k]?.triggerFulfillment;
                    triggerFulfillment.messages = triggerFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
                }

            }

            const entryFulfillment = page.entryFulfillment;
            entryFulfillment.messages = entryFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
            

            for (let i = 0; i < page.eventHandlers?.length; i++) {
                const triggerFulfillment = page.eventHandlers[i]?.triggerFulfillment;
                triggerFulfillment.messages = triggerFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(page, null, 2));
        }
    }
    async removeEnFromTransitionRouteGroups() {
        const [files] = await this.transitionRouteGroupsAsList();
        const idx = { transition: 0 };
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const transitionRouteGroup = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.ITransitionRouteGroup;
            for (let i = 0; i < transitionRouteGroup.transitionRoutes.length; i++) {
                const triggerFulfillment = transitionRouteGroup.transitionRoutes[i].triggerFulfillment;
                triggerFulfillment.messages = triggerFulfillment?.messages?.filter(m => m['languageCode'] !== 'en');
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(transitionRouteGroup, null, 2));
        }
    }



}