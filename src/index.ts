import { HttpRequest, Logging } from "@google-cloud/logging";
import { protos } from '@google-cloud/dialogflow-cx';
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import admin from "firebase-admin";
import functions from "firebase-functions"

admin.initializeApp();

