// config/gemini.js
const { GoogleGenAI } = require('@google/genai');
const env = require('./env');

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const GEMINI_MODEL = 'gemini-2.5-flash';

module.exports = {
    genAI,
    GEMINI_MODEL
};