import { useContext, useRef, useState, useEffect } from 'react';
import { ClientApiContext } from '../../contexts/ClientApiContext'
import './SourceMode.css';

function SourceMode(props) {
    const clientApi = useContext(ClientApiContext);
    const videoRef = useRef(null);
    const streamingIntervalRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

    const captureFrame = () => {
        if (!videoRef.current || videoRef.current.videoWidth === 0) {
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);

        clientApi.sendVideoFrame(canvas, 0.5);
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            setStream(mediaStream);
            setIsCameraActive(true);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;

                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().catch(err => {
                        console.warn('Автовоспроизведение не сработало:', err);
                    });

                    setTimeout(() => {
                        if (props.role === 'source' && props.subscriberCount > 0) {
                            streamingIntervalRef.current = setInterval(captureFrame, 10);
                        }
                    }, 500);
                };
            }
        } catch (error) {
            console.error("Couldn't access camera:", error);
            alert('Не удалось получить доступ к камере: ' + error.message);
        }
    };

    const stopCamera = () => {
        if (streamingIntervalRef.current) {
            clearInterval(streamingIntervalRef.current);
            streamingIntervalRef.current = null;
        }
        
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsCameraActive(false);
        }
    };

    useEffect(() => {
        if (props.role === 'source' && props.subscriberCount > 0 && isCameraActive && !streamingIntervalRef.current) {
            streamingIntervalRef.current = setInterval(captureFrame, 100);
            console.log('Streaming started');
        } else if ((props.role !== 'source' || props.subscriberCount === 0) && streamingIntervalRef.current) {
            clearInterval(streamingIntervalRef.current);
            streamingIntervalRef.current = null;
            console.log('Streaming stopped');
        }
    }, [props.role, props.subscriberCount, isCameraActive]);

    useEffect(() => {
        return () => {
            if (streamingIntervalRef.current) {
                clearInterval(streamingIntervalRef.current);
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <section className="card">
            <h2>Source Mode</h2>
            <p>Берём кадры с веб-камеры, сжимаем в JPEG и отправляем на сервер.</p>
            <div className="video-col">
                <div className="video-box">
                    {isCameraActive ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{ width: '100%', height: 'auto', background: '#000' }}
                        />
                    ) : (
                        <div className="info">Камера не активирована</div>
                    )}
                </div>
                <div className="controls">
                    <button
                        onClick={startCamera}
                        disabled={isCameraActive}
                    >
                        Start camera & streaming
                    </button>
                    <button
                        onClick={stopCamera}
                        disabled={!isCameraActive}
                    >
                        Stop
                    </button>
                </div>
            </div>
        </section>
    );
}

export default SourceMode;