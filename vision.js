const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

const whatIsIt = async (data) => await client.labelDetection(data);
const readIt = async (document) => await client.documentTextDetection(document);
module.exports = { whatIsIt, readIt };