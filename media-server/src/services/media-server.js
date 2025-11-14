const WebSocket = require('ws');
const Jimp = require('jimp');

class StreamServer {
    constructor(config) {
        this._signalingPort = config.SIGNALING_PORT;

        this._wss = new WebSocket.Server({ port: this._signalingPort });

        this._clients = new Map();
        this._subscribers = new Map();
    }

    listen() {
        console.log(`Media Server running on port ${this._signalingPort}`);

        this._wss.on('connection', (ws) => {
            const clientId = this.generateId();
            console.log(`Client ${clientId} connected (role not defined)`);

            this._clients.set(clientId, {
                ws: ws,
                role: 'unknown',
                id: clientId,
            });

            this.send(ws, {
                type: 'connected',
                yourId: clientId,
                message: 'Choose your role: register as source or viewer'
            });

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data);
                    await this.handleClientMessage(clientId, message);
                } catch (error) {
                    this.sendError(ws, 'INVALID_MESSAGE_FORMAT', 'Invalid message format');
                }
            });

            ws.on('close', () => {
                this.handleDisconnect(clientId);
            });

            ws.on('error', (error) => {
                console.log(`Client ${clientId} error:`, error);
                this.handleDisconnect(clientId);
            });
        });
    }

    async handleClientMessage(clientId, message) {
        const client = this._clients.get(clientId);
        if (!client) return;
        if (!message.type) {
            this.sendError(client.ws, 'INVALID_MESSAGE_FORMAT', 'Invalid message format');
            return;
        }

        switch (message.type) {
            case 'register-source':
                this.registerAsSource(clientId);
                break;

            case 'register-viewer':
                this.registerAsViewer(clientId);
                break;

            case 'video-frame':
                await this.handleVideoFrame(clientId, message);
                break;

            case 'subscribe':
                this.subscribe(clientId, message);
                break;

            case 'unsubscribe':
                this.unsubscribe(clientId, message);
                break;

            default:
                this.sendError(client.ws, 'UNKNOWN_MESSAGE_TYPE', 'Unknown message type');
        }
    }

    async handleVideoFrame(clientId, message) {
        const source = this._clients.get(clientId);
        if (!source) return;

        if (source.role !== 'source') {
            this.sendError(source.ws, 'REGISTRATION_REQUIRED', 'Register as source first');
            return;
        }

        if (!message.frame) {
            this.sendError(source.ws, 'INVALID_MESSAGE_FORMAT', 'Invalid message format');
            return;
        }

        const base64 = message.frame;
        const sourceTs = message.ts || Date.now();

        try {
            const jpegBuffer = Buffer.from(base64, 'base64');
            const processedBuffer = await this.processFrame(jpegBuffer);
            const processedBase64 = processedBuffer.toString('base64');

            this._subscribers.get(clientId).forEach(viewerId => {
                const viewer = this._clients.get(viewerId);
                this.send(viewer.ws, {
                    type: 'video-frame',
                    frame: processedBase64,
                    sourceTs: sourceTs,
                    serverTs: Date.now()
                })
            });
        } catch (err) {
            log('Error processing frame from', clientId, err.message);
        }
    }

    async processFrame(jpegBuffer) {
        try {
            const image = await Jimp.read(jpegBuffer);
            image.grayscale();
            return await image.getBufferAsync(Jimp.MIME_JPEG);
        } catch (error) {
            console.log('Error processing frame:', error);
            return jpegBuffer;
        }
    }

    registerAsSource(clientId) {
        const client = this._clients.get(clientId);
        if (!client) return;

        if (client.role === 'viewer') {
            this._subscribers.forEach((subscribers, sourceId) => {
                if (subscribers.has(clientId)) {
                    subscribers.delete(clientId);
                }
            });
        }

        this._subscribers.set(clientId, new Set());
        client.role = 'source';

        console.log(`Client ${clientId} registered as VIDEO SOURCE`);

        this.send(client.ws, {
            type: 'role-registered',
            role: 'source',
            message: 'Success registration as video source'
        });

        this.broadcastToViewers({
            type: 'source-available',
            sourceId: clientId,
            message: 'New source available'
        });
    }

    registerAsViewer(clientId) {
        const client = this._clients.get(clientId);
        if (!client) return;

        if (client.role === 'source') {
            this._subscribers.delete(clientId);
        }

        client.role = 'viewer';

        console.log(`Client ${clientId} registered as VIEWER`);

        const availableSources = Array.from(this._subscribers.keys());

        this.send(client.ws, {
            type: 'role-registered',
            role: 'viewer',
            availableSources: availableSources,
            message: 'Success registration as viewer'
        });
    }

    subscribe(viewerId, message) {
        const viewer = this._clients.get(viewerId);
        if (!viewer) return;

        if (viewer.role !== 'viewer') {
            this.sendError(viewer.ws, 'REGISTRATION_REQUIRED', 'Register as viewer first');
            return;
        }
        if (!message.sourceId) {
            this.sendError(viewer.ws, 'INVALID_MESSAGE_FORMAT', 'Invalid message format');
            return;
        }

        const source = this._clients.get(message.sourceId);
        if (!source || source.role !== 'source') {
            this.sendError(viewer.ws, 'SOURCE_NOT_FOUND', 'Requested source not found');
            return;
        }

        if (this._subscribers.has(source.id)) {
            this._subscribers.forEach((subscribers, sourceId) => {
                if (subscribers.has(viewerId)) {
                    subscribers.delete(viewerId);
                    const tmpSource = this._clients.get(sourceId);
                    if (subscribers.size === 0) {
                        this.send(tmpSource.ws, {
                            type: 'no-subscribers',
                            message: 'No subscribers for your stream'
                        });
                    }
                }
            });

            this._subscribers.get(source.id).add(viewerId);

            this.send(viewer.ws, {
                type: 'subscribe',
                sourceId: source.id,
                message: 'Success subscribe'
            });

            this.send(source.ws, {
                type: 'new-subscriber',
                message: 'New subscriber appear for your stream'
            });
        }
    }

    unsubscribe(viewerId) {
        const viewer = this._clients.get(viewerId);
        if (!viewer) return;

        if (viewer.role !== 'viewer') {
            this.sendError(viewer.ws, 'REGISTRATION_REQUIRED', 'Register as viewer first');
            return;
        }

        this._subscribers.forEach((subscribers, sourceId) => {
            if (subscribers.has(viewerId)) {
                subscribers.delete(viewerId);
                const source = this._clients.get(sourceId);
                if (subscribers.size === 0) {
                    this.send(source.ws, {
                        type: 'no-subscribers',
                        message: 'No subscribers for your stream'
                    });
                }
            }
        });

        this.send(viewer.ws, {
            type: 'unsubscribe',
            message: 'Success unsubscribe'
        });
    }

    broadcastToViewers(message) {
        this._clients.forEach((client) => {
            if (client.role === 'viewer' && client.ws.readyState === WebSocket.OPEN) {
                this.send(client.ws, message);
            }
        });
    }

    send(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    handleDisconnect(clientId) {
        const client = this._clients.get(clientId);

        if (client) {
            console.log(`Client ${clientId} (${client.role}) disconnected`);

            if (client.role === 'source') {
                this.broadcastToViewers({
                    type: 'source-unavailable',
                    sourceId: clientId,
                    message: 'Source unavailable'
                });
                this._subscribers.get(clientId).forEach(viewerId => {
                    const viewer = this._clients.get(viewerId);
                    this.send(viewer.ws, {
                        type: 'unsubscribe',
                        message: 'Source unavailable'
                    });
                });
                this._subscribers.delete(clientId);
            } else if (client.role === 'viewer') {
                this._subscribers.forEach((subscribers, sourceId) => {
                    if (subscribers.has(clientId)) {
                        subscribers.delete(clientId);
                        const source = this._clients.get(sourceId);
                        if (subscribers.size === 0) {
                            this.send(source.ws, {
                                type: 'no-subscribers',
                                message: 'No subscribers for your stream'
                            });
                        }
                    }
                });
            }

            this._clients.delete(clientId);
        }
    }

    sendError(ws, errorType, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'error',
                errorType: errorType,
                message: message
            }));
        }
    }

    generateId() {
        return Math.random().toString(36).slice(2, 9);
    }
}

module.exports = StreamServer;