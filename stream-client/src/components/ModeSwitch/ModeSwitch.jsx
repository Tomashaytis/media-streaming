import './ModeSwitch.css';
import '../shared/Card.css';

function ModeSwitch({ role, onRoleChange }) {
    return (
        <div className="mode-switch">
            <button 
                onClick={() => onRoleChange('viewer')}
                disabled={role === 'viewer'}
            >
                👁 Viewer (подключиться к трансляции)
            </button>
            <button 
                onClick={() => onRoleChange('source')}
                disabled={role === 'source'}
            >
                📷 Source (транслировать с камеры)
            </button>
        </div>
    );
}

export default ModeSwitch;