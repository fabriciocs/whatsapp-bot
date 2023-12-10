
import * as admin from 'firebase-admin';
import { Message } from 'whatsapp-web.js';
import MessagesManager from './messages-manager';
import { keyReplacer } from './util';
export default class MessageForwarder {

  constructor(private messagesManager: MessagesManager) {
  }

  
}