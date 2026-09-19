import sqlite3
import numpy as np
import torch
import torch.nn as nn
import joblib
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
import os

# 1. Autoencoder Architecture
class WeatherAutoencoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(3, 2),
            nn.ReLU()
        )
        self.decoder = nn.Sequential(
            nn.Linear(2, 3)
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

# 2. Load Model Weights and Scaler
model = WeatherAutoencoder()
model.load_state_dict(torch.load("weather_autoencoder.pth"))
model.eval()

scaler = joblib.load("scaler.pkl")
ANOMALY_THRESHOLD = 0.5

# 3. Database Initialization
DB_NAME = "cloud_data.sqlite"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            location TEXT,
            temperature REAL,
            humidity REAL,
            pressure REAL,
            reconstruction_error REAL,
            is_anomaly INTEGER
        )
    """)
    conn.commit()
    conn.close()

init_db()

# 4. FastAPI Setup
app = FastAPI(title="SkyGuard Cloud Backend")

# Mount static folder for frontend UI (CSS, JS, assets)
# Checks both "cloud/static" and "static" path configurations
STATIC_DIR = "cloud/static" if os.path.exists("cloud/static") else "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

class TelemetryPayload(BaseModel):
    location: str = "Sensor-Node-1"
    temperature: float
    humidity: float
    pressure: float

# Serve Dashboard HTML at Root Path
@app.get("/")
def read_root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_path)

# Telemetry POST Ingestion Endpoint
@app.post("/api/telemetry")
def process_telemetry(payload: TelemetryPayload):
    raw_data = np.array([[payload.temperature, payload.humidity, payload.pressure]])
    scaled_data = scaler.transform(raw_data)
    tensor_input = torch.tensor(scaled_data, dtype=torch.float32)

    with torch.no_grad():
        reconstructed = model(tensor_input)
        mse_loss = nn.functional.mse_loss(reconstructed, tensor_input).item()

    is_anomaly = int(mse_loss > ANOMALY_THRESHOLD)

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO telemetry (timestamp, location, temperature, humidity, pressure, reconstruction_error, is_anomaly)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (datetime.utcnow().isoformat(), payload.location, payload.temperature, payload.humidity, payload.pressure, mse_loss, is_anomaly))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "reconstruction_error": round(mse_loss, 4),
        "is_anomaly": bool(is_anomaly),
        "threshold": ANOMALY_THRESHOLD
    }

# Status Verification Route
@app.get("/api/telemetry/status")
def telemetry_status():
    return {"status": "Cloud receiver active"}

# Telemetry History Endpoint
@app.get("/api/telemetry/recent")
def get_recent_telemetry(limit: int = 20):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM telemetry ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r[0],
            "timestamp": r[1],
            "location": r[2],
            "temperature": r[3],
            "humidity": r[4],
            "pressure": r[5],
            "reconstruction_error": r[6],
            "is_anomaly": bool(r[7])
        } for r in rows
    ]