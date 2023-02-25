import * as bodyParser from "body-parser";
import * as cors from "cors";
import * as express from "express";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

import { loadSecrets } from '../../shared/secrets';
admin.initializeApp();
const app = express();
// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/webhook", async (request, response) => {
    const token = loadSecrets(process.env.INTEGRATION!).facebook.accessToken;
    if (
        request.query["hub.mode"] == "subscribe" &&
        request.query["hub.verify_token"] == token
    ) {
        response.send(request.query["hub.challenge"]);
    } else {
        response.sendStatus(400);
    }
});


app.post("/webhook", async (request, response) => {

    functions.logger.info('webhook', '-', 'post', { body: request.body });
    await admin.database().ref("whatsapp").child("oficial").push(request.body);
    response.sendStatus(200);
});

// const parseConsultarDividasBody = (webhookRequest: any) => {
//     const parameters = webhookRequest?.sessionInfo?.parameters;
//     const cpf = parameters?.['person_cpf'];
//     const nome = parameters?.['person_name'];
//     return { nome, cpf };
// }

// app.post("/consultar_dividas", async (request, response) => {

//     const webhookRequest = request.body;
//     const person = parseConsultarDividasBody(webhookRequest);
//     functions.logger.info('consultar_dividas', '-', 'post', { requestBody: request.body });
//     await admin.database().ref("whatsapp").child("consultar_dividas").push(person);

//     const webhookResponse = {
//         fulfillmentResponse: {
//             messages: [
//                 {
//                     text: {
//                         text: ["Avisamos todos os atendentes, rapidamente você receberá uma resposta!"],
//                     },
//                 },
//             ],
//         },
//     };

//     response.send(webhookResponse);
// });

export const facebookReceiver = functions.runWith({
    secrets: ["INTEGRATION"]
}).https.onRequest(app);
