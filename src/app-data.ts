
import { Log } from "@google-cloud/logging";

import * as readline from 'readline';



import * as admin from 'firebase-admin';
import { Client, Message } from 'whatsapp-web.js';
import ChatConfigsManager from './chat-configs-manager';
import CommandConfigsManager from './command-configs-manager';
import Commands from './commands';
import Contexts from './context';
import IoChannel from './io-channel';
import MessagesManager from './messages-manager';
import { Msg } from './msg/msg';
import SessionsManager from './sessions-manager';
import MediaManager from "./media-manager";
import WhatsappMessageAdapter from "./msg/whatsapp-message-adpater";

export class AppData {

    proccessReactions?: boolean;
    systemMessageDefault?: string;
    getAgent?: (msg: Msg) => Promise<string>;
    is?: (command: string, msg: Msg) => Promise<boolean>;
    processMessage?: (receivedMsg: Msg) => Promise<void>;
    actions?: Record<string, any>;
    actionsByEmoji?: Record<string, string[]>;
    consoleClient?: readline.Interface;
    ioChannel?: IoChannel;
    commands?: Commands;
    contexts?: Contexts;
    client?: Client;
    promptBase?: Record<string, string>;
    agentCommands?: Record<string, string>;
    agentExample?: Record<string, {
        input: string,
        output: string
    }>;
    conversations?: Record<string, Record<string, any[]>>;
    lockConversation?: Record<string, boolean>;
    messageControl?: Record<string, number>;
    groupControl?: Record<string, string>;


}

export class AppDataUtils {
    static bindAction(appData: AppData, action: string, func: any, ...emoji: string[]) {
        if (!appData.actions) appData.actions = {};
        appData.actions[action] = func;
        if (emoji?.length) {
            if (!appData.actionsByEmoji) {
                appData.actionsByEmoji = {};
            }
            if (!appData.actionsByEmoji[action]) {
                appData.actionsByEmoji[action] = []
            }
            appData.actionsByEmoji[action].push(...emoji);
        }


    }

}