const WebSocket = require('ws');
const dgram = require('dgram');

class StreamServer {
    constructor(config) {
        this._signalingPort = config.SIGNALING_PORT;
        this._udpPort = config.UDP_PORT;

        this._wss = new WebSocket.Server({ port: this._signalingPort });
        this._udpServer = dgram.createSocket('udp4');

        this._clients = new Map();
        this._subscribers = new Map();
        this._udpClients = new Map();
    }

    listen() {
        console.log(`WebRTC Signaling Server running on port ${this._signalingPort}`);
        console.log(`UDP Server running on port ${this._udpPort}`);

        this._udpServer.on('message', (msg, rinfo) => {
            this.handleUdpPacket(msg, rinfo);
        });

        this._udpServer.on('listening', () => {
            const address = this._udpServer.address();
            console.log(`UDP Server listening on ${address.address}:${address.port}`);
        });

        this._udpServer.bind(this._udpPort);

        this._wss.on('connection', (ws) => {
            const clientId = this.generateId();
            console.log(`Client ${clientId} connected (role not defined)`);

            this._clients.set(clientId, {
                ws: ws,
                role: 'unknown',
                id: clientId,
                udpAddress: null
            });

            this.send(ws, {
                type: 'connected',
                yourId: clientId,
                serverUdpPort: this._udpPort,
                message: 'Choose your role: register as source or viewer'
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleClientMessage(clientId, message);
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

    handleClientMessage(clientId, message) {
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

            case 'register-udp-endpoint':
                this.registerUdpEndpoint(clientId, message);
                break;

            case 'subscribe':
                this.subscribe(clientId, message);
                break;

            default:
                this.sendError(client.ws, 'UNKNOWN_MESSAGE_TYPE', 'Unknown message type');
        }
    }

    handleUdpPacket(msg, rinfo) {
        const sourceId = this._udpClients.get(`${rinfo.address}:${rinfo.port}`);

        if (!sourceId) {
            console.log(`Blocked UDP packet from unauthorized source: ${rinfo.address}:${rinfo.port}`);
            return;
        }

        const subscribers = this._subscribers.get(sourceId);
        if (!subscribers || subscribers.size === 0) {
            console.log(`No subscribers for source ${sourceId}, ignoring packet`);
            return;
        }

        subscribers.forEach(viewerId => {
            const viewer = this._clients.get(viewerId);
            if (viewer && viewer.udpAddress) {
                this._udpServer.send(msg, viewer.udpAddress.port, viewer.udpAddress.address);
            }
        });
    }

    registerUdpEndpoint(clientId, message) {
        const client = this._clients.get(clientId);
        if (!client) return;

        if (message.udpPort) {
            const udpAddress = {
                address: client.ws._socket.remoteAddress,
                port: message.udpPort
            };
            client.udpAddress = udpAddress;

            this._udpClients.set(`${udpAddress.address}:${udpAddress.port}`, clientId);

            this.send(client.ws, {
                type: 'udp-endpoint-registered',
                role: 'source',
                message: 'Success UDP endpoint registration'
            });

            console.log(`Client ${clientId} UDP endpoint: ${udpAddress.address}:${udpAddress.port}`);
        } else {
            this.sendError(client.ws, 'INVALID_MESSAGE_FORMAT', 'Invalid message format');
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
        client.udpAddress = null;

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
            message: 'Success registration as video source'
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
            this._subscribers.get(source.id).add(viewerId);
        }

        this.send(source.ws, {
            type: 'new-subscriber',
            message: 'New subscriber appear for your stream'
        });
    }

    broadcastToViewers(message) {
        this._clients.forEach((client) => {
            if (client.role === 'viewer' && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
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
                this._subscribers.delete(clientId);
                this.broadcastToViewers({
                    type: 'source-unavailable',
                    sourceId: clientId,
                    message: 'Source unavailable'
                });
            } else if (client.role === 'viewer') {
                this._subscribers.forEach((subscribers, sourceId) => {
                    if (subscribers.has(clientId)) {
                        subscribers.delete(clientId);
                        const source = this._clients.get(sourceId);
                        if (source && subscribers.size === 0 && source.ws.readyState === WebSocket.OPEN) {
                            this.send(source.ws, {
                                type: 'no-subscribers',
                                message: 'No subscribers for your stream'
                            });
                        }
                    }
                });
            }
            if (client.udpAddress) {
                this._udpClients.delete(`${client.udpAddress.address}:${client.udpAddress.port}`)
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