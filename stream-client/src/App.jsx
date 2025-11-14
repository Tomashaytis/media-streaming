import StatusBar from './components/StatusBar/StatusBar.jsx';
import ModeSwitch from './components/ModeSwitch/ModeSwitch.jsx';
import ViewerMode from './components/ViewerMode/ViewerMode.jsx';
import SourceMode from './components/SourceMode/SourceMode.jsx';
import AvailableSources from './components/AvailableSources/AvailableSources.jsx';
import clientApi from './api/clientApi';
import './App.css';
import { ClientApiContext } from './contexts/ClientApiContext.jsx';
import { useState, useEffect } from 'react';

function App() {
    // On client ID change
    const [clientId, setClientId] = useState(clientApi.clientId);
    useEffect(() => {
        const handler = () => setClientId(clientApi.clientId);
        clientApi.clientIdCallback = handler;
        return () => {
            clientApi.clientIdCallback = () => { };
        };
    }, []);

    // On role change
    const [role, setRole] = useState(clientApi.role);
    useEffect(() => {
        const handler = () => setRole(clientApi.role);
        clientApi.roleCallback = handler;
        return () => {
            clientApi.roleCallback = () => { };
        };
    }, []);

    // On status change
    const [connected, setConnected] = useState(clientApi.connected);
    useEffect(() => {
        const handler = () => setConnected(clientApi.connected);
        clientApi.connectedCallback = handler;
        return () => {
            clientApi.connectedCallback = () => { };
        };
    }, []);

    // On subscriber change
    const [subscriber, setSubscriber] = useState(clientApi.subscriber);
    useEffect(() => {
        const handler = () => setSubscriber(clientApi.subscriber);
        clientApi.subscriberCallback = handler;
        return () => {
            clientApi.subscriberCallback = () => { };
        };
    }, []);

    const [availableSources, setAvailableSources] = useState(new Set());
    useEffect(() => {
        const availableSourcesHandler = (sources) => {
            setAvailableSources(new Set(sources));
        };

        const sourceAvailableHandler = (sourceId) => {
            setAvailableSources(prev => new Set([...prev, sourceId]));
        };

        const sourceUnavailableHandler = (sourceId) => {
            setAvailableSources(prev => {
                const newSet = new Set(prev);
                newSet.delete(sourceId);
                return newSet;
            });
        };

        clientApi.availableSourcesCallback = availableSourcesHandler;
        clientApi.sourceAvailableCallback = sourceAvailableHandler;
        clientApi.sourceUnavailableCallback = sourceUnavailableHandler;

        return () => {
            clientApi.availableSourcesCallback = () => { };
            clientApi.sourceAvailableCallback = () => { };
            clientApi.sourceUnavailableCallback = () => { };
        };
    }, []);


    // On subscribers change
    const [subscriberCount, setSubscriberCount] = useState(0);
    useEffect(() => {
        const newSubscriberHandler = () => setSubscriberCount(prev => prev + 1);
        const noSubscribersHandler = () => setSubscriberCount(0);

        clientApi.newSubscriberCallback = newSubscriberHandler;
        clientApi.noSubscribersCallback = noSubscribersHandler;

        return () => {
            clientApi.newSubscriberCallback = () => { };
            clientApi.noSubscribersCallback = () => { };
        };
    }, []);

    // On frame change
    const [currentFrame, setCurrentFrame] = useState(null);
    const [frameInfo, setFrameInfo] = useState({ sourceTs: 0, serverTs: 0 });

    useEffect(() => {
        const videoFrameHandler = (data) => {
            setCurrentFrame(data.frame);
            setFrameInfo({
                sourceTs: data.sourceTs,
                serverTs: data.serverTs
            });
        };

        clientApi.videoFrameCallback = videoFrameHandler;

        return () => {
            clientApi.videoFrameCallback = () => { };
        };
    }, []);

    return (
        <ClientApiContext.Provider value={clientApi}>
            <main className="App">
                <h1>Media streaming</h1>
                <StatusBar
                    connected={connected}
                    clientId={clientId}
                    role={role}
                    subscriberCount={subscriberCount}
                    availableSourcesCount={Array.from(availableSources).length}
                />
                {
                    role !== 'source' ?
                    <AvailableSources
                        availableSources={Array.from(availableSources)}
                        onSourceSelect={(sourceId) => {
                            if (sourceId === subscriber) {
                                clientApi.unsubscribe();
                            } else {
                                clientApi.subscribe(sourceId);
                            }
                        }}
                        subscriber={subscriber}
                    /> :
                    <></>
                }
                <ModeSwitch
                    role={role}
                    onRoleChange={(newRole) => {
                        if (newRole === 'source') clientApi.registerAsSource();
                        if (newRole === 'viewer') clientApi.registerAsViewer();
                    }}
                />
                {
                    role === 'source' ?
                        <SourceMode role={role} subscriberCount={subscriberCount} /> :
                        <ViewerMode role={role} subscriber={subscriber} frame={currentFrame} frameInfo={frameInfo} />
                }
            </main>
        </ClientApiContext.Provider>
    );
}

export default App;

/*import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8888';

function App() {
  const [mode, setMode] = useState('viewer'); // 'viewer' | 'source'
  const [ws, setWs] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [role, setRole] = useState('unknown');
  const [clientId, setClientId] = useState(null);

  // viewer state
  const [latestFrame, setLatestFrame] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);

  // source state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const frameTimerRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    setWsStatus('connecting');

    socket.onopen = () => {
      setWsStatus('connected');

      socket.send(JSON.stringify({ type: 'register', role: mode }));
    };

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      if (msg.type === 'connected') {
        setClientId(msg.yourId);
      }

      if (msg.type === 'role-registered') {
        setRole(msg.role);
      }

      if (msg.type === 'frame' && mode === 'viewer') {
        setLatestFrame(msg.data);
        if (msg.sourceTs) {
          setLatencyMs(Date.now() - msg.sourceTs);
        }
      }
    };

    socket.onerror = () => setWsStatus('error');
    socket.onclose = () => setWsStatus('disconnected');

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [mode]);

  //  WS open and mode was changed so register will be resended
  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'register', role: mode }));
    }
  }, [mode, ws]);

  //SOURCE: camera + frame
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
      startSendingFrames();
    } catch (err) {
      alert('Không mở được camera: ' + err.message);
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    stopSendingFrames();
  }

  function startSendingFrames() {
    if (frameTimerRef.current) return;
    frameTimerRef.current = setInterval(sendFrame, 100); // ~10fps
  }

  function stopSendingFrames() {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }

  function sendFrame() {
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !videoRef.current ||
      !canvasRef.current
    ) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    // MJPEG: Сжатие кадров в JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    const base64 = dataUrl.split(',')[1];

    ws.send(
      JSON.stringify({
        type: 'frame',
        data: base64,
        ts: Date.now()
      })
    );
  }

  const wsColor =
    wsStatus === 'connected'
      ? '#16a34a'
      : wsStatus === 'connecting'
      ? '#eab308'
      : wsStatus === 'error'
      ? '#dc2626'
      : '#6b7280';

  return (
    <div className="App">
      <header className="App-header">
        <h1>Media streaming — один React клиент</h1>

        <div className="status-row">
          <span>
            WS:{' '}
            <strong style={{ color: wsColor }}>
              {wsStatus.toUpperCase()}
            </strong>
          </span>
          <span>Client ID: {clientId || '—'}</span>
          <span>Role: {role}</span>
        </div>

        <div className="mode-switch">
          <button
            onClick={() => setMode('viewer')}
            disabled={mode === 'viewer'}
          >
            👁 Viewer (подключиться к трансляции)
          </button>
          <button
            onClick={() => setMode('source')}
            disabled={mode === 'source'}
          >
            📷 Source (транслировать с камеры)
          </button>
        </div>

        {mode === 'source' ? (
          <section className="card">
            <h2>Source mode — устройство регистрации (1)</h2>
            <p>
              Берём кадры с веб-камеры, сжимаем в JPEG (MJPEG) и отправляем на
              сервер.
            </p>
            <div className="video-row">
              <div className="video-box">
                <video ref={videoRef} autoPlay muted playsInline />
                <div className="info">Исходное видео с камеры</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              {!streaming ? (
                <button
                  onClick={startCamera}
                  disabled={wsStatus !== 'connected'}
                >
                  Start camera & streaming
                </button>
              ) : (
                <button onClick={stopCamera}>Stop</button>
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </section>
        ) : (
          <section className="card">
            <h2>Viewer mode — веб-клиент (3)</h2>
            <p>
              Получаем обработанный поток с сервера (2)
              и отображаем его как видео.
            </p>
            <div className="video-row">
              <div className="video-box">
                {latestFrame ? (
                  <img
                    src={`data:image/jpeg;base64,${latestFrame}`}
                    alt="processed frame"
                  />
                ) : (
                  <div className="info">
                    Ожидание кадров... Откройте этот сайт во второй вкладке и
                    включите Source mode.
                  </div>
                )}
                <div className="info">
                  latency:{' '}
                  {latencyMs != null ? `${latencyMs} ms` : '—'}
                </div>
              </div>
            </div>
          </section>
        )}
      </header>
    </div>
  );
}

export default App;*/
