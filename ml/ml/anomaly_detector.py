import os
import json
import joblib
import numpy as np
import pandas as pd

from preprocess import load_dataset, prepare_features


MODEL_DIR = os.path.join(
    os.path.dirname(__file__),
    "models"
)

MODEL_PATH = os.path.join(
    MODEL_DIR,
    "skyguard_isolation_forest"
)

SCALER_PATH = os.path.join(
    MODEL_DIR,
    "skyguard_feature_scaler.joblib"
)

FEATURE_COLUMNS_PATH = os.path.join(
    MODEL_DIR,
    "skyguard_feature_columns.joblib"
)


def load_models():

    print("Loading Isolation Forest...")

    model = joblib.load(MODEL_PATH)

    print("Loading feature scaler...")

    scaler = joblib.load(SCALER_PATH)

    print("Loading feature columns...")

    feature_columns = joblib.load(
        FEATURE_COLUMNS_PATH
    )

    print("Feature columns:")
    print(feature_columns)

    return model, scaler, feature_columns


def run_detection(input_file: str):

    model, scaler, feature_columns = load_models()

    df = load_dataset(input_file)

    df = prepare_features(df)

    # Make sure every model feature exists
    for feature in feature_columns:

        if feature not in df.columns:

            raise ValueError(
                f"Required model feature '{feature}' "
                f"does not exist in dataset."
            )

    X = df[feature_columns].copy()

    # Replace infinities
    X = X.replace(
        [np.inf, -np.inf],
        np.nan
    )

    X = X.fillna(0)

    # Scale exactly as the teacher model expects
    X_scaled = scaler.transform(X)

    # Isolation Forest
    predictions = model.predict(X_scaled)

    anomaly_scores = model.decision_function(
        X_scaled
    )

    df["ml_prediction"] = predictions

    df["anomaly_score"] = anomaly_scores

    # Isolation Forest:
    # +1 = normal
    # -1 = anomaly
    df["ml_status"] = np.where(
        predictions == -1,
        "anomaly",
        "normal"
    )

    # Convert score to a convenient 0-100 confidence-like value
    # This is NOT a calibrated probability.
    score_min = anomaly_scores.min()
    score_max = anomaly_scores.max()

    if score_max != score_min:

        normalized = (
            (anomaly_scores - score_min)
            /
            (score_max - score_min)
        )

        df["anomaly_strength"] = (
            1 - normalized
        ) * 100

    else:

        df["anomaly_strength"] = 0

    return df


def save_results(df, output_file):

    # Convert timestamps to strings for JSON compatibility
    export_df = df.copy()

    if "timestamp" in export_df.columns:

        export_df["timestamp"] = (
            export_df["timestamp"]
            .astype(str)
        )

    export_df.to_csv(
        output_file,
        index=False
    )

    print()
    print("=" * 60)
    print("SKYGUARD AI — ISOLATION FOREST RESULTS")
    print("=" * 60)

    print(
        f"Total readings : {len(export_df)}"
    )

    print(
        f"Anomalies      : "
        f"{(export_df['ml_status'] == 'anomaly').sum()}"
    )

    print(
        f"Normal readings: "
        f"{(export_df['ml_status'] == 'normal').sum()}"
    )

    print(
        f"Output saved   : {output_file}"
    )


if __name__ == "__main__":

    import sys

    if len(sys.argv) < 2:

        print(
            "Usage:"
        )

        print(
            "python anomaly_detector.py "
            "data/august_2026.csv"
        )

        sys.exit(1)

    input_file = sys.argv[1]

    output_file = os.path.join(
        os.path.dirname(input_file),
        "detected_output.csv"
    )

    result = run_detection(
        input_file
    )

    save_results(
        result,
        output_file
    )
