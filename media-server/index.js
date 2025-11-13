const WebSocket = require('ws');
const Jimp = require('jimp');

const SIGNALING_PORT = process.env.SIGNALING_PORT || 8888;

const wss = new WebSocket.Server({ port: SIGNALING_PORT });

/** { id: string, socket: WebSocket, role: 'source' | 'viewer' | 'unknown' } */
const clients = new Map();

let nextId = 1;
function genId() {
  return String(nextId++);
}

function log(...args) {
  console.log(new Date().toLocaleTimeString(), '-', ...args);
}

// grayscale
async function processFrame(jpegBuffer) {
  const image = await Jimp.read(jpegBuffer);
  image.grayscale();  //покадровая обработка
  return image.getBufferAsync(Jimp.MIME_JPEG);
}

wss.on('connection', (ws) => {
  const id = genId();
  clients.set(id, { id, socket: ws, role: 'unknown' });
  log('Client connected:', id);

  ws.send(JSON.stringify({ type: 'connected', yourId: id }));

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      log('Non-JSON message from', id);
      return;
    }


    if (msg.type === 'register') {
      const role = msg.role === 'source' ? 'source' : 'viewer';
      const client = clients.get(id);
      if (!client) return;

      client.role = role;
      ws.send(JSON.stringify({ type: 'role-registered', role }));
      log('Client', id, 'registered as', role);
      return;
    }

    // frame từ SOURCE
    if (msg.type === 'frame') {
      const client = clients.get(id);
      if (!client || client.role !== 'source') return;

      const base64 = msg.data;
      const sourceTs = msg.ts || Date.now();

      try {
        const jpegBuffer = Buffer.from(base64, 'base64');
        const processedBuffer = await processFrame(jpegBuffer);
        const processedBase64 = processedBuffer.toString('base64');

        const payload = JSON.stringify({
          type: 'frame',
          data: processedBase64,
          sourceTs,
          serverTs: Date.now()
        });

        // Send to viewers
        for (const [, c] of clients) {
          if (c.role === 'viewer' && c.socket.readyState === WebSocket.OPEN) {
            c.socket.send(payload);
          }
        }
      } catch (err) {
        log('Error processing frame from', id, err.message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    log('Client disconnected:', id);
  });

  ws.on('error', (err) => {
    log('WS error from', id, err.message);
  });
});

log('Media WebSocket server listening on port', SIGNALING_PORT);
