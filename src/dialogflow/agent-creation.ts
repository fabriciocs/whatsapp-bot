
import { AgentsClient, EntityTypesClient, FlowsClient, IntentsClient, PagesClient, TestCasesClient, TransitionRouteGroupsClient } from '@google-cloud/dialogflow-cx';
import { google } from '@google-cloud/dialogflow-cx/build/protos/protos';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { resolve, dirname } from 'path';
import { createTrainingPhrases } from '../ai';
import GoogleTranslate from '../translate/translate';

export default class AgentCreation {
    private agentsClient: AgentsClient;
    private agentPath: string;
    private agent: google.cloud.dialogflow.cx.v3.IAgent;
    constructor(
        private agentFolderName = 'travel_car_rental',
        private projectId = process.env.AGENT_PROJECT!,
        private agentId = process.env.AGENT_ID!,
        private agentLocation = process.env.AGENT_LOCATION!,
        private basePath = './src/dialogflow/agents-exported/',
    ) {
        (async () => {
            this.agentsClient = new AgentsClient({
                apiEndpoint: process.env.AGENT_ENDPOINT,
            });
            this.agentPath = this.agentsClient.agentPath(this.projectId, this.agentLocation, this.agentId);
            const [agentResult] = await this.agentsClient.getAgent({ name: this.agentPath });
            this.agent = agentResult;
        })();
    }

    async createAgent() {
        const intents = await this.intentFilesAsList();
        const entities = await this.entityFilesAsList();
        const flows = await this.flowFilesAsList();
        const testCases = await this.testCaseFilesAsList();
        const parent = this.agentsClient.projectPath(this.projectId);
        const agent = await this.getAgentFromFile();
        const [createdAgent] = await this.agentsClient.createAgent({
            parent,
            agent
        });
        console.log(`Created agent ${createdAgent.name}`);
        this.agent = createdAgent;
    }

    async createFlows() {
        const flowsClient = new FlowsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const flows = await this.flowFilesAsList();
        for (const flowFile of flows) {
            const flow = await this.getFlowFromFile(flowFile);
            const [createdFlow] = await flowsClient.createFlow({
                parent: this.agentPath,
                flow
            });
            console.log(`Created flow ${createdFlow.name}`);
        }
    }

    async createIntents() {
        const intentsClient = new IntentsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const intents = await this.intentFilesAsList();
        for (const intentFile of intents) {
            const intent = await this.getIntentFromFile(intentFile);
            const [createdIntent] = await intentsClient.createIntent({
                parent: this.agentPath,
                intent
            });
            console.log(`Created intent ${createdIntent.name}`);
        }
    }


    async createPages() {
        const pages = await this.pageFilesAsList();
        const pagesClient = new PagesClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        for (const pageFile of pages) {
            const page = await this.getPageFromFile(pageFile);
            const [createdPage] = await pagesClient.createPage({
                parent: this.agentPath,
                page
            });
            console.log(`Created page ${createdPage.name}`);
        }
    }
    private async walk(dir: string, endsWithFile = '.json') {
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

    async intentFilesAsList() {
        const intentsFolder = resolve(this.basePath, this.agentFolderName, 'intents');
        return await this.walk(intentsFolder);
    }
    async entityFilesAsList() {
        const intentsFolder = resolve(this.basePath, this.agentFolderName, 'entityTypes');
        return await this.walk(intentsFolder);
    }
    async flowFilesAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows');
        return await this.walk(flowsFolder, 'Flow.json');
    }
    async testCaseFilesAsList() {
        const testCasesFolder = resolve(this.basePath, this.agentFolderName, 'testCases');
        return await this.walk(testCasesFolder);
    }
    async getTestFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const test = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.ITestCase;
        return test;
    }
    async pageFilesAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows/Default Start Flow/pages');
        return await this.walk(flowsFolder);
    }
    async transitionRouteGroupFilessAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows/Default Start Flow/transitionRouteGroups');
        return await this.walk(flowsFolder, '.json');
    }

    private async getAgentFromFile() {
        const filePath = resolve(this.basePath, this.agentFolderName, 'agent.json');
        const jsonContent = await readFile(filePath, 'utf-8');
        const page = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.IAgent;
        return page;
    }


    private async getPageFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const page = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.IPage;
        return page;
    }
    private async getTransitionRouteGroupsFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const page = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.ITransitionRouteGroup;
        return page;
    }


    async createEntities() {
        const entitiesClient = new EntityTypesClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const files = await this.entityFilesAsList();
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const entityType = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.IEntityType;
            const [createdEntityType] = await entitiesClient.createEntityType({
                parent: this.agentPath,
                entityType
            });
            console.log(`Created entity type ${createdEntityType.name}`);
        }
    }

    async createTransitionRouteGroups() {
        const transitionRouteGroupsClient = new TransitionRouteGroupsClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const files = await this.transitionRouteGroupFilessAsList();
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const transitionRouteGroup = await this.getTransitionRouteGroupsFromFile(filePath);
            const [createdTransitionRouteGroup] = await transitionRouteGroupsClient.createTransitionRouteGroup({
                parent: this.agentPath,
                transitionRouteGroup
            }); 
            console.log(`Created transition route group ${createdTransitionRouteGroup.name}`);
        }
    }

    async createTestCases() {
        const testCasesClient = new TestCasesClient({
            apiEndpoint: process.env.AGENT_ENDPOINT,
        });
        const files = await this.testCaseFilesAsList();
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const test = await this.getTestFromFile(filePath);
            const [createdTest] = await testCasesClient.createTestCase({
                parent: this.agentPath,
                testCase: test
            });
            console.log(`Created test case ${createdTest.name}`);
        }
    }

    async getFlowFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const flow = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.IFlow;
        return flow;
    }
    async getIntentFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const intent = JSON.parse(jsonContent) as google.cloud.dialogflow.cx.v3.IIntent;
        return intent;
    }
}