
import { Log } from "@google-cloud/logging";

import * as readline from 'readline';



import * as admin from 'firebase-admin';
import { Client } from 'whatsapp-web.js';
import ChatConfigsManager from './chat-configs-manager';
import CommandConfigsManager from './command-configs-manager';
import Commands from './commands';
import Contexts from './context';
import IoChannel from './io-channel';
import MessagesManager from './messages-manager';
import { Msg } from './msg/msg';
import SessionsManager from './sessions-manager';

export class AppData {
    processMessage?: (receivedMsg: Msg) => Promise<void>;
    actions?: Record<string, any>;
    consoleClient?: readline.Interface;
    ioChannel?: IoChannel;
    commands?: Commands;
    contexts?: Contexts;
    msgs?: MessagesManager;
    sessionManager?: SessionsManager;
    chatConfigsManager?: ChatConfigsManager;
    commandConfigsManager?: CommandConfigsManager;
    logger?: Log;
    fullBaseName?: string;
    whatsappRef?: admin.database.Reference;
    client?: Client;
}