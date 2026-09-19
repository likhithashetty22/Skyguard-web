import asyncio
import json
from cloud.cloud_main import (
    app,
    ingest_payload,
    get_analytics,
    trigger_retraining,
    get_model_status,
    WeatherPayload,
    RetrainRequest
)

async def run_tests():
    print("\n--- 1. Testing POST /cloud/ingest (Upstream Relay) ---")
    payload = WeatherPayload(
        location="Agumbe",
        timestamp="2026-09-09T08:00:00Z",
        temperature=27.5,
        pressure=1008.2,
        humidity=94.0,
        is_anomaly=True,
        reconstruction_error=0.0892,
        status="critical",
        rootCause="Sudden pressure drop and temperature surge"
    )
    res = await ingest_payload(payload)
    assert res["status"] == "success"
    assert res["location"] == "Agumbe"
    print(f"[PASS] POST /cloud/ingest successful! Ingested ID: {res['ingested_id']}, Anomaly: {res['is_anomaly']}")

    print("\n--- 2. Testing GET /cloud/analytics (Regional Telemetry) ---")
    analytics = await get_analytics()
    assert "summary" in analytics
    assert "stations" in analytics
    assert "recent_transmissions" in analytics
    print(f"[PASS] GET /cloud/analytics returned 200 OK.")
    print(f"   Total transmissions: {analytics['summary']['total_transmissions']}")
    print(f"   Anomaly count: {analytics['summary']['anomaly_count']}")
    print(f"   Karnataka stations mapped: {list(analytics['stations'].keys())}")

    print("\n--- 3. Testing POST /cloud/retrain (Continuous Learning Pipeline) ---")
    retrain_req = RetrainRequest(
        epochs=15,
        learning_rate=0.01,
        batch_size=16
    )
    retrain_res = await trigger_retraining(retrain_req)
    assert retrain_res["status"] == "success"
    assert len(retrain_res["loss_history"]) == 15
    print(f"[PASS] POST /cloud/retrain executed successfully!")
    print(f"   Model version: {retrain_res['model_version']}")
    print(f"   Loss trajectory: {retrain_res['initial_loss']:.4f} -> {retrain_res['final_loss']:.4f}")
    print(f"   New dynamic threshold: {retrain_res['new_threshold']:.4f}")

    print("\n--- 4. Testing GET /cloud/model-status ---")
    model_res = await get_model_status()
    assert "architecture" in model_res
    print(f"[PASS] GET /cloud/model-status: {model_res['model_name']} ({model_res['version']})")
    print(f"   Architecture: {model_res['architecture']}")

    print("\n=========================================================")
    print("   ALL CLOUD API & RETRAINING TESTS PASSED SUCCESSFULLY! ")
    print("=========================================================\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
