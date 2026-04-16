import time
import requests
from sklearn.neural_network import MLPClassifier
import numpy as np

# Your Firebase Database URL
FIREBASE_URL = "https://patient-monitoring-58e18-default-rtdb.europe-west1.firebasedatabase.app/patients/patient_001.json"

print("🧠 Initializing Neural Network...")

# 1. THE TRAINING DATA
# Features: [BPM, SpO2, Temperature]
X_train = np.array([
    [75, 98, 36.5],  # Perfect vitals
    [82, 97, 37.0],  # Normal vitals
    [115, 94, 38.2], # Elevated/Fever
    [55, 95, 36.0],  # Low heart rate
    [140, 88, 39.5], # Critical High
    [40, 85, 35.0],  # Critical Low
])

# Labels: 0 = Normal, 1 = Warning, 2 = Critical
y_train = np.array([0, 0, 1, 1, 2, 2])

# 2. BUILD AND TRAIN THE NEURAL NETWORK
# Multi-Layer Perceptron with 2 hidden layers (10 neurons and 5 neurons)
nn_model = MLPClassifier(hidden_layer_sizes=(10, 5), max_iter=1000, random_state=42)
nn_model.fit(X_train, y_train)

print("✅ Neural Network Trained! Connecting to Firebase...\n")

def get_diagnosis_string(prediction):
    if prediction == 0:
        return "Patient is Stable. Vitals are within normal operating parameters."
    elif prediction == 1:
        return "WARNING: Abnormal vitals detected. Check patient for fever or irregular pulse."
    else:
        return "CRITICAL ALERT: Vitals indicate severe danger. Immediate intervention required!"

last_timestamp = 0

# 3. THE MONITORING LOOP
while True:
    try:
        # Get live data from Firebase
        response = requests.get(FIREBASE_URL)
        data = response.json()

        if data and 'vitals' in data:
            vitals = data['vitals']
            current_timestamp = vitals.get('timestamp', 0)

            # Only run the AI if new data has arrived
            if current_timestamp != last_timestamp:
                bpm = vitals.get('bpm', 0)
                spo2 = vitals.get('spo2', 0)
                temp = vitals.get('temperature', 0)

                if bpm > 0: # Ensure sensor is actually reading
                    # Feed live data into the Neural Network
                    live_data = np.array([[bpm, spo2, temp]])
                    prediction = nn_model.predict(live_data)[0]
                    
                    assessment = get_diagnosis_string(prediction)
                    print(f"[{time.strftime('%H:%M:%S')}] AI Prediction: {assessment}")

                    # Push the AI assessment back to Firebase
                    patch_url = "https://patient-monitoring-58e18-default-rtdb.europe-west1.firebasedatabase.app/patients/patient_001.json"
                    requests.patch(patch_url, json={"ai_assessment": assessment})

                last_timestamp = current_timestamp

        time.sleep(2) # Wait 2 seconds before checking again to match ESP32

    except Exception as e:
        print(f"Network Error: {e}")
        time.sleep(5)
