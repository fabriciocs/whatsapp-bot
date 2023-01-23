
export const keyReplacer = (key = "") => key.replace(/[\.\#\$\/\]\[]/g, '_');
export const baseName = 'bot-4customers';
export const botname = '*Fourzinho*';
export const commandMarkers = ['🤖 ', '@ ', 'elon ', 'robo ', 'bee ', 'bee-bot ', '-- ', '.. ', 'IA ','*IA* ', '*bimbim* ', 'bimbim ', 'chico '];
export type ChatConfigType = {
    commands: string[];
    isAutomatic: boolean;
    commandMarkers: string[];
    isUnique: () => boolean;
};
export const chunked = (arr: any[], size: number) => {
    const chunked_arr = [];
    let index = 0;
    while (index < arr.length) {
        chunked_arr.push(arr.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}
export const waitFor = async (timeout = 1000) => await new Promise(resolve => setTimeout(resolve, timeout));

export const tryIt = async (fn: (parameters: any) => Promise<any>, ...args: any[]) => {
    try {
        return await fn(args);
    } catch (error) {
        console.log(error);
    }
}
export const prepareText = (text: string) => text?.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ').replace(/ +(?= )/g, '').trim();