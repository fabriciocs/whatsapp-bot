"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpSend = void 0;
const axios_1 = require("axios");
const functions = require("firebase-functions");
const secrets_1 = require("./secrets");
const httpSend = async (toNumber, toName, msg) => {
    var _a;
    const data = Object.assign(Object.assign({}, msg), { to: toNumber });
    const url = process.env.FACEBOOK_MESSAGES_URL;
    const token = (0, secrets_1.loadSecrets)(process.env.INTEGRATION).facebook.accessToken;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    try {
        functions.logger.debug('httpSend', { url, data, headers });
        await axios_1.default.post(url, data, { headers });
    }
    catch (e) {
        if (axios_1.default.isAxiosError(e)) {
            functions.logger.error((_a = e.response) === null || _a === void 0 ? void 0 : _a.data);
        }
        else {
            functions.logger.error(e);
        }
        functions.logger.error(data);
    }
};
exports.httpSend = httpSend;
//# sourceMappingURL=httpSend.js.map