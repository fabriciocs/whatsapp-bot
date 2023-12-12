import dotenv from 'dotenv';
import express from 'express';
import { MessageMedia } from 'whatsapp-web.js';
import { Intent } from './dialogflow/intent';
import { readToMe } from './speech-to-text';
const processors = {
    text: async (message: any) => {
        const text = message.text.body;
        const intent = new Intent();
        const responses = await intent.getIntent({
            id: message.from,
            text: text
        });
        await Promise.all(responses.map(async (response) => {
            return await reply(message, response);
        }));
        // console.log(`Received message from ${message.from}: ${text}`);
        // const promptBase = `Atue como um doutor em pedagogia muito prestativo, analise o texto:'''${text}'''.  Sua missão é pensar em silêncio em uma jornada de aprendizado e responder com as etapas detalhadas para me ajudar a aprender sem me dar a resposta. Vamos pensar passo a passo!`;
        // const fixResp = await simpleChat(promptBase);
        // const responseText = `👨🏿‍🏫 *Ueg-conecta:* ${fixResp}`; // await simpleChat(promptBase);
        // await reply(message, responseText);
    },
    audio: async (message: any) => {
        const audio = message.audio;
        const base64Content = await getMedia(audio.id);
        const intent = new Intent();
        const responses = await intent.getIntent({
            isSound: true,
            id: message.from,
            text: base64Content
        });

        await Promise.all(responses.map(async (response) => {
            return await reply(message, response);
        }));
    }
}

const getMedia = async (media_id: string) => {
    try {

        const mediaInfo = await getMediaInfo(media_id);
        const url = mediaInfo.url;
        const token = process.env.CLOUD_API_ACCESS_TOKEN;

        const headers = {
            'Authorization': `Bearer ${token}`
        };
        const mMedia = await MessageMedia.fromUrl(url, { unsafeMime: true, reqOptions: { headers } });
        console.log({ mMedia });
        return mMedia.data;
    } catch (e) {
        console.error(e);
    }
}

const getMediaInfo = async (media_id: string) => {
    try {
        const url = `${process.env.FACEBOOK_BASE_URL}/${media_id}`;
        const token = process.env.CLOUD_API_ACCESS_TOKEN;

        const headers = {
            'Authorization': `Bearer ${token}`
        };
        const response = await fetch(url!, {
            method: 'GET',
            headers: headers
        });
        if (response.ok) {
            return await response.json();
        } else {
            console.error(await response.text());
        }
    } catch (e) {
        console.error(e);
    }
}
export const reply = async (message: any, text: string) => {
    const data = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": message.from,
        "context": {
            "message_id": message.id
        },
        "type": "text",
        "text": {
            "preview_url": false,
            "body": text
        }
    };

    try {
        const url = process.env.FACEBOOK_MESSAGES_URL;
        const token = process.env.CLOUD_API_ACCESS_TOKEN;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        console.log('reply', { url, data, headers });
        // post data as body and authorization header bearer token using fetch
        const response = await fetch(url!, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: headers
        });

        if (response.ok) {
            // log response
            console.log(await response.json());
        } else {
            console.error(await response.text());
        }


    } catch (e) {
        console.error(e);
    }
}




dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const webhook = app.route('/webhook');
webhook.get((request, response) => {
    if (
        request.query["hub.mode"] == "subscribe" &&
        request.query["hub.verify_token"] == process.env.WEBHOOK_VERIFICATION_TOKEN
    ) {
        response.send(request.query["hub.challenge"]);
    } else {
        response.sendStatus(400);
    }
});
webhook.post(async (request, response) => {
    try {
        console.log(
            `Incoming webhook request: \n\Body:
        ${JSON.stringify(request.body)}`
        );
        const body = request.body;
        if (body?.entry[0].changes[0].field == "messages" && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const processor = processors[message.type];
            try {
                if (processor) {
                    await processor(message);
                } else {
                    console.log(`No processor for message type: ${message.type}`);
                    await reply(message, `👨🏿‍🏫: *Desculpe, ainda não lido com mensagens do tipo  ${message.type}`);
                }

            } catch (e) {
                console.error(e);
                await reply(message, `👨🏿‍🏫: *Desculpe, ainda estou sendo testado!\n\n${JSON.stringify(e)}`);
            }
        }

        response.sendStatus(200);
    } catch (e) {
        console.error(e);
        response.sendStatus(500);
    }

});
//create express server and start it
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});





