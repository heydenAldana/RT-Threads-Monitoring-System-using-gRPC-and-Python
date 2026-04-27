import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [targetPid, setTargetPid] = useState('');
  const socketRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    socketRef.current = io('http://localhost:3001', { reconnectionDelayMax: 5000 });

    socketRef.current.on('connect', () => setIsConnected(true));
    socketRef.current.on('disconnect', () => setIsConnected(false));
    
    socketRef.current.on('snapshot', (data) => {
      setSnapshot(data);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const sendCommand = (cmdId, pid = 0) => {
    if (socketRef.current) {
      socketRef.current.emit('command', { command: cmdId, target_pid: Number(pid) });
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const stats = snapshot?.stats || {};
  const memPct = stats.memory_total ? (stats.memory_used / stats.memory_total) * 100 : 0;
  const threadsList = snapshot?.threads || [];

  const totalPages = Math.ceil(threadsList.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentThreads = threadsList.slice(indexOfFirstItem, indexOfLastItem);

  const nextPage = () => setCurrentPage((prev) => (prev < totalPages ? prev + 1 : prev));
  const prevPage = () => setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [threadsList.length, currentPage, totalPages]);

  return (
    <div style={{ backgroundColor: '#11111b', color: '#cdd6f4', minHeight: '100vh', padding: '30px', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>
          <span style={{ color: isConnected ? '#a6e3a1' : '#f38ba8' }}>●</span> Thread Monitor UI
        </h2>
        <div>
          <button onClick={() => sendCommand(1)} style={btnStyle('#f9e2af', '#111')}>Pause</button>
          <button onClick={() => sendCommand(2)} style={btnStyle('#a6e3a1', '#111')}>Resume)</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#1e1e2e', borderRadius: '8px' }}>
         <input 
            type="number" 
            placeholder="Input any PID..." 
            value={targetPid} 
            onChange={(e) => setTargetPid(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #45475a', background: '#313244', color: '#fff' }}
         />
         <button onClick={() => sendCommand(3, targetPid)} style={btnStyle('#89b4fa', '#111')}>Filter)</button>
         <button onClick={() => sendCommand(4, targetPid)} style={btnStyle('#f38ba8', '#111')}>Kill</button>
      </div>

      {/* Global Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
          <h4>Total Threads</h4>
          <h2>{snapshot?.total_count || 0}</h2>
        </div>
        <div style={cardStyle}>
          <h4>CPU Use</h4>
          <h2>{stats.cpu_percent ? stats.cpu_percent.toFixed(1) : 0}%</h2>
        </div>
        <div style={cardStyle}>
          <h4>Memory Use</h4>
          <h2>{formatBytes(stats.memory_used)} / {formatBytes(stats.memory_total)} ({memPct.toFixed(0)}%)</h2>
        </div>
      </div>

      {/* Thread Table */}
      <div style={{ backgroundColor: '#1e1e2e', padding: '20px', borderRadius: '8px', overflowX: 'auto' }}>
        {snapshot?.is_paused && <p style={{ color: '#f9e2af' }}>[ STREAM ON PAUSE ] Last command: {snapshot.cmd_echo}</p>}
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '15px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #313244', color: '#bac2de' }}>
              <th style={{ padding: '12px' }}>TID</th>
              <th style={{ padding: '12px' }}>PID</th>
              <th style={{ padding: '12px' }}>Process</th>
              <th style={{ padding: '12px' }}>State</th>
              <th style={{ padding: '12px' }}>CPU Time</th>
            </tr>
          </thead>
          <tbody>
            {currentThreads.map((t, idx) => {
              const cpuTime = (t.user_time + t.system_time).toFixed(2);
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #313244' }}>
                  <td style={{ padding: '12px', color: '#89b4fa' }}>{t.tid}</td>
                  <td style={{ padding: '12px' }}>{t.pid}</td>
                  <td style={{ padding: '12px' }}>{t.process_name}</td>
                  <td style={{ padding: '12px', color: t.status === 'running' ? '#a6e3a1' : '#cdd6f4' }}>{t.status}</td>
                  <td style={{ padding: '12px' }}>{cpuTime}s</td>
                </tr>
              );
            })}
            {currentThreads.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>No visible threads on this page...</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
            <button 
              onClick={prevPage} 
              disabled={currentPage === 1}
              style={{ ...btnStyle('#313244', '#cdd6f4'), opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <span style={{ color: '#bac2de' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={nextPage} 
              disabled={currentPage === totalPages}
              style={{ ...btnStyle('#313244', '#cdd6f4'), opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: '#1e1e2e',
  padding: '20px',
  borderRadius: '8px',
  border: '1px solid #313244',
  textAlign: 'center'
};

const btnStyle = (bg, color) => ({
  backgroundColor: bg,
  color: color,
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  marginLeft: '10px'
});