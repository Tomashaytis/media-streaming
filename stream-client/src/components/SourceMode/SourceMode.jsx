import { useRef, useState, useEffect } from 'react';
import './SourceMode.css';

function SourceMode() {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

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

            // Ждём, пока video элемент будет готов
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;

                // Добавляем обработчик, чтобы play() сработал, когда можно
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().catch(err => {
                        console.warn('Автовоспроизведение не сработало:', err);
                    });
                };
            }
        } catch (error) {
            console.error("Couldn't access camera:", error);
            alert('Не удалось получить доступ к камере: ' + error.message);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsCameraActive(false);
        }
    };

    // Очистка при размонтировании
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Привязываем поток при изменении stream (если video уже смонтирован)
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