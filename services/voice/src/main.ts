// Entry point on Fly.io (D-100): settings from the environment; the Sarvam key is a Fly secret.
import { startRelay } from './server.js';

const env = process.env;
startRelay({
  port: Number(env.PORT ?? 8080),
  origins: (env.ALLOWED_ORIGINS ?? 'https://personal-cfo-ruddy.vercel.app,http://localhost:3002,http://localhost:3100').split(','),
  maxConn: env.MAX_CONN ? Number(env.MAX_CONN) : undefined,
  up: {
    sttUrl: env.SARVAM_STT_WS ?? 'wss://api.sarvam.ai/speech-to-text/ws',
    ttsUrl: env.SARVAM_TTS_WS ?? 'wss://api.sarvam.ai/text-to-speech/ws',
    key: env.SARVAM_API_KEY ?? '', ttsModel: env.SARVAM_TTS_MODEL ?? 'bulbul:v3', speaker: env.SARVAM_TTS_SPEAKER,
    pace: env.SARVAM_TTS_PACE ? Number(env.SARVAM_TTS_PACE) : undefined,
  },
}).then(({ port }) => console.log(`munim-voice on ${port}`));
