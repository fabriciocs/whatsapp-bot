
export const keyReplacer = (key = "") => key.replace(/[\.\#\$\/\]\[]/g, '_');
export const baseName = 'rodoclube-datahub';
export const botname = '*Fourzinho*';


export const commandMarkers = ['🤖 ', '@ ', 'elon ', 'robo ', 'bee ', 'bee-bot ', '-- ', '.. ', 'IA ', '*IA* ', '*bimbim* ', 'bimbim ', 'chico '];
export type ChatConfigType = {
    commands: string[];
    isAutomatic: boolean;
    commandMarkers: string[];
    isUnique: () => boolean;
    prefix: string;
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

export const sumArrayItem = (from: number[], to: number[]) => {
    const size = Math.max(from.length, to.length);
    const result = [];
    for (let i = 0; i < size; i++) {
        result.push((from[i] || 0) + (to[i] || 0));
    }
    return result;
}
export const fetchData = async (url, authorization) => {
    const reqOptions = { headers: { accept: 'image/* video/* text/* audio/*', Authorization: authorization } };
    const response = await fetch(url, reqOptions);
    const mime = response.headers.get('Content-Type');
    const size = response.headers.get('Content-Length');

    const contentDisposition = response.headers.get('Content-Disposition');
    const name = contentDisposition ? contentDisposition.match(/((?<=filename=")(.*)(?="))/) : null;

    let data = '';

    const bArray = new Uint8Array(await response.arrayBuffer());
    bArray.forEach((b) => {
        data += String.fromCharCode(b);
    });
    data = btoa(data);


    return { data, mime, name, size };
}