1   import { useState, useEffect } from 'react';                                                                                                                         
  1 import { ref, onValue } from 'firebase/database';
  2 import { db } from './firebase';
  3 import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
  4 import './App.css';
  5 
  6 function App() {
  7   // Authentication State
  8   const [isAuthenticated, setIsAuthenticated] = useState(false);
  9   const [pinCode, setPinCode] = useState('');
 10   const [loginError, setLoginError] = useState(false);
 11 
 12   // Dashboard State
 13   const [vitals, setVitals] = useState({ bpm: 75, spo2: 98, temperature: 36.5 });
 14   const [history, setHistory] = useState([]);
 15   const [selectedVital, setSelectedVital] = useState('bpm');
 16 
 17   const patientInfo = {
 18     name: "John Doe",
 19     age: 45,
 20     bloodType: "O+",
 21     doctor: "Dr. Smith",
 22     status: "Post-Surgery Recovery"
 23   };
 24 
 25   const recentAlerts = [
 26     { id: 1, time: "10:42 AM", msg: "SpO2 dropped below 92%", type: "warning" },
 27     { id: 2, time: "09:15 AM", msg: "System online & calibrated", type: "info" },
 28   ];
 29 
 30   // ==========================================
 31   // SAFE MOCK DATA GENERATOR (FOR SCREENSHOTS)
 32   // ==========================================
 NORMAL  App.jsx                                                                                        javascriptreact     utf-8    0% ㏑: 1/205≡℅:1  ☲ [45]trailing 
"App.jsx" 205L, 8441B

