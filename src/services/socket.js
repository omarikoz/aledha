import { io } from 'socket.io-client';

// Dynamic server URL: Use VITE_SERVER_URL environment variable if provided,
// otherwise default to localhost:3001 in local dev or current origin in production
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ Connected to Aledha game server:', socket.id);
});

socket.on('connect_error', (err) => {
  console.warn('Socket connect error (check VITE_SERVER_URL):', err.message);
});
