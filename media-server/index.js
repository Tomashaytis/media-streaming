const express = require('express');
const path = require('path');
const cors = require('cors');

const MediaServer = require('./src/services/media-server');
const config = require('./config');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../client/build')));

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
});

const mediaServer = new MediaServer(config);

mediaServer.listen();
