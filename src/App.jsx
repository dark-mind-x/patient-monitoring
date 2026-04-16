import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [vitals, setVitals] = useState({ bpm: 0, spo2: 0, temperature: 0, ecg: 0 });
  const [history, setHistory] = useState([]);
  const [selectedVital, setSelectedVital] = useState('bpm');
  
  // --- NEW: High-Speed ECG Wave State ---
  const [ecgWave, setEcgWave] = useState(Array(60).fill({ time: 0, value: 0 }));

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

  // 1. FIREBASE CONNECTION (For real numbers)
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

        setHistory(prevHistory => {
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            bpm: newData.bpm,
            spo2: newData.spo2,
            temperature: newData.temperature
          };
          const updatedHistory = [...prevHistory, newPoint];
          if (updatedHistory.length > 20) updatedHistory.shift(); 
          return updatedHistory;
        });
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // 2. HIGH-SPEED ECG ANIMATOR (For the hospital wave graphic)
  useEffect(() => {
    if (!isAuthenticated) return;

    // This array represents the shape of one human heartbeat (P, QRS, T wave)
    const ecgPattern = [
      0, 0, 0, 5, 12, 5, 0, 0, -8, 85, -20, 0, 0, 10, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let tick = 0;

    const ecgInterval = setInterval(() => {
      setEcgWave(prev => {
        const newWave = [...prev];
        newWave.shift(); // Remove oldest point
        
        // Add tiny random noise to make it look organic and real
        const noise = Math.random() * 4 - 2; 
        const nextValue = ecgPattern[tick % ecgPattern.length] + noise;
        
        newWave.push({ time: Date.now(), value: nextValue });
        tick++;
        return newWave;
      });
    }, 50); // Runs 20 times per second for smooth animation

    return () => clearInterval(ecgInterval);
  }, [isAuthenticated]);

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
              <input type="password" value={pinCode} onChange={(e) => setPinCode(e.target.value)} placeholder="Enter 4-digit PIN (1234)" autoFocus />
            </div>
            {loginError && <div className="error-message">Invalid PIN. Access Denied.</div>}
            <button type="submit" className="login-button">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

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
              <div className="vital-value text-purple">{vitals.ecg} <span className="unit">RAW</span></div>
            </div>
          </div>

          <div className="panel graph-panel">
            <div className="graph-header">
              <h2>{selectedVital === 'ecg' ? 'LIVE ECG TRACE' : `${selectedVital.toUpperCase()} REAL-TIME HISTORY`}</h2>
            </div>
            
            <div style={{ width: '100%', height: 350 }}>
              {selectedVital === 'ecg' ? (
                // ==========================================
                // THE NEW HIGH-SPEED ECG GRAPH
                // ==========================================
                <ResponsiveContainer>
                  <LineChart data={ecgWave}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2f3640" />
                    {/* Hide the axes so it looks like a clean oscilloscope trace */}
                    <YAxis domain={[-30, 100]} hide={true} />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#a55eea" 
                      strokeWidth={3} 
                      dot={false} 
                      isAnimationActive={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                // ==========================================
                // STANDARD HISTORY GRAPH (BPM, SPO2, TEMP)
                // ==========================================
                history.length === 0 ? (
                  <div className="empty-state">Awaiting sensor telemetry from ESP32...</div>
                ) : (
                  <ResponsiveContainer>
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2f3640" vertical={false} />
                      <XAxis dataKey="time" tick={{fill: '#718093'}} tickMargin={10} stroke="#2f3640" />
                      <YAxis domain={['auto', 'auto']} tick={{fill: '#718093'}} stroke="#2f3640" />
                      <Tooltip contentStyle={{ backgroundColor: '#1e272e', border: '1px solid #485460', color: '#f5f6fa' }} />
                      <Line type="monotone" dataKey={selectedVital} stroke={getGraphColor()} strokeWidth={4} dot={{ r: 4, fill: '#1e272e', strokeWidth: 2 }} activeDot={{ r: 8, fill: getGraphColor() }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
