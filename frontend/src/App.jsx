import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

export default function App() {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    socket.on('snapshot', (data) => {
      setSnapshot(data);
    });

    return () => {
      socket.off('snapshot');
    };
  }, []);

  const sendCommand = (cmdType) => {
    socket.emit('command', { command: cmdType });
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: '20px' }}>
      <h1>Thread Monitor - UI Mode</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => sendCommand('PAUSE')} style={{ marginRight: '10px' }}>Pause (PAUSE)</button>
        <button onClick={() => sendCommand('RESUME')}>Resume (RESUME)</button>
      </div>

      <div style={{ background: '#1e1e1e', color: '#00ff00', padding: '15px', borderRadius: '5px' }}>
        <h3>Real-time data (JSON)</h3>
        <pre>{snapshot ? JSON.stringify(snapshot, null, 2) : 'Waiting for data...'}</pre>
      </div>
    </div>
  );
}