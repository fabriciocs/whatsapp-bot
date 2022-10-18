const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

const whatIsIt = async (data) => await client.labelDetection(data);
const readDocument = async (document) => await client.documentTextDetection(document);
const readText = async (document) => await client.textDetection(document);
module.exports = { whatIsIt, readIt: readDocument };