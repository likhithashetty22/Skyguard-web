import requests

# Target the POST route in cloud_main.py
URL = "http://127.0.0.1:8000/api/telemetry"

# Test Payload with Anomaly Values
payload = {
    "location": "Bagalkot-Node-1",
    "temperature": 58.0,
    "humidity": 5.0,
    "pressure": 850.0
}

# MUST BE requests.post (Not requests.get)
response = requests.post(URL, json=payload)

print("\n--- CLOUD RESPONSE ---")
print(response.json())