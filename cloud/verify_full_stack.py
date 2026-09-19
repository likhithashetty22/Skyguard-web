# cloud/verify_full_stack.py
# Full-stack integration test for SkyGuard AI Cloud Maps UI

import time
import urllib.request
import json
import subprocess
import sys

def verify_stack():
    print("=== SkyGuard AI Full-Stack Verification ===")
    print("[1/3] Starting uvicorn server on http://127.0.0.1:8000 ...")
    
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "cloud.cloud_main:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        # Wait for server to bind
        time.sleep(2.5)

        print("[2/3] Performing HTTP endpoint checks...")

        # 1. Main Welcome / Maps HTML
        req = urllib.request.urlopen("http://127.0.0.1:8000/")
        html = req.read().decode("utf-8")
        assert req.getcode() == 200, "Expected 200 for /"
        assert "Welcome" in html, "HTML missing 'Welcome' title (1.png)"
        assert "karnataka-map" in html, "HTML missing 'karnataka-map' container (3.png)"
        assert "telemetry-data-table" in html, "HTML missing temporal table (4.png)"
        assert "anomaly-diagnosis-card" in html, "HTML missing anomaly diagnosis card (5.png)"
        assert "custom.css" in html, "HTML missing custom.css stylesheet link"
        print("  [PASS] GET / -> 200 OK (Clean HTML with all 1.png-5.png sections)")

        # 2. Base CSS
        css_req = urllib.request.urlopen("http://127.0.0.1:8000/css/cloud.css")
        assert css_req.getcode() == 200
        css_content = css_req.read().decode("utf-8")
        assert "anomaly-mild" in css_content and "anomaly-severe" in css_content
        print(f"  [PASS] GET /css/cloud.css -> 200 OK ({len(css_content)} bytes)")

        # 3. User Custom CSS
        custom_req = urllib.request.urlopen("http://127.0.0.1:8000/css/custom.css")
        assert custom_req.getcode() == 200
        print("  [PASS] GET /css/custom.css -> 200 OK (User Custom CSS Space Active)")

        # 4. JS Application Module
        js_req = urllib.request.urlopen("http://127.0.0.1:8000/js/app.js")
        assert js_req.getcode() == 200
        print("  [PASS] GET /js/app.js -> 200 OK (SPA Router & Controller)")

        # 5. Synthetic AWS Stations API
        api_req = urllib.request.urlopen("http://127.0.0.1:8000/api/stations")
        assert api_req.getcode() == 200
        stations = json.loads(api_req.read().decode("utf-8"))
        assert len(stations) == 5
        print(f"  [PASS] GET /api/stations -> 200 OK (Loaded {len(stations)} Karnataka AWS locations: {[s['name'] for s in stations]})")

        # 6. Shared Static Mount
        shared_req = urllib.request.urlopen("http://127.0.0.1:8000/shared/stations.json")
        assert shared_req.getcode() == 200
        print("  [PASS] GET /shared/stations.json -> 200 OK")

        # 7. Station Temporal Telemetry API
        temp_req = urllib.request.urlopen("http://127.0.0.1:8000/api/stations/agumbe/temporal")
        assert temp_req.getcode() == 200
        temp_data = json.loads(temp_req.read().decode("utf-8"))
        assert len(temp_data) >= 24
        print(f"  [PASS] GET /api/stations/agumbe/temporal -> 200 OK ({len(temp_data)} hourly records)")

        print("\n[3/3] Full stack verification passed with 100% success!")

    finally:
        server_proc.terminate()
        try:
            server_proc.wait(timeout=2)
        except Exception:
            server_proc.kill()
        print("Test server stopped cleanly.")

if __name__ == "__main__":
    verify_stack()
