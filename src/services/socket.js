import { io } from 'socket.io-client';

// Connect to current origin in dev/prod (or localhost:3001)
const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/';

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ Connected to Aledha game server:', socket.id);
});

socket.on('connect_error', (err) => {
  console.warn('Socket connect error (falling back if needed):', err.message);
});
