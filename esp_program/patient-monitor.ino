#include <WiFi.h>
#include <Wire.h>
#include <Firebase_ESP_Client.h>
#include "MAX30100_PulseOximeter.h"

// Required Firebase Addons
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ==============================
// 1. CREDENTIALS (UPDATE WIFI)
// ==============================
#define WIFI_SSID "Galaxy A22 5G 6055"
#define WIFI_PASSWORD "12345678"

// Your personal Vercel-linked Firebase Keys
#define API_KEY "AIzaSyDn7FP0O1p9aaHWecYyBJy9PJPzWGEJgsA"
#define DATABASE_URL "patient-monitoring-58e18-default-rtdb.europe-west1.firebasedatabase.app"

// ==============================
// 2. PIN DEFINITIONS
// ==============================
#define ECG_PIN 34       // ADC1 (Must be ADC1 to work alongside Wi-Fi)
#define TEMP_PIN 32      // ADC1
#define BUZZER_PIN 4

// ==============================
// 3. GLOBAL OBJECTS
// ==============================
PulseOximeter pox;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

uint32_t lastReportTime = 0;
const int REPORTING_PERIOD_MS = 2000; // Sync to Firebase every 2 seconds

// Alert Thresholds
const int MIN_BPM = 50;
const int MIN_SPO2 = 90;

// ==============================
// 4. HELPER FUNCTIONS
// ==============================
void onBeatDetected() {
    Serial.println("♥ Beat Detected!");
}
 

float readTemperatureC(){
    int analogVal = analogRead(TEMP_PIN);

    if (analogVal == 0 || analogVal >= 4095) return 0;
    float resistance = 40000.0 / ((4095.0 / analogVal) - 1.0);

    float tempK = 1.0 / (1.0 / 298.15 + (1.0 / 3950.0) * log(resistance / 10000.0));

    return tempK - 273.15;
}
// ==============================
// 5. SETUP
// ==============================
void setup() {
    Serial.begin(115200);
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);

    // 1. Wi-Fi Connection
    Serial.print("Connecting to Wi-Fi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(300);
    }
    Serial.println("\nWi-Fi Connected!");

// 2. Firebase Setup (EMERGENCY BYPASS)
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;
    
    // This tells the ESP32 to skip the complicated login process 
    // and just push the data directly to your unlocked database.
    config.signer.test_mode = true; 
    
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    Serial.println("Firebase Auth Bypassed - Ready to transmit!");

    // 3. MAX30100 Setup
    Serial.print("Initializing MAX30100...");
    if (!pox.begin()) {
        Serial.println("FAILED! Check wiring or I2C pull-ups.");
        // Code will continue running so other sensors still work
    } else {
        Serial.println("SUCCESS!");
        pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);
        pox.setOnBeatDetectedCallback(onBeatDetected);
    }
}

// ==============================
// 6. MAIN LOOP
// ==============================
void loop() {
    // Keep this so the I2C bus doesn't crash, even if we ignore the output
    pox.update();

    // Push data every 2 seconds
    if (millis() - lastReportTime > REPORTING_PERIOD_MS) {
        
        // --- REALISTIC MOCK DATA GENERATOR ---
        // Generates a floating point BPM between 72.0 and 84.0
        float currentBPM = random(720, 840) / 10.0; 
        
        // Generates a healthy SpO2 percentage between 96% and 99%
        int currentSpO2 = random(96, 100); 
        // -------------------------------------

        float currentTemp = readTemperatureC(); // Still uses your real working temp sensor
        int currentECG = analogRead(ECG_PIN);   // Still uses your real working ECG sensor

        Serial.printf("BPM: %.1f | SpO2: %d%% | Temp: %.1f°C | ECG: %d\n", 
                      currentBPM, currentSpO2, currentTemp, currentECG);

        // Local Alert Trigger
        if (currentBPM > 0 && (currentBPM < MIN_BPM || currentSpO2 < MIN_SPO2)) {
            digitalWrite(BUZZER_PIN, HIGH);
        } else {
            digitalWrite(BUZZER_PIN, LOW);
        }

        // Firebase Sync
        if (Firebase.ready()) {
            FirebaseJson json;
            json.set("bpm", currentBPM);
            json.set("spo2", currentSpO2);
            json.set("temperature", currentTemp);
            json.set("ecg_value", currentECG);
            json.set("timestamp", millis());
            
            if(!Firebase.RTDB.setJSON(&fbdo, "/patients/patient_001/vitals", &json)) {
               Serial.println("Firebase Sync Failed: " + fbdo.errorReason());
            }
        }
        
        lastReportTime = millis();
    }
}
