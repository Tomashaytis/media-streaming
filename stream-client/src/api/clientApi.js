import config from "../config";

class ClientApi {
    constructor(serverHost, serverPort, udpPort, maxReconnectAttemps = 10, reconnectInterval = 5000) {
        this._serverHost = serverHost;
        this._serverPort = serverPort;
        this._udpPort = udpPort;
        this._url = `ws://${this._serverHost}:${this._serverPort}`;
        this._socket = null;
        this._role = 'undefined';
        this._connected = false;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = maxReconnectAttemps;
        this._reconnectInterval = reconnectInterval;
        this._reconnectTimer = null;
        this._roleCallback = () => { };
        this._clientIdCallback = () => { };
        this._connectedCallback = () => { };
        this._availableSourcesCallback = (availableSources) => { };
        this._sourceAvailableCallback = (sourceId) => { };
        this._sourceUnavailableCallback = (sourceId) => { };
        this._newSubscriberCallback = () => { };
        this._noSubscribersCallback = () => { };
        this._clientId = null;

        this.initSocket();
    }

    get role() {
        return this._role;
    }

    set roleCallback(value) {
        this._roleCallback = value;
    }

    set clientIdCallback(value) {
        this._clientIdCallback = value;
    }

    set connectedCallback(value) {
        this._connectedCallback = value;
    }

    set availableSourcesCallback(value) {
        this._availableSourcesCallback = value;
    }

    set sourceAvailableCallback(value) {
        this._sourceAvailableCallback = value;
    }

    set sourceUnavailableCallback(value) {
        this._sourceUnavailableCallback = value;
    }

    set newSubscriberCallback(value) {
        this._newSubscriberCallback = value;
    }

    set noSubscribersCallback(value) {
        this._noSubscribersCallback = value;
    }

    get clientId() {
        return this._clientId;
    }

    get connected() {
        return this._connected
    }

    initSocket() {
        // If previous socket connection exists
        if (this._socket) {
            this._socket.close();
        }

        this._socket = new WebSocket(this._url);

        // On opening socket connection 
        this._socket.addEventListener('open', () => {
            console.log(`Connection to ${this._url} opened`);
            this._reconnectAttempts = 0;
        });

        // On receiving server message
        this._socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        });

        // On closing socket connection from server
        this._socket.addEventListener('close', (event) => {
            console.log(`Connection closed (code: ${event.code}, reason: ${event.reason}`);
            if (event.code !== 1000) {
                this.reconnect();
            }
        });

        // On closing socket connection from server with error
        this._socket.addEventListener('error', (error) => {
            console.log(`Connection error: ${error}`);
        });
    }

    handleClose(event) {
        console.log(`Connection closed (code: ${event.code}, reason: ${event.reason}`);
        if (event.code !== 1000) {
            this.reconnect();
        }
    }

    handleError(error) {
        console.log(`Connection error: ${error}`);
    }

    registerAsViewer() {
        console.log('Requesting reqister as viewer...');
        this.send({
            type: 'register-viewer',
            message: 'Request reqister as viewer',
        });
    }

    registerAsSource() {
        console.log('Requesting reqister as source...');
        this.send({
            type: 'register-source',
            message: 'Request reqister as source',
        });
    }

    registerUdpPort() {
        console.log('Requesting reqister udp endpoint...');
        this.send({
            type: 'register-udp-endpoint',
            message: 'Request reqister UDP endpoint',
            udpPort: this._udpPort
        });
    }

    subscribe(sourceId) {
        console.log(`Subscribing to source ${sourceId}...`);
        this.send({
            type: 'subscribe',
            sourceId: sourceId
        });
    }

    send(data) {
        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
            this._socket.send(JSON.stringify(data));
        }
    }

    handleServerMessage(data) {
        switch (data.type) {
            case 'connected':
                this._clientId = data.yourId;
                this._role = 'undefined';
                this._connected = true;
                this._clientIdCallback();
                this._roleCallback();
                this._connectedCallback();
                this.registerAsViewer();
                console.log(data.message);
                break;

            case 'error':
                console.log('Error:', data.message);
                break;

            case 'role-registered':
                this._role = data.role;
                this._roleCallback()
                if (data.availableSources) {
                    this._availableSourcesCallback(data.availableSources);
                }
                console.log(data.message);
                break;

            case 'udp-endpoint-registered':
                this._role = data.role;
                this._roleCallback()
                console.log(data.message);
                break;

            case 'source-available':
                this._sourceAvailableCallback(data.sourceId);
                console.log(data.message);
                break;

            case 'source-unavailable':
                this._sourceUnavailableCallback(data.sourceId);
                console.log(data.message);
                break;

            case 'new-subscriber':
                this._newSubscriberCallback();
                console.log(data.message);
                break;

            case 'no-subscribers':
                this._noSubscribersCallback();
                console.log(data.message);
                break;

            default:
                console.log('Unknown message type');
                console.log(data);
        }
    }

    reconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        clearTimeout(this._reconnectTimer);

        this._reconnectAttempts++;
        console.log(`Reconnecting (attempt ${this._reconnectAttempts})...`);


        this._reconnectTimer = setTimeout(() => {
            this.initSocket();
        }, this._reconnectInterval);
    }

    close(code = 1000, reason = "Normal closure") {
        if (this._reconnectInterval) {
            clearTimeout(this._reconnectTimer);
        }

        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
            this._socket.close(code, reason);
        }

        this._clientId = null;
        this._role = 'undefined';
        this._connected = false;
        this._reconnectAttempts = 0;

        this._clientIdCallback();
        this._roleCallback();
        this._connectedCallback();
    }
}

const clientApi = new ClientApi(
    config.SERVER_HOST,
    config.SERVER_PORT,
    config.UDP_PORT,
    config.MAX_RECONNECT_ATTEMPS,
    config.RECONNECT_INTERVAL,
);

export default clientApi;