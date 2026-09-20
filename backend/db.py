import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "capex.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp    TEXT NOT NULL,
            dataset      TEXT,
            model        TEXT,
            inputs       TEXT,
            predicted    REAL,
            grand_total  REAL,
            app_version  TEXT
        )
    """)
    conn.commit()
    conn.close()

def log_prediction(dataset, model, inputs, predicted, grand_total, app_version="v1.0"):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO predictions (timestamp, dataset, model, inputs, predicted, grand_total, app_version) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (datetime.now(timezone.utc).isoformat(), dataset, model,
         json.dumps(inputs), predicted, grand_total, app_version)
    )
    conn.commit()
    conn.close()

def get_predictions(limit=100):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM predictions ORDER BY timestamp DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]