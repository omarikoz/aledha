import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cloudflaredExe = path.join(rootDir, 'cloudflared.exe');

let tunnelProcess = null;
let foundUrl = false;

function printBanner(url) {
  console.log('\n' + '='.repeat(68));
  console.log('🎉  ALEDHA ONLINE MULTIPLAYER TUNNEL IS ACTIVE!');
  console.log('='.repeat(68));
  console.log('📱  Share this HTTPS link with your friends on phone or PC:');
  console.log('');
  console.log(`👉  \x1b[1m\x1b[32m${url}\x1b[0m  👈`);
  console.log('');
  console.log('✨  Features active over this link:');
  console.log('    • Real-time Socket.io Multiplayer & Rooms');
  console.log('    • Integrated WebRTC Live Voice Chat');
  console.log('    • Mobile Microphone Permissions (Genuine HTTPS)');
  console.log('    • PIN-Protected Sound Packs & Synchronized Audio');
  console.log('    • Zero 1-hour expiration limits (stays on as long as this terminal is open)');
  console.log('='.repeat(68) + '\n');
}

if (fs.existsSync(cloudflaredExe)) {
  console.log('🚀 Starting Cloudflare Quick Tunnel on port 3001...');
  tunnelProcess = spawn(cloudflaredExe, ['tunnel', '--url', 'http://localhost:3001']);
} else {
  console.log('⚡ cloudflared.exe not found, falling back to localtunnel on port 3001...');
  tunnelProcess = spawn('npx', ['--yes', 'localtunnel', '--port', '3001'], {
    shell: true
  });
}

const handleOutput = (data) => {
  const text = data.toString();
  // Match Cloudflare tunnel URL
  const cfMatch = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (cfMatch && !foundUrl) {
    foundUrl = true;
    printBanner(cfMatch[0]);
    return;
  }

  // Match Localtunnel URL
  const ltMatch = text.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/);
  if (ltMatch && !foundUrl) {
    foundUrl = true;
    printBanner(ltMatch[0]);
    return;
  }

  // Suppress verbose cloudflare metrics to keep console clean once URL is found
  if (!foundUrl) {
    process.stderr.write(text);
  }
};

tunnelProcess.stdout.on('data', handleOutput);
tunnelProcess.stderr.on('data', handleOutput);

tunnelProcess.on('close', (code) => {
  console.log(`\n🛑 Tunnel process exited with code ${code}`);
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  if (tunnelProcess) tunnelProcess.kill('SIGINT');
  process.exit();
});
