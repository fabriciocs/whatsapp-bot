"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumArrayItem = exports.prepareText = exports.tryIt = exports.waitFor = exports.chunked = exports.commandMarkers = exports.botname = exports.baseName = exports.keyReplacer = void 0;
const keyReplacer = (key = "") => key.replace(/[\.\#\$\/\]\[]/g, '_');
exports.keyReplacer = keyReplacer;
exports.baseName = 'bot-4customers';
exports.botname = '*Fourzinho*';
exports.commandMarkers = ['🤖 ', '@ ', 'elon ', 'robo ', 'bee ', 'bee-bot ', '-- ', '.. ', 'IA ', '*IA* ', '*bimbim* ', 'bimbim ', 'chico '];
const chunked = (arr, size) => {
    const chunked_arr = [];
    let index = 0;
    while (index < arr.length) {
        chunked_arr.push(...arr.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
};
exports.chunked = chunked;
const waitFor = async (timeout = 1000) => await new Promise(resolve => setTimeout(resolve, timeout));
exports.waitFor = waitFor;
const tryIt = async (fn, ...args) => {
    try {
        return await fn(args);
    }
    catch (error) {
        console.log(error);
    }
};
exports.tryIt = tryIt;
const prepareText = (text) => text === null || text === void 0 ? void 0 : text.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ').replace(/ +(?= )/g, '').trim();
exports.prepareText = prepareText;
const sumArrayItem = (from, to) => {
    const size = Math.max(from.length, to.length);
    const result = [];
    for (let i = 0; i < size; i++) {
        result.push((from[i] || 0) + (to[i] || 0));
    }
    return result;
};
exports.sumArrayItem = sumArrayItem;
//# sourceMappingURL=util.js.map