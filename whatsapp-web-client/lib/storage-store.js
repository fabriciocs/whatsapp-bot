"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
class StorageStore {
    constructor(storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
        this.storage = storage;
    }
    async sessionExists(params) {
        const { session } = params;
        const [exists] = await this.storage.file(`${session}.zip`).exists();
        return exists;
    }
    async delete(params) {
        const { session } = params;
        const id = `${session}.zip`;
        const file = this.storage.file(id, { preconditionOpts: { ifGenerationMatch: 0 } });
        const [fileExists] = await file.exists();
        if (fileExists) {
            await file.delete();
        }
    }
    async save(params) {
        const { session } = params;
        const id = `${session}.zip`;
        await this.storage.upload(id, {
            destination: id,
            preconditionOpts: { ifGenerationMatch: 0 }
        });
        return id;
    }
    ;
    async extract(params) {
        try {
            const { session, path: s } = params;
            const file = this.storage.file(`${session}.zip`, { preconditionOpts: { ifGenerationMatch: 0 } });
            await file.download({
                destination: s
            });
        }
        catch (e) {
            console.error('extract', {
                message: 'extract error',
                json_payload: e
            });
        }
    }
    ;
}
exports.default = StorageStore;
//# sourceMappingURL=storage-store.js.map