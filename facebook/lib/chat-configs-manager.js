"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
class ChatConfigsManager {
    constructor(chatConfigsRef) {
        this.chatConfigsRef = chatConfigsRef;
    }
    getChildRef(from) {
        const key = (0, util_1.keyReplacer)(from);
        return this.chatConfigsRef.child(key);
    }
    async getByKey(from) {
        if (!from)
            return;
        const snapshot = await this.getChildRef(from).get();
        if (!snapshot.exists())
            return;
        const config = snapshot.val();
        if (!config)
            return;
        const isUnique = () => config.commands.length === 1;
        config.isUnique = isUnique;
        return config;
    }
    async getBySessionOrNumber(id, from) {
        if (!from && !id)
            return;
        let config = await this.getByKey(id);
        if (!config) {
            return await this.getByKey(from);
        }
        return config;
    }
    async saveConfig(from, commands, isAutomatic = false, cmdMarkers = util_1.commandMarkers, prefix = '') {
        if (!from)
            return;
        await this.getChildRef(from).set({ commands, isAutomatic, commandMarkers: cmdMarkers, prefix });
    }
    async deleteConfig(from) {
        if (!from)
            return;
        await this.getChildRef(from).remove();
    }
}
exports.default = ChatConfigsManager;
//# sourceMappingURL=chat-configs-manager.js.map