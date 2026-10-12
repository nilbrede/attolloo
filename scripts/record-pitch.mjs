// Makes a video file of the one-minute pitch, with its soundtrack. Not part of publishing.
//
//   npx playwright install chromium     (once)
//   python3 -m http.server 8765         (in the repository, in another window)
//   node scripts/record-pitch.mjs 1920 1080      → pitch-1920x1080.mp4
//   node scripts/record-pitch.mjs 1080 1350      → pitch-1080x1350.mp4 (4:5, for feeds on a phone)
//
// It opens /pitch.html?record, renders the soundtrack to a WAV file (/js/pitch-sound.js), then steps the
// film frame by frame at 30 frames a second and takes a picture of each, so the result is smooth however
// slow the machine is. ffmpeg puts the pictures and the sound together. Needs playwright and ffmpeg.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const W = Number(process.argv[2]) || 1920;
const H = Number(process.argv[3]) || 1080;
const URL = process.env.PITCH_URL || 'http://localhost:8765/pitch.html?record';
const FPS = 30;
const TAIL = 2500;                       // the last scene is held a little after the film ends
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pitch-'));

const browser = await chromium.launch();
// A tall frame is drawn at half size and twice the pixel density, so it gets the phone layout with larger text.
const tall = H > W;
const page = await browser.newPage({ viewport: { width: tall ? W / 2 : W, height: tall ? H / 2 : H }, deviceScaleFactor: tall ? 2 : 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);         // the photographs
const wav = await page.evaluate(() => window.pitchRenderAudio());
fs.writeFileSync(path.join(dir, 'sound.wav'), Buffer.from(wav, 'base64'));
const total = await page.evaluate(() => window.pitchStepStart());
const dt = 1000 / FPS;
const frames = Math.ceil((total + TAIL) / dt);
for (let k = 0; k < frames; k++) {
  if (k > 0) await page.evaluate((d) => window.pitchFrame(d), dt);
  await page.screenshot({ path: path.join(dir, 'f' + String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
}
await browser.close();

const secs = frames / FPS;
const out = `pitch-${W}x${H}.mp4`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-i', path.join(dir, 'sound.wav'),
  '-filter_complex', `[0:v]scale=${W}:${H},fade=t=out:st=${(secs - 0.5).toFixed(2)}:d=0.5,format=yuv420p[v];[1:a]atrim=0:${secs.toFixed(2)},loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=${(secs - 1.5).toFixed(2)}:d=1.5[a]`,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out], { stdio: 'inherit' });
fs.rmSync(dir, { recursive: true, force: true });
console.log('Wrote', out);
