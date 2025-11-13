import './ViewerMode.css';
import '../shared/Card.css';

function ViewerMode() {
    return (
        <section className="card">
            <h2>Viewer Mode</h2>
            <p>Получаем обработанный поток с сервера и отображаем его как видео.</p>
            <div className="video-row">
                <div className="video-box">
                    <div className="info">
                        Ожидание кадров... Откройте этот сайт во второй вкладке и включите Source mode.
                    </div>
                    <div className="info">latency: —</div>
                </div>
            </div>
        </section>
    );
}

export default ViewerMode;