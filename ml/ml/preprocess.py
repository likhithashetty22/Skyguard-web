import pandas as pd
import numpy as np


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize common AWS dataset column names into SkyGuard names.
    """

    rename_map = {}

    for col in df.columns:
        c = str(col).strip().lower()

        if c in ["temperature", "temp", "temperature (°c)", "temperature_c"]:
            rename_map[col] = "temp"

        elif c in [
            "relative humidity",
            "relative_humidity",
            "humidity",
            "rh",
            "relative humidity (%)"
        ]:
            rename_map[col] = "humidity"

        elif c in [
            "pressure",
            "atmospheric pressure",
            "atmospheric_pressure",
            "pressure (hpa)",
            "pressure_hpa"
        ]:
            rename_map[col] = "pressure"

        elif c in [
            "station",
            "station name",
            "station_name",
            "aws",
            "aws station"
        ]:
            rename_map[col] = "station"

        elif c in [
            "timestamp",
            "datetime",
            "date time",
            "date_time",
            "time"
        ]:
            rename_map[col] = "timestamp"

    df = df.rename(columns=rename_map)

    return df


def load_dataset(path: str) -> pd.DataFrame:

    if path.lower().endswith(".csv"):
        df = pd.read_csv(path)

    elif path.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(path)

    else:
        raise ValueError(
            "Unsupported file format. Use CSV or Excel."
        )

    df = normalize_columns(df)

    required = ["temp", "humidity", "pressure"]

    missing = [
        column for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Dataset is missing required columns: {missing}\n"
            f"Available columns: {list(df.columns)}"
        )

    return df


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()

    # Convert meteorological columns to numbers
    for column in ["temp", "humidity", "pressure"]:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )

    # Remove unusable rows
    df = df.dropna(
        subset=["temp", "humidity", "pressure"]
    ).copy()

    # Sort chronologically when timestamp exists
    if "timestamp" in df.columns:

        df["timestamp"] = pd.to_datetime(
            df["timestamp"],
            errors="coerce"
        )

        df = df.sort_values("timestamp")

    # Calculate temporal features per station
    if "station" in df.columns:

        grouped = df.groupby("station")

        df["temp_delta"] = grouped["temp"].diff().abs()
        df["humidity_delta"] = grouped["humidity"].diff().abs()
        df["pressure_delta"] = grouped["pressure"].diff().abs()

    else:

        df["temp_delta"] = df["temp"].diff().abs()
        df["humidity_delta"] = df["humidity"].diff().abs()
        df["pressure_delta"] = df["pressure"].diff().abs()

    # First reading of a station has no previous reading
    df["temp_delta"] = df["temp_delta"].fillna(0)
    df["humidity_delta"] = df["humidity_delta"].fillna(0)
    df["pressure_delta"] = df["pressure_delta"].fillna(0)

    # Simple dew point approximation
    dew_point = (
        df["temp"] -
        ((100 - df["humidity"]) / 5)
    )

    if "station" in df.columns:

        df["dew_point_delta"] = (
            dew_point
            .groupby(df["station"])
            .diff()
            .abs()
            .fillna(0)
        )

    else:

        df["dew_point_delta"] = (
            dew_point.diff()
            .abs()
            .fillna(0)
        )

    return df
