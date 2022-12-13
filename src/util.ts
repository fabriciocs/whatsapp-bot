
export const keyReplacer = (key = "") => key.replace(/[\.\#\$\/\]\[]/g, '_');
export const baseName = 'bot-4customers';
export const commandMarkers = ['🤖 ', '@ ', 'elon ', 'robo ', 'bee ', 'bee-bot '];
export type ChatConfigType = {
    commands: string[];
    isAutomatic: boolean;
    commandMarkers: string[];
    isUnique: () => boolean;
};