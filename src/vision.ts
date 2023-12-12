import vision from '@google-cloud/vision';
const client = new vision.ImageAnnotatorClient();

const whatIsIt = async (data: Buffer) => await client.labelDetection(data);
const readDocument = async (document: Buffer) => await client.documentTextDetection(document);
export { whatIsIt, readDocument };