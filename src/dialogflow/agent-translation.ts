
import { AgentsClient, protos } from '@google-cloud/dialogflow-cx';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { resolve, dirname } from 'path';
import { createTrainingPhrases } from '../ai';
import GoogleTranslate from '../translate/translate';

export default class AgentTranslation {
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
    
    async intentsAsList() {
        const intentsFolder = resolve(this.basePath, this.agentFolderName, 'intents');
        const files = await this.walk(intentsFolder);
        let list = [];
        let translatedList = [];
        for (const file of files) {
            const fileTexts = await this.getTrainingPhrasesFromFile(file);
            list = list.concat(fileTexts);
            translatedList = translatedList.concat(await new GoogleTranslate().translateText(fileTexts));
        }
        return [list, translatedList, files];
    }


    
    async entitiesAsList() {
        const intentsFolder = resolve(this.basePath, this.agentFolderName, 'entityTypes');
        const files = await this.walk(intentsFolder);
        let list = [];
        let translatedList = [];
        for (const file of files) {
            const fileTexts = await this.getEntitiesSynonyms(file);
            list = list.concat(fileTexts);
            translatedList = translatedList.concat(await new GoogleTranslate().translateText(fileTexts));
        }
        return [list, translatedList, files];
    }

    async flowsAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows');
        const files = await this.walk(flowsFolder, 'Flow.json');
        let list = [];
        let eventList = [];
        let translatedList = [];
        let translatedEventList = [];
        for (const file of files) {
            const fileTexts = await this.getTriggerFulfillment(file);
            const fileEventTexts = await this.getEventsTriggerFulfillment(file);
            list = list.concat(fileTexts);
            eventList = eventList.concat(fileEventTexts);
            if (fileTexts.length > 0) {
                translatedList = translatedList.concat(await new GoogleTranslate().translateText(fileTexts));
            }
            if (fileEventTexts.length > 0) {
                translatedEventList = translatedEventList.concat(await new GoogleTranslate().translateText(fileEventTexts));
            }
        }
        return [list, translatedList, files, eventList, translatedEventList];
    }
    async testCasesAsList() {
        const testCasesFolder = resolve(this.basePath, this.agentFolderName, 'testCases');
        const files = await this.walk(testCasesFolder, '.json');
        let list = [];
        let responsesList = [];
        let translatedList = [];
        let translatedResponesList = [];

        for (const file of files) {
            const test = await this.getTestFromFile(file);
            const [texts, responses] = await this.getTexts(test);


            if (texts?.length > 0) {
                list = list.concat(texts);
                translatedList = translatedList.concat(await new GoogleTranslate().translateText(texts));
            }
            if (responses?.length > 0) {
                responsesList = responsesList.concat(responses);
                translatedResponesList = translatedResponesList.concat(await new GoogleTranslate().translateText(responses));
            }
        }
        return [list, translatedList, files, responsesList, translatedResponesList];

    }

    async getTexts(test: protos.google.cloud.dialogflow.cx.v3.ITestCase) {
        const list = test.testCaseConversationTurns?.reduce(([texts, responses], { userInput, virtualAgentOutput }) => {
            const inputText = userInput?.input?.text?.text;
            if (inputText) {
                texts.push(inputText);
            }
            virtualAgentOutput?.textResponses?.forEach(({ text }) => {
                if (text?.length > 0) {
                    responses.push(...text);
                };
            });
            return [texts, responses];
        }, [[], []] as string[][]);
        return list;
    }

    async getTestFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const test = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.ITestCase;
        return test;
    }
    async pagesAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows/Default Start Flow/pages');
        const files = await this.walk(flowsFolder, '.json');
        let entryList = [];
        let eventList = [];
        let formList = [];
        let formRepromptList = [];
        let transitionList = [];

        let translatedEntryList = [];
        let translatedEventList = [];
        let translatedFormList = [];
        let translatedFormRepromptList = [];
        let translatedTransitionList = [];

        for (const file of files) {
            const page = await this.getPageFromFile(file);
            const fileEntryTexts = (await this.getPageEntryTriggerFulfillment(page))?.filter(Boolean);
            const fileEventTexts = (await this.getPageEventsTriggerFulfillment(page))?.filter(Boolean);
            const fileFormTexts = (await this.getPageFormTriggerFulfillment(page))?.filter(Boolean);
            const fileFormRepromptTexts = (await this.getPageFormRepromptTriggerFulfillment(page))?.filter(Boolean);
            const fileTransitionTexts = (await this.getPageTransitionTriggerFulfillment(page))?.filter(Boolean);


            if (fileEntryTexts?.length > 0) {
                entryList = entryList.concat(fileEntryTexts);
                translatedEntryList = translatedEntryList.concat(await new GoogleTranslate().translateText(fileEntryTexts));
            }
            if (fileEventTexts?.length > 0) {
                eventList = eventList.concat(fileEventTexts);
                translatedEventList = translatedEventList.concat(await new GoogleTranslate().translateText(fileEventTexts));
            }
            if (fileFormTexts?.length > 0) {
                formList = formList.concat(fileFormTexts);
                translatedFormList = translatedFormList.concat(await new GoogleTranslate().translateText(fileFormTexts));
            }
            if (fileFormRepromptTexts?.length > 0) {
                formRepromptList = formRepromptList.concat(fileFormRepromptTexts);
                translatedFormRepromptList = translatedFormRepromptList.concat(await new GoogleTranslate().translateText(fileFormRepromptTexts));
            }
            if (fileTransitionTexts?.length > 0) {
                transitionList = transitionList.concat(fileTransitionTexts);
                translatedTransitionList = translatedTransitionList.concat(await new GoogleTranslate().translateText(fileTransitionTexts));
            }
        }
        return [entryList, translatedEntryList, files, eventList, translatedEventList, formList, translatedFormList, transitionList, translatedTransitionList, formRepromptList, translatedFormRepromptList];
    }
    async transitionRouteGroupsAsList() {
        const flowsFolder = resolve(this.basePath, this.agentFolderName, 'flows/Default Start Flow/transitionRouteGroups');
        const files = await this.walk(flowsFolder, '.json');

        let transitionList = [];


        let translatedTransitionList = [];

        for (const file of files) {
            const transitionRouteGroups = await this.getTransitionRouteGroupsFromFile(file);

            const fileTransitionTexts = (await this.getTransitionRouteGroupsFulfillment(transitionRouteGroups))?.filter(Boolean);

            if (fileTransitionTexts?.length > 0) {
                transitionList = transitionList.concat(fileTransitionTexts);
                translatedTransitionList = translatedTransitionList.concat(await new GoogleTranslate().translateText(fileTransitionTexts));
            }
        }
        return [transitionList, translatedTransitionList, files];
    }
    async getTrainingPhrasesFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const intent = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IIntent;
        const list = intent.trainingPhrases.reduce((acc, { parts }) => {
            return acc.concat(parts?.map(({ text }) => text));
        }, [] as string[]);
        return list;
    }

    
    async getEntitiesSynonyms (filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const entityType = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IEntityType;
        const list = entityType.entities.reduce((acc, { synonyms }) => acc.concat(synonyms), [] as string[]);
        return list;
    }


    async getTriggerFulfillment(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const flow = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IFlow;
        const list = flow.transitionRoutes?.reduce((acc, { triggerFulfillment }) => {
            triggerFulfillment?.messages?.forEach(({ text }) => acc.push(...text?.text));
            return acc;
        }, [] as string[]);
        return list;
    }

    async getPageTransitionTriggerFulfillment(page: protos.google.cloud.dialogflow.cx.v3.IPage) {
        const list = page.transitionRoutes?.reduce((acc, { triggerFulfillment }) => {
            triggerFulfillment?.messages?.forEach(({ text }) => {
                if (text?.text?.length) {
                    acc.push(...text?.text);
                }
            });
            return acc;
        }, [] as string[]);
        return list;
    }

    async getTransitionRouteGroupsFulfillment(transitionRouteGroup: protos.google.cloud.dialogflow.cx.v3.ITransitionRouteGroup) {
        const list = transitionRouteGroup.transitionRoutes?.reduce((acc, { triggerFulfillment }) => {
            triggerFulfillment?.messages?.forEach(({ text }) => {
                if (text?.text?.length) {
                    acc.push(...text?.text);
                }
            });
            return acc;
        }, [] as string[]);
        return list;
    }

    async getPageEventsTriggerFulfillment(page: protos.google.cloud.dialogflow.cx.v3.IPage) {
        const list = page.eventHandlers?.reduce((acc, { triggerFulfillment }) => {
            triggerFulfillment?.messages?.forEach(({ text }) => {
                if (text?.text?.length) {
                    acc.push(...text?.text);
                }
            });
            return acc;
        }, [] as string[]);
        return list;
    }

    async getPageEntryTriggerFulfillment(page: protos.google.cloud.dialogflow.cx.v3.IPage) {
        const list = page.entryFulfillment?.messages?.reduce((acc, { text }) => {
            if (text?.text?.length) {
                acc.push(...text?.text);
            }
            return acc;
        }, [] as string[]);
        return list;
    }

    private async getPageFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const page = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IPage;
        return page;
    }
    private async getTransitionRouteGroupsFromFile(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const page = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.ITransitionRouteGroup;
        return page;
    }

    async getPageFormTriggerFulfillment(page: protos.google.cloud.dialogflow.cx.v3.IPage) {
        const list = page.form?.parameters?.map(p => p.fillBehavior?.initialPromptFulfillment?.messages?.reduce((acc, { text }) => {
            if (text?.text?.length) {
                acc.push(...text?.text);
            }
            return acc;
        }, [] as string[]));
        return list?.reduce((acc, texts) => {
            if (texts?.length) {
                acc.push(...texts);
            }
            return acc;
        }, [] as string[]);
    }


    async getPageFormRepromptTriggerFulfillment(page: protos.google.cloud.dialogflow.cx.v3.IPage) {
        const list = page.form?.parameters?.map(p => p.fillBehavior?.repromptEventHandlers?.reduce((acc, { triggerFulfillment }) => {
            triggerFulfillment?.messages?.forEach(({ text }) => {
                if (text?.text?.length) {
                    acc.push(...text?.text);
                }
            });
            return acc;
        }, [] as string[]));
        return list?.reduce((acc, texts) => {
            if (texts?.length) {
                acc.push(...texts);
            }
            return acc;
        }, [] as string[]);

    }


    async getEventsTriggerFulfillment(filePath: string) {
        const jsonContent = await readFile(filePath, 'utf-8');
        const flow = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IFlow;
        const list = flow.eventHandlers?.reduce((acc, { triggerFulfillment }) => {
            triggerFulfillment?.messages?.forEach(({ text }) => acc.push(...text.text));
            return acc;
        }, [] as string[]);
        return list;
    }

    async translateAgent() {
        await this.translateIntents();
        await this.translateFlows();
        await this.translatePages();
        await this.translateEntities();
        await this.translateTestCases();
        await this.translateTransitionRouteGroup();

    }


    async translateEntities() {
        const [list, translated, files] = await this.entitiesAsList();
        let idx = 0;
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const entityType = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IEntityType;
            for (let i = 0; i < entityType.entities?.length; i++) {
                const parts = entityType.entities[i]?.synonyms;
                entityType.entities[i]['languageCode'] = 'pt-br';
                for (let j = 0; j < parts?.length; j++) {
                    const text = translated[idx];
                    if (text) {
                        parts[j] = text;
                        idx++;
                    }
                }
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${dirname(filePath)}/pt-br.json`, JSON.stringify(entityType, null, 2));
        }
    }

    async translateIntents() {
        const [originalList, originalTranslatedList, originalFiles] = await this.intentsAsList();
        let idx = 0;
        for (let fileIndex = 0; fileIndex < originalFiles.length; fileIndex++) {
            const filePath = originalFiles[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const intent = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IIntent;
            for (let i = 0; i < intent.trainingPhrases?.length; i++) {
                const parts = intent.trainingPhrases[i]?.parts;
                intent.trainingPhrases[i]['languageCode'] = 'pt-br';
                for (let j = 0; j < parts?.length; j++) {
                    const text = originalTranslatedList[idx];
                    if (text) {
                        parts[j].text = text;
                        idx++;
                    }
                }
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${dirname(filePath)}/pt-br.json`, JSON.stringify(intent, null, 2));
        }
    }
    async translateFlows() {
        const [list, translatedList, files, eventList, translatedEventList] = await this.flowsAsList();
        const idx = { translated: 0, event: 0 };
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const flow = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IFlow;
            for (let i = 0; i < flow.transitionRoutes.length; i++) {
                const triggerFulfillment = flow.transitionRoutes[i].triggerFulfillment;
                const size = triggerFulfillment?.messages?.length;
                for (let j = 0; j < size; j++) {
                    const message = JSON.parse(JSON.stringify(triggerFulfillment.messages[j]));
                    message['languageCode'] = 'pt-br';
                    for (let t = 0; t < message.text.text.length; t++) {
                        message.text.text[t] = translatedList[idx.translated];
                        idx.translated++;
                    }
                    triggerFulfillment?.messages.push(message);
                }
            }
            for (let i = 0; i < flow.eventHandlers.length; i++) {
                const triggerFulfillment = flow.eventHandlers[i].triggerFulfillment;
                const size = triggerFulfillment?.messages?.length;
                for (let j = 0; j < size; j++) {
                    const message = JSON.parse(JSON.stringify(triggerFulfillment.messages[j]));
                    message['languageCode'] = 'pt-br';
                    for (let t = 0; t < message.text.text.length; t++) {
                        message.text.text[t] = translatedEventList[idx.event];
                        idx.event++;
                    }
                    triggerFulfillment?.messages.push(message);
                }
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(flow, null, 2));
        }
    }
    async translateTestCases() {
        const [list, translatedList, files, responsesList, translatedResponesList] = await this.testCasesAsList();
        const idx = { t: 0, responses: 0 };
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const testCase = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.ITestCase;
            const size = testCase.testCaseConversationTurns.length;
            for (let i = 0; i < size; i++) {
                const conversationTurn = JSON.parse(JSON.stringify(testCase.testCaseConversationTurns[i])) as protos.google.cloud.dialogflow.cx.v3.IConversationTurn;
                conversationTurn.userInput.input['languageCode'] = 'pt-br';
                if (conversationTurn?.userInput?.input?.text?.text) {
                    conversationTurn.userInput.input.text = { text: translatedList[idx.t] };
                    idx.t++;
                }
                const responsesSize = conversationTurn.virtualAgentOutput?.textResponses?.length;
                for (let j = 0; j < responsesSize; j++) {
                    const response = conversationTurn.virtualAgentOutput.textResponses[j];
                    response.text = response.text.reduce((acc, text) => {
                        acc.push(translatedResponesList[idx.responses]);
                        idx.responses++;
                        return acc;
                    }, [] as string[]);
                }
                testCase.testCaseConversationTurns.push(conversationTurn);
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(testCase, null, 2));
        }
    }

    async translatePages() {
        const [entryList, translatedEntryList, files, eventList, translatedEventList, formList, translatedFormList, transitionList, translatedTransitionList, formRepromptList, translatedFormRepromptList] = await this.pagesAsList();
        const idx = { entry: 0, event: 0, form: 0, transition: 0, reprompt: 0 };
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const page = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.IPage;
            for (let i = 0; i < page.transitionRoutes.length; i++) {
                const triggerFulfillment = page.transitionRoutes[i].triggerFulfillment;
                const size = triggerFulfillment?.messages?.length;
                for (let j = 0; j < size; j++) {
                    const message = JSON.parse(JSON.stringify(triggerFulfillment.messages[j]));
                    message['languageCode'] = 'pt-br';
                    for (let t = 0; t < message.text?.text?.length; t++) {
                        message.text.text[t] = translatedTransitionList[idx.transition];
                        idx.transition++;
                    }
                    triggerFulfillment?.messages.push(message);
                }
            }
            const params = page.form?.parameters;
            for (let i = 0; i < params?.length; i++) {
                const initialFulfillment = params[i]?.fillBehavior?.initialPromptFulfillment;
                const size = initialFulfillment?.messages?.length;
                for (let j = 0; j < size; j++) {
                    const message = JSON.parse(JSON.stringify(initialFulfillment?.messages[j]));
                    message['languageCode'] = 'pt-br';
                    for (let t = 0; t < message.text?.text?.length; t++) {
                        message.text.text[t] = translatedFormList[idx.form];
                        idx.form++;
                    }
                    initialFulfillment?.messages.push(message);
                }

                for (let k = 0; k < params[i].fillBehavior.repromptEventHandlers?.length; k++) {
                    const triggerFulfillment = params[i].fillBehavior.repromptEventHandlers[k]?.triggerFulfillment;
                    const size = triggerFulfillment?.messages?.length;
                    for (let j = 0; j < size; j++) {
                        const message = JSON.parse(JSON.stringify(triggerFulfillment?.messages[j]));
                        message['languageCode'] = 'pt-br';
                        for (let t = 0; t < message.text?.text?.length; t++) {
                            message.text.text[t] = translatedFormRepromptList[idx.reprompt];
                            idx.reprompt++;
                        }
                        triggerFulfillment?.messages.push(message);
                    }
                }

            }

            const entryFulfillment = page.entryFulfillment;
            const size = entryFulfillment?.messages?.length;
            for (let j = 0; j < size; j++) {
                const message = JSON.parse(JSON.stringify(entryFulfillment?.messages[j]));
                message['languageCode'] = 'pt-br';
                for (let t = 0; t < message?.text?.text?.length; t++) {
                    message.text.text[t] = translatedEntryList[idx.entry];
                    idx.entry++;
                }
                entryFulfillment?.messages.push(message);
            }

            for (let i = 0; i < page.eventHandlers?.length; i++) {
                const triggerFulfillment = page.eventHandlers[i]?.triggerFulfillment;
                const size = triggerFulfillment?.messages?.length;
                for (let j = 0; j < size; j++) {
                    const message = JSON.parse(JSON.stringify(triggerFulfillment?.messages[j]));
                    message['languageCode'] = 'pt-br';
                    for (let t = 0; t < message.text?.text?.length; t++) {
                        message.text.text[t] = translatedEventList[idx.event];
                        idx.event++;
                    }
                    triggerFulfillment?.messages.push(message);
                }
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(page, null, 2));
        }
    }
    async translateTransitionRouteGroup() {
        const [transitionList, translatedTransitionList, files] = await this.transitionRouteGroupsAsList();
        const idx = {  transition: 0 };
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
            const filePath = files[fileIndex];
            const jsonContent = await readFile(filePath, 'utf-8');
            const transitionRouteGroup = JSON.parse(jsonContent) as protos.google.cloud.dialogflow.cx.v3.ITransitionRouteGroup;
            for (let i = 0; i < transitionRouteGroup.transitionRoutes.length; i++) {
                const triggerFulfillment = transitionRouteGroup.transitionRoutes[i].triggerFulfillment;
                const size = triggerFulfillment?.messages?.length;
                for (let j = 0; j < size; j++) {
                    const message = JSON.parse(JSON.stringify(triggerFulfillment.messages[j]));
                    message['languageCode'] = 'pt-br';
                    for (let t = 0; t < message.text?.text?.length; t++) {
                        message.text.text[t] = translatedTransitionList[idx.transition];
                        idx.transition++;
                    }
                    triggerFulfillment?.messages.push(message);
                }
            }
            console.log(`Writing ${filePath}`);
            await writeFile(`${filePath}`, JSON.stringify(transitionRouteGroup, null, 2));
        }
    }



}