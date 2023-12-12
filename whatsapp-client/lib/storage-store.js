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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
class StorageStore {
    constructor(storage = admin.storage().bucket(process.env.BUCKET_SESSIONS_URL)) {
        this.storage = storage;
    }
    sessionExists(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = params;
            const [exists] = yield this.storage.file(`${session}.zip`).exists();
            return exists;
        });
    }
    delete(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = params;
            const id = `${session}.zip`;
            const file = this.storage.file(id, { preconditionOpts: { ifGenerationMatch: 0 } });
            const [fileExists] = yield file.exists();
            if (fileExists) {
                yield file.delete();
            }
        });
    }
    save(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { session } = params;
            const id = `${session}.zip`;
            yield this.storage.upload(id, {
                destination: id,
                preconditionOpts: { ifGenerationMatch: 0 }
            });
            return id;
        });
    }
    ;
    extract(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { session, path: s } = params;
                const file = this.storage.file(`${session}.zip`, { preconditionOpts: { ifGenerationMatch: 0 } });
                yield file.download({
                    destination: s
                });
            }
            catch (e) {
                console.error('extract', {
                    message: 'extract error',
                    json_payload: e
                });
            }
        });
    }
    ;
}
exports.default = StorageStore;
