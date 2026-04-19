import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './App.css';

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Dashboard & History State
  const [vitals, setVitals] = useState({ bpm: 0, spo2: 0, temperature: 0, ecg: 0 });
  const [history, setHistory] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [selectedVital, setSelectedVital] = useState('bpm');
  const [showHistoryPage, setShowHistoryPage] = useState(false);
  
  // Gemini AI State
  const [aiAssessment, setAiAssessment] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Dynamic Alerts State
  const [alerts, setAlerts] = useState([
    { id: 0, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: "System Armed. Awaiting Telemetry...", type: "info" }
  ]);
  const lastAlertMsg = useRef(""); // Prevents spamming the same alert

  const patientInfo = {
    name: "Revanth",
    age: 45,
    bloodType: "O+",
    doctor: "Dr. Smith",
    status: "Post-Surgery Recovery",
    phone: "919876543210" // Update this to test the WhatsApp button
  };

  // ==========================================
  // REAL FIREBASE CONNECTION & ALERT LOGIC
  // ==========================================
  useEffect(() => {
    if (!isAuthenticated) return;

    const patientRef = ref(db, 'patients/patient_001');

    const unsubscribe = onValue(patientRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const vitalsData = data.vitals || {};
        
        // 1. Check for AI String (if written externally, though we now do it locally)
        if (data.ai_assessment) {
          setAiAssessment(data.ai_assessment);
        }

        // 2. Set UI Data
        setVitals({
          bpm: vitalsData.bpm || 0,
          spo2: vitalsData.spo2 || 0,
          temperature: vitalsData.temperature || 0,
          ecg: vitalsData.ecg_value || 0
        });

        // 3. --- DYNAMIC ANOMALY ENGINE ---
        let newAlert = null;
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Flatline / Disconnect Check
        if (vitalsData.bpm === 0 || vitalsData.spo2 === 0) {
          newAlert = { id: Date.now(), time: timeNow, msg: `CRITICAL: Sensor Disconnected / Flatline Detected!`, type: "warning" };
        } 
        // Threshold Checks
        else if (vitalsData.bpm < 50) {
          newAlert = { id: Date.now(), time: timeNow, msg: `CRITICAL: Bradycardia detected (${vitalsData.bpm} BPM)`, type: "warning" };
        } else if (vitalsData.bpm > 100) {
          newAlert = { id: Date.now(), time: timeNow, msg: `WARNING: Tachycardia detected (${vitalsData.bpm} BPM)`, type: "warning" };
        } else if (vitalsData.spo2 < 90) {
          newAlert = { id: Date.now(), time: timeNow, msg: `CRITICAL: Hypoxia risk. SpO2 dropped to ${vitalsData.spo2}%`, type: "warning" };
        } else if (vitalsData.temperature >= 38.0) {
          newAlert = { id: Date.now(), time: timeNow, msg: `WARNING: Febrile temp detected (${vitalsData.temperature}°C)`, type: "warning" };
        } else if (vitalsData.ecg_value < 100 || vitalsData.ecg_value > 4000) {
          newAlert = { id: Date.now(), time: timeNow, msg: `WARNING: Abnormal ECG Signal / Lead Off`, type: "warning" };
        }

        // Trigger Auto-Telegram and UI Update if it's a new emergency
        if (newAlert && newAlert.msg !== lastAlertMsg.current) {
          setAlerts(prev => [newAlert, ...prev].slice(0, 8)); // Keep top 8
          lastAlertMsg.current = newAlert.msg;

          // Replace with your actual Telegram credentials for the demo!
          if (newAlert.type === "warning") {
            const botToken = "8299395983:AAGB8vCw5oNjx6Uu9h-j-TCZ48pWHkiw5CE"; 
            const chatId = "1641684763";
            const alertText = `🚨 URGENT ICU ALERT: \n${newAlert.msg}\nPatient: ${patientInfo.name}`;
            
            // Only fire if tokens are filled out to prevent console errors
            if (botToken !== "1641684763") {
              fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(alertText)}`)
                .catch(err => console.error("Failed to send auto-alert", err));
            }
          }
        }

        // 4. Update Graphs & History
        const newPoint = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          bpm: vitalsData.bpm || 0,
          spo2: vitalsData.spo2 || 0,
          temperature: vitalsData.temperature || 0,
          ecg: vitalsData.ecg_value || 0
        };

        setHistory(prevHistory => {
          const updatedHistory = [...prevHistory, newPoint];
          if (updatedHistory.length > 20) updatedHistory.shift();
          return updatedHistory;
        });

        setSessionHistory(prev => [newPoint, ...prev]);
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);
  // ==========================================

  // ==========================================
  // GEMINI AI ENGINE
  // ==========================================
  const generateAIAssessment = async () => {
    setIsAnalyzing(true);
    try {
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY); 
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are an expert ICU AI assistant. Analyze these current patient vitals:
      Heart Rate: ${vitals.bpm} BPM
      Blood Oxygen: ${vitals.spo2}%
      Body Temperature: ${vitals.temperature}°C
      
      Write a concise, professional 2-sentence medical assessment of the patient's current status based on these numbers. Keep it clinical and direct. Do not use markdown formatting.`;

      const result = await model.generateContent(prompt);
      setAiAssessment(result.response.text());
    } catch (error) {
      console.error(error);
      setAiAssessment("Error connecting to Gemini AI. Please check your API key in the .env file.");
    }
    setIsAnalyzing(false);
  };

  // ==========================================
  // WHATSAPP MANUAL MESSAGING
  // ==========================================
  const sendPatientMessage = () => {
    const text = `URGENT ALERT from ICU Monitor: \nPatient ${patientInfo.name} requires attention. \nCurrent Vitals: \n❤️ ${vitals.bpm} BPM \n🩸 ${vitals.spo2}% SpO2 \n🌡️ ${vitals.temperature}°C \n\nPlease log into the portal immediately.`;
    const url = `https://wa.me/${patientInfo.phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

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
              <input type="password" value={pinCode} onChange={(e) => setPinCode(e.target.value)} placeholder="Enter 4-digit PIN (1234)" autoFocus />
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
            <button onClick={() => setShowHistoryPage(false)} className="action-btn back-btn">← Back to Dashboard</button>
          </div>
        </nav>

        <div className="table-container">
          <div className="table-wrapper">
            <table className="vitals-table">
              <thead>
                <tr>
                  <th>Timestamp</th><th>Heart Rate (BPM)</th><th>Blood Oxygen (SpO2%)</th><th>Body Temp (°C)</th><th>ECG Signal (RAW)</th>
                </tr>
              </thead>
              <tbody>
                {sessionHistory.length === 0 ? (
                  <tr><td colSpan="5" className="empty-row">No session data recorded yet.</td></tr>
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
          <button onClick={() => setShowHistoryPage(true)} className="action-btn history-btn">📋 View History</button>
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
            
            <button 
              onClick={sendPatientMessage} 
              className="action-btn" 
              style={{ width: '100%', margin: '15px 0 0 0', backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '10px' }}
            >
              💬 Message Patient / Contact
            </button>
          </div>

          <div className="panel ai-panel" style={{ marginTop: '1.5rem', border: '1px solid var(--neon-purple)' }}>
            <h3 style={{ color: 'var(--neon-purple)', margin: '0 0 10px 0' }}>✨ AI Health Assistant</h3>
            <button onClick={generateAIAssessment} disabled={isAnalyzing} className="action-btn" style={{ width: '100%', margin: '0', backgroundColor: 'var(--neon-purple)', color: '#fff', padding: '10px' }}>
              {isAnalyzing ? "Analyzing Vitals..." : "Generate AI Assessment"}
            </button>
            {aiAssessment && (
              <div style={{ marginTop: '15px', fontSize: '0.9rem', lineHeight: '1.5', padding: '12px', backgroundColor: 'rgba(165, 94, 234, 0.1)', borderRadius: '8px', borderLeft: '3px solid var(--neon-purple)' }}>
                {aiAssessment}
              </div>
            )}
          </div>

          <div className="panel alert-log" style={{ marginTop: '1.5rem', maxHeight: '250px', overflowY: 'auto' }}>
            <h3>Anomaly Detection Log</h3>
            <ul>
              {alerts.map(alert => (
                <li key={alert.id} className={`alert-item ${alert.type}`} style={{ padding: '8px 0', borderBottom: '1px solid #2f3640' }}>
                  <span className="alert-time" style={{ display: 'block', fontSize: '0.75rem', color: '#718093' }}>{alert.time}</span>
                  <span className="alert-msg" style={{ fontSize: '0.9rem', color: alert.type === 'warning' ? '#ff4757' : '#f5f6fa' }}>
                    {alert.msg}
                  </span>
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
                    <Line type="monotone" dataKey={selectedVital} stroke={getGraphColor()} strokeWidth={3} dot={selectedVital === 'ecg' ? false : { r: 4, fill: '#1e272e', strokeWidth: 2 }} activeDot={{ r: 8, fill: getGraphColor() }} isAnimationActive={false} />
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
