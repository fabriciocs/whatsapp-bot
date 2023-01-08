
export const keyReplacer = (key = "") => key.replace(/[\.\#\$\/\]\[]/g, '_');
export const baseName = 'bot-4customers';
export const commandMarkers = ['🤖 ', '@ ', 'elon ', 'robo ', 'bee ', 'bee-bot ', '-- ', '.. ', '*IA* ', '*bimbim* ', 'bimbim ', 'chico '];
export type ChatConfigType = {
    commands: string[];
    isAutomatic: boolean;
    commandMarkers: string[];
    isUnique: () => boolean;
};

export const tryIt = async (fn: (parameters: any) => Promise<any>, ...args: any[]) => {
    try {
        return await fn(args);
    } catch (error) {
        console.log(error);
    }
}
export const prepareText = (text: string) => text?.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ').replace(/ +(?= )/g, '').trim();