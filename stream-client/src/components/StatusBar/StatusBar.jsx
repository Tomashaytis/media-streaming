import './StatusBar.css';

function StatusBar(props) {
    return (
        <div className="status-row">
            <span>WS: <strong>{ props.connected ? "CONNECTED" : "DISCONNECTED" } </strong></span>
            <span>Client ID: { props.clientId ? props.clientId : "" }</span>
            <span>Role: { props.role }</span>
            { props.role === 'source' ? <span>Subscribers: { props.subscriberCount }</span> : <span>Sources: { props.availableSourcesCount }</span> }
        </div>
    );
}

export default StatusBar;