import './StatusBar.css';

function StatusBar(props) {
    return (
        <div className="status-row">
            <span>WS: <strong>{ props.connected ? "CONNECTED" : "DISCONNECTED" } </strong></span>
            <span>Client ID: { props.clientId ? props.clientId : "" }</span>
            <span>Role: { props.role }</span>
        </div>
    );
}

export default StatusBar;