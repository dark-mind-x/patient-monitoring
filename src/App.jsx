import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Dashboard & History State
  const [vitals, setVitals] = useState({ bpm: 0, spo2: 0, temperature: 0, ecg: 0 });
  const [history, setHistory] = useState([]); // Keeps last 20 for the graph
  const [sessionHistory, setSessionHistory] = useState([]); // Keeps ALL points for the table
  const [selectedVital, setSelectedVital] = useState('bpm');
  const [showHistoryPage, setShowHistoryPage] = useState(false); // Toggles the new page

  const patientInfo = {
    name: "John Doe",
    age: 45,
    bloodType: "O+",
    doctor: "Dr. Smith",
    status: "Post-Surgery Recovery"
  };

  const recentAlerts = [
    { id: 1, time: "10:42 AM", msg: "System armed and awaiting telemetry", type: "info" }
  ];

  // ==========================================
  // REAL FIREBASE CONNECTION
  // ==========================================
  useEffect(() => {
    if (!isAuthenticated) return;

    const vitalsRef = ref(db, 'patients/patient_001/vitals');

    const unsubscribe = onValue(vitalsRef, (snapshot) => {
      if (snapshot.exists()) {
        const newData = snapshot.val();
        
        setVitals({
          bpm: newData.bpm,
          spo2: newData.spo2,
          temperature: newData.temperature,
          ecg: newData.ecg_value || 0 
        });

        const newPoint = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          bpm: newData.bpm,
          spo2: newData.spo2,
          temperature: newData.temperature,
          ecg: newData.ecg_value || 0
        };

        // Update Graph Array (Max 20 points)
        setHistory(prevHistory => {
          const updatedHistory = [...prevHistory, newPoint];
          if (updatedHistory.length > 20) updatedHistory.shift(); 
          return updatedHistory;
        });

        // Update Table Array (Uncapped, newest at the top)
        setSessionHistory(prev => [newPoint, ...prev]);
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);
  // ==========================================

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinCode === '1234') {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPinCode('');
    }
  };

  const getGraphColor = () => {
    if (selectedVital === 'bpm') return '#ff4757';
    if (selectedVital === 'spo2') return '#1e90ff';
    if (selectedVital === 'temperature') return '#ffa502';
    if (selectedVital === 'ecg') return '#a55eea'; 
    return '#2ed573';
  };

  // --- VIEW 1: LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <span className="login-logo">🏥</span>
            <h2>ICU Secure Portal</h2>
            <p>Authorized Medical Personnel Only</p>
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label>Doctor / Caretaker PIN</label>
              <input 
                type="password" 
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Enter 4-digit PIN (1234)"
                autoFocus
              />
            </div>
            {loginError && <div className="error-message">Invalid PIN. Access Denied.</div>}
            <button type="submit" className="login-button">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW 2: HISTORY TABLE PAGE ---
  if (showHistoryPage) {
    return (
      <div className="dark-dashboard history-view">
        <nav className="top-nav">
          <div className="nav-brand">
            <span className="logo-icon">🏥</span>
            <h1>ICU Session History Log</h1>
          </div>
          <div className="system-status">
            <button onClick={() => setShowHistoryPage(false)} className="action-btn back-btn">
              ← Back to Dashboard
            </button>
          </div>
        </nav>

        <div className="table-container">
          <div className="table-wrapper">
            <table className="vitals-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Heart Rate (BPM)</th>
                  <th>Blood Oxygen (SpO2%)</th>
                  <th>Body Temp (°C)</th>
                  <th>ECG Signal (RAW)</th>
                </tr>
              </thead>
              <tbody>
                {sessionHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">No session data recorded yet.</td>
                  </tr>
                ) : (
                  sessionHistory.map((point, index) => (
                    <tr key={index}>
                      <td className="time-col">{point.time}</td>
                      <td className="text-red">{point.bpm}</td>
                      <td className="text-blue">{point.spo2}%</td>
                      <td className="text-orange">{point.temperature}°C</td>
                      <td className="text-purple">{point.ecg}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 3: MAIN DASHBOARD ---
  return (
    <div className="dark-dashboard">
      <nav className="top-nav">
        <div className="nav-brand">
          <span className="logo-icon">🏥</span>
          <h1>ICU Central Monitor</h1>
        </div>
        <div className="system-status">
          <span className="pulse-dot"></span>
          <span>System Online</span>
          {/* New History Button */}
          <button onClick={() => setShowHistoryPage(true)} className="action-btn history-btn">
            📋 View History
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="logout-btn">Log Out</button>
        </div>
      </nav>

      <div className="main-layout">
        <aside className="sidebar">
          <div className="panel patient-profile">
            <h3>Patient Details</h3>
            <div className="profile-pic">👤</div>
            <h2 className="patient-name">{patientInfo.name}</h2>
            <p className="patient-status">{patientInfo.status}</p>
            <div className="details-grid">
              <div className="detail-item"><label>Age</label><span>{patientInfo.age}</span></div>
              <div className="detail-item"><label>Blood</label><span>{patientInfo.bloodType}</span></div>
              <div className="detail-item"><label>Attending</label><span>{patientInfo.doctor}</span></div>
            </div>
          </div>

          <div className="panel alert-log">
            <h3>System Status</h3>
            <ul>
              {recentAlerts.map(alert => (
                <li key={alert.id} className={`alert-item ${alert.type}`}>
                  <span className="alert-time">{alert.time}</span>
                  <span className="alert-msg">{alert.msg}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="content-area">
          <div className="cards-grid">
            <div className={`vital-card ${selectedVital === 'bpm' ? 'active-red' : ''}`} onClick={() => setSelectedVital('bpm')}>
              <div className="card-header"><span className="icon">❤️</span><h2>Heart Rate</h2></div>
              <div className="vital-value text-red">{vitals.bpm} <span className="unit">BPM</span></div>
            </div>
            <div className={`vital-card ${selectedVital === 'spo2' ? 'active-blue' : ''}`} onClick={() => setSelectedVital('spo2')}>
              <div className="card-header"><span className="icon">🩸</span><h2>SpO2 Level</h2></div>
              <div className="vital-value text-blue">{vitals.spo2} <span className="unit">%</span></div>
            </div>
            <div className={`vital-card ${selectedVital === 'temperature' ? 'active-orange' : ''}`} onClick={() => setSelectedVital('temperature')}>
              <div className="card-header"><span className="icon">🌡️</span><h2>Body Temp</h2></div>
              <div className="vital-value text-orange">{vitals.temperature} <span className="unit">°C</span></div>
            </div>
            <div className={`vital-card ${selectedVital === 'ecg' ? 'active-purple' : ''}`} onClick={() => setSelectedVital('ecg')}>
              <div className="card-header"><span className="icon">⚡</span><h2>ECG Signal</h2></div>
              <div className="vital-value text-purple" style={{fontSize: '2rem', marginTop: '10px'}}>LIVE <span className="unit">TRACE</span></div>
            </div>
          </div>

          <div className="panel graph-panel">
            <div className="graph-header">
              <h2>{selectedVital.toUpperCase()} REAL-TIME HISTORY</h2>
            </div>
            {history.length === 0 ? (
              <div className="empty-state">Awaiting sensor telemetry from ESP32...</div>
            ) : (
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2f3640" />
                    <XAxis dataKey="time" tick={{fill: '#718093'}} tickMargin={10} stroke="#2f3640" />
                    <YAxis domain={['auto', 'auto']} tick={{fill: '#718093'}} stroke="#2f3640" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e272e', border: '1px solid #485460', color: '#f5f6fa' }} />
                    <Line 
                      type="monotone" 
                      dataKey={selectedVital} 
                      stroke={getGraphColor()} 
                      strokeWidth={3} 
                      dot={selectedVital === 'ecg' ? false : { r: 4, fill: '#1e272e', strokeWidth: 2 }} 
                      activeDot={{ r: 8, fill: getGraphColor() }} 
                      isAnimationActive={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
