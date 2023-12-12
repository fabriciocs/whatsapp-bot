"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteAuth = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const archiver_1 = __importDefault(require("archiver"));
const fs_extra_1 = require("fs-extra");
const adm_zip_1 = __importDefault(require("adm-zip"));
const path_1 = require("path");
/**
 * Remote-based authentication
 * @param {object} options - options
 * @param {object} options.store - Remote database store instance
 * @param {string} options.clientId - Client id to distinguish instances if you are using multiple, otherwise keep null if you are using only one instance
 * @param {string} options.dataPath - Change the default path for saving session files, default is: "./.wwebjs_auth/"
 * @param {number} options.backupSyncIntervalMs - Sets the time interval for periodic session backups. Accepts values starting from 60000ms {1 minute}
 */
class RemoteAuth {
    constructor({ clientId, store, backupSyncIntervalMs, }) {
        this.userDataDir = '';
        const idRegex = /^[-_\w]+$/i;
        if (clientId && !idRegex.test(clientId)) {
            throw new Error('Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.');
        }
        if (!backupSyncIntervalMs || backupSyncIntervalMs < 60000) {
            throw new Error('Invalid backupSyncIntervalMs. Accepts values starting from 60000ms {1 minute}.');
        }
        if (!store)
            throw new Error('Remote database store is required.');
        this.store = store;
        this.clientId = clientId;
        this.backupSyncIntervalMs = backupSyncIntervalMs;
        this.dataPath = (0, path_1.resolve)('./.wwebjs_auth/');
        this.tempDir = `${this.dataPath}/wwebjs_temp_session-${clientId}`;
        this.requiredDirs = ['Default', 'IndexedDB', 'Local Storage'];
    }
    setup(client) {
        this.client = client;
    }
    async afterBrowserInitialized() { }
    async getAuthEventPayload() { }
    async onAuthenticationNeeded() {
        return {
            failed: false,
            restart: false,
            failureEventPayload: undefined,
        };
    }
    async beforeBrowserInitialized() {
        var _a, _b, _c;
        const puppeteerOpts = (_b = (_a = this.client) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.puppeteer;
        const sessionDirName = this.clientId
            ? `RemoteAuth-${this.clientId}`
            : 'RemoteAuth';
        const dirPath = (0, path_1.join)(this.dataPath, sessionDirName);
        if ((puppeteerOpts === null || puppeteerOpts === void 0 ? void 0 : puppeteerOpts.userDataDir) && (puppeteerOpts === null || puppeteerOpts === void 0 ? void 0 : puppeteerOpts.userDataDir) !== dirPath) {
            throw new Error('RemoteAuth is not compatible with a user-supplied userDataDir.');
        }
        this.userDataDir = dirPath;
        this.sessionName = sessionDirName;
        await this.extractRemoteSession();
        if ((_c = this.client) === null || _c === void 0 ? void 0 : _c.options) {
            this.client.options.puppeteer = Object.assign(Object.assign({}, puppeteerOpts), { userDataDir: dirPath });
        }
    }
    async logout() {
        await this.disconnect();
    }
    async destroy() {
        clearInterval(this.backupSync);
    }
    async disconnect() {
        await this.deleteRemoteSession();
        const pathExists = await this.isValidPath(this.userDataDir || '');
        if (pathExists) {
            await fs_extra_1.promises
                .rm(this.userDataDir || '', {
                recursive: true,
                force: true,
            })
                .catch(() => { });
        }
        clearInterval(this.backupSync);
    }
    async afterAuthReady() {
        try {
            const sessionExists = await this.store.sessionExists({
                session: this.sessionName,
            });
            if (!sessionExists) {
                await this.delay(60000); /* Initial delay sync required for session to be stable enough to recover */
                await this.storeRemoteSession({ emit: true });
            }
            this.backupSync = setInterval(async () => {
                await this.storeRemoteSession({ emit: true });
            }, this.backupSyncIntervalMs);
        }
        catch (e) {
            console.error('afterAuthReady', {
                message: 'afterAuthReady error',
                json_payload: e
            });
        }
    }
    async storeRemoteSession(options) {
        var _a;
        /* Compress & Store Session */
        const pathExists = await this.isValidPath(this.userDataDir || '');
        if (pathExists) {
            await this.compressSession();
            await this.store.save({ session: this.sessionName });
            await fs_extra_1.promises.unlink(`${this.sessionName}.zip`);
            await fs_extra_1.promises
                .rm(`${this.tempDir}`, {
                recursive: true,
                force: true,
            })
                .catch(() => { });
            if (options && options.emit)
                (_a = this.client) === null || _a === void 0 ? void 0 : _a.emit(whatsapp_web_js_1.Events.REMOTE_SESSION_SAVED);
        }
    }
    async extractRemoteSession() {
        try {
            const pathExists = await this.isValidPath(this.userDataDir || '');
            const compressedSessionPath = `${this.sessionName}.zip`;
            const sessionExists = await this.store.sessionExists({
                session: this.sessionName,
            });
            if (pathExists) {
                await fs_extra_1.promises.rm(this.userDataDir, {
                    recursive: true,
                    force: true,
                });
            }
            if (sessionExists) {
                await this.store.extract({
                    session: this.sessionName,
                    path: compressedSessionPath,
                });
                await this.unCompressSession(compressedSessionPath);
            }
            else {
                (0, fs_extra_1.mkdirSync)(this.userDataDir, { recursive: true });
            }
        }
        catch (e) {
            console.error('extractRemoteSession', {
                message: 'extractRemoteSession error',
                json_payload: e
            });
        }
    }
    async deleteRemoteSession() {
        const sessionExists = await this.store.sessionExists({
            session: this.sessionName,
        });
        if (sessionExists)
            await this.store.delete({ session: this.sessionName });
    }
    async compressSession() {
        const archive = (0, archiver_1.default)('zip');
        const stream = (0, fs_extra_1.createWriteStream)(`${this.sessionName}.zip`);
        await (0, fs_extra_1.copy)(this.userDataDir, this.tempDir).catch(() => { });
        await this.deleteMetadata();
        return new Promise((resolve, reject) => {
            archive
                .directory(this.tempDir, false)
                .on('error', (err) => reject(err))
                .pipe(stream);
            stream.on('close', () => resolve());
            archive.finalize();
        });
    }
    async unCompressSession(compressedSessionPath) {
        await new Promise((resolve, reject) => {
            const zip = new adm_zip_1.default(compressedSessionPath);
            zip.extractAllToAsync(this.userDataDir, true, false, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
        await fs_extra_1.promises.unlink(compressedSessionPath);
    }
    async deleteMetadata() {
        const sessionDirs = [this.tempDir, (0, path_1.join)(this.tempDir, 'Default')];
        for (const dir of sessionDirs) {
            const sessionFiles = await fs_extra_1.promises.readdir(dir);
            for (const element of sessionFiles) {
                if (!this.requiredDirs.includes(element)) {
                    const dirElement = (0, path_1.join)(dir, element);
                    const stats = await fs_extra_1.promises.lstat(dirElement);
                    if (stats.isDirectory()) {
                        await fs_extra_1.promises
                            .rm(dirElement, {
                            recursive: true,
                            force: true,
                        })
                            .catch(() => { });
                    }
                    else {
                        await fs_extra_1.promises.unlink(dirElement).catch(() => { });
                    }
                }
            }
        }
    }
    async isValidPath(path) {
        try {
            await fs_extra_1.promises.access(path);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.RemoteAuth = RemoteAuth;
//# sourceMappingURL=remote-auth.js.map