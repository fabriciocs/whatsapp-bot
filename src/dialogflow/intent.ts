
const projectId = 'my-project';
const location = 'global';
const agentId = 'my-agent';
const audioFileName = '/path/to/audio.raw';
const encoding = 'AUDIO_ENCODING_LINEAR_16';
const sampleRateHertz = 16000;
const languageCode = 'en'
const {SessionsClient} = require('@google-cloud/dialogflow-cx');
const client = new SessionsClient();

const fs = require('fs');
const util = require('util');
const {v4} = require('uuid');

async function detectIntentAudio() {
  const sessionId = v4();
  const sessionPath = client.projectLocationAgentSessionPath(
    projectId,
    location,
    agentId,
    sessionId
  );
  const readFile = util.promisify(fs.readFile);
  const inputAudio = await readFile(audioFileName);

  const request = {
    session: sessionPath,
    queryInput: {
      audio: {
        config: {
          audioEncoding: encoding,
          sampleRateHertz: sampleRateHertz,
        },
        audio: inputAudio,
      },
      languageCode,
    },
  };
  const [response] = await client.detectIntent(request);
  console.log(`User Query: ${response.queryResult.transcript}`);
  for (const message of response.queryResult.responseMessages) {
    if (message.text) {
      console.log(`Agent Response: ${message.text.text}`);
    }
  }
  if (response.queryResult.match.intent) {
    console.log(
      `Matched Intent: ${response.queryResult.match.intent.displayName}`
    );
  }
  console.log(
    `Current Page: ${response.queryResult.currentPage.displayName}`
  );
}

detectIntentAudio();
