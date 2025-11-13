import './AvailableSources.css';
import { Flipper, Flipped } from 'react-flip-toolkit';

function AvailableSources(props) {
    return (
        <div className="available-sources"> 
            <Flipper flipKey={props.availableSources.join('')}>
                {props.availableSources.map((sourceId) => (
                    <Flipped key={sourceId} flipId={sourceId}>
                        <button 
                            className={`source-button ${sourceId === props.subscriber ? 'source-button--selected' : ''}`}
                            onClick={() => props.onSourceSelect(sourceId)}
                        >
                            {sourceId}
                        </button>
                    </Flipped>
                ))}
            </Flipper>
        </div>
    )
}

export default AvailableSources;