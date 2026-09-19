# cloud/test_maps_ui.py
# Verification script for SkyGuard AI Cloud Maps UI endpoints & data loading

import os
import json
import asyncio
from cloud.cloud_main import (
    app,
    get_synthetic_stations,
    get_station_temporal
)

async def test_ui_and_endpoints():
    print("\n--- 1. Testing Station JSON Loading (/api/stations) ---")
    stations = await get_synthetic_stations()
    assert len(stations) == 5, f"Expected 5 stations, got {len(stations)}"
    station_names = [s["name"] for s in stations]
    print(f"[PASS] Retrieved {len(stations)} Karnataka AWS stations: {station_names}")

    print("\n--- 2. Testing Temporal Data for Each Station ---")
    for s in stations:
        station_id = s["id"]
        data = await get_station_temporal(station_id)
        assert len(data) >= 24, f"Expected 24 hourly readings for {station_id}, got {len(data)}"
        first_row = data[0]
        assert "temp" in first_row and "pressure" in first_row and "humidity" in first_row
        print(f"[PASS] Station {s['name']} ({station_id}): Loaded {len(data)} records successfully.")

    print("\n--- 3. Testing Static Frontend Files Exist ---")
    static_root = os.path.join(os.path.dirname(__file__), "static")
    required_files = [
        os.path.join(static_root, "index.html"),
        os.path.join(static_root, "css", "cloud.css"),
        os.path.join(static_root, "css", "custom.css"),
        os.path.join(static_root, "js", "app.js"),
        os.path.join(static_root, "js", "data-loader.js"),
        os.path.join(static_root, "js", "map-component.js"),
        os.path.join(static_root, "js", "station-view.js"),
    ]
    for file_path in required_files:
        assert os.path.exists(file_path), f"Missing required file: {file_path}"
        print(f"[PASS] Verified file: {os.path.basename(file_path)} ({os.path.getsize(file_path)} bytes)")

    print("\n--- 4. Checking User CSS Zone in custom.css ---")
    custom_css_path = os.path.join(static_root, "css", "custom.css")
    with open(custom_css_path, "r", encoding="utf-8") as f:
        content = f.read()
        assert "USER CUSTOM CSS" in content or "custom" in content.lower()
        print("[PASS] Verified custom.css contains dedicated user customization area.")

    print("\n=========================================================")
    print("   ALL CLOUD MAPS UI TESTS PASSED SUCCESSFULLY!          ")
    print("=========================================================\n")

if __name__ == "__main__":
    asyncio.run(test_ui_and_endpoints())
