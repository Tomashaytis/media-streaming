import { useRef, useState, useEffect } from 'react';
import './ViewerMode.css';
import '../shared/Card.css';

function ViewerMode(props) {
    const videoRef = useRef(null);
    const [latency, setLatency] = useState(null);

    useEffect(() => {
        setLatency(Date.now() - props.frameInfo.sourceTs);
    }, [props.frameInfo]);

    useEffect(() => {
        let animationFrameId;
        
        const updateLatency = () => {
            setLatency(Date.now() - props.frameInfo.sourceTs);
            animationFrameId = requestAnimationFrame(updateLatency);
        };
        
        if (props.frame) {
            animationFrameId = requestAnimationFrame(updateLatency);
        }
        
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [props.frame, props.frameInfo.sourceTs]);

    return (
        <section className="card">
            <h2>Viewer Mode</h2>
            <p>Получаем обработанный поток с сервера и отображаем его как видео.</p>
            <div className="video-row">
                <div className="video-box">
                    {props.frame && props.subscriber && props.role === 'viewer' ? (
                        <>
                            <img 
                                ref={videoRef}
                                src={`data:image/jpeg;base64,${props.frame}`}
                                alt="Video stream"
                                style={{ width: '100%', height: 'auto' }}
                            />
                            <div className="info">latency: {latency}ms</div>
                        </>
                    ) : (
                        <>
                            <div className="info">
                                Ожидание кадров... Откройте этот сайт во второй вкладке и включите Source mode.
                            </div>
                            <div className="info">latency: N/A</div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

export default ViewerMode;