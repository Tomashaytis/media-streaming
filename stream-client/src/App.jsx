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