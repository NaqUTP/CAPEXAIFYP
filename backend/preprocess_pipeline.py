"""
preprocess_pipeline.py
Facility-type-aware preprocessing for CAPEX AI RT2026.

Flow:  raw CSV  ->  detect facility type  ->  map headers to canonical cost drivers
       ->  convert units  ->  validate ranges  ->  clean DataFrame (+ report)

Each facility type has its own rulebook (canonical cost drivers), because WHP,
CPP and pipelines genuinely depend on different features. The model learns the
*strength* of each driver during training (feature importance / SHAP); this
module makes sure the right driver columns are present, named and scaled
consistently before that training happens.
"""

import re
import pandas as pd
import numpy as np

# ----------------------------------------------------------------------------
# 1. SCHEMA DEFINITIONS  (the "cost driver rulebook" per facility type)
#    canonical name -> list of accepted raw header aliases (lowercased, loose)
# ----------------------------------------------------------------------------
SCHEMAS = {
    "Pipeline": {
        "features": {
            "Diameter_mm":   ["diameter", "dia", "od", "nominal size", "ppl_size", "size"],
            "Capacity_bpd":  ["capacity", "throughput", "flow", "boe", "bpd"],
            "Length_km":     ["length", "len", "distance", "km"],
        },
        "target_aliases": ["cost", "capex", "price", "mmusd"],
        "units": {  # canonical -> (list of unit hints in the raw header, conversion)
            "Diameter_mm": [("in", 25.4), ("inch", 25.4), ("\"", 25.4)],
            "Length_km":   [("m", 0.001), ("mile", 1.60934), ("mi", 1.60934)],
        },
        "ranges": {  # sanity bounds; rows outside are flagged, not silently dropped
            "Diameter_mm": (10, 2000),
            "Capacity_bpd": (0, 5_000_000),
            "Length_km": (0, 5000),
        },
    },
    "WHP": {  # wellhead platform
        "features": {
            "Water_Depth_m":    ["water depth", "depth", "wtr_dpth", "wd"],
            "Num_Wells":        ["num wells", "wells", "well count", "n_wells", "slots"],
            "Topsides_Weight_t":["topside", "topsides weight", "deck weight"],
            "Jacket_Weight_t":  ["jacket", "jacket weight", "substructure"],
            "Is_Unmanned":      ["unmanned", "manned", "is_unmanned", "normally unmanned"],
            "Remoteness_km":    ["remoteness", "distance to shore", "shore distance"],
        },
        "target_aliases": ["capex", "cost", "mmusd"],
        "units": {
            "Water_Depth_m": [("ft", 0.3048), ("feet", 0.3048)],
            "Topsides_Weight_t": [("kg", 0.001), ("lb", 0.000453592)],
            "Jacket_Weight_t": [("kg", 0.001), ("lb", 0.000453592)],
            "Remoteness_km": [("m", 0.001), ("mile", 1.60934)],
        },
        "ranges": {
            "Water_Depth_m": (0, 500),
            "Num_Wells": (0, 60),
            "Topsides_Weight_t": (0, 60000),
            "Jacket_Weight_t": (0, 60000),
            "Is_Unmanned": (0, 1),
            "Remoteness_km": (0, 2000),
        },
    },
    "CPP": {  # central processing platform
        "features": {
            "Water_Depth_m":       ["water depth", "depth", "wtr_dpth", "wd"],
            "Structure_Type":      ["structure", "structure type", "type", "fcl_kind", "kind"],
            "Slot_Capacity_Gross": ["slot", "slot capacity", "slots", "num wells", "wells"],
            "Design_Life_years":   ["design life", "lifetime", "design_life"],
            "Has_Drilling":        ["drilling", "has_drilling", "drill"],
            "Has_Storage":         ["storage", "has_storage"],
            "Has_Quarter":         ["quarter", "quarters", "has_quarter", "accommodation"],
        },
        "target_aliases": ["capex", "cost", "mmusd"],
        "units": {
            "Water_Depth_m": [("ft", 0.3048), ("feet", 0.3048)],
        },
        "ranges": {
            "Water_Depth_m": (0, 2000),
            "Slot_Capacity_Gross": (0, 80),
            "Design_Life_years": (0, 60),
            "Has_Drilling": (0, 1),
            "Has_Storage": (0, 1),
            "Has_Quarter": (0, 1),
        },
    },
}

# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", str(s).lower()).strip()

# Identifier / metadata columns that must NOT be treated as cost drivers,
# even when they are numeric (years, ids, block/field labels, dates, status).
# A year correlates with cost only through inflation, not engineering, so it
# would inject a spurious driver if kept.
DROP_HINTS = [
    "year", "date", "startup", "sanction", "vintage",
    "id", "identifier", "uid", "guid", "npdid", "api",
    "name", "field", "block", "area", "lease", "complex", "segment",
    "status", "phase", "basis", "source", "operator", "owner name",
    "note", "comment", "remark", "url", "link", "code",
]

def _is_metadata(header: str) -> bool:
    nh = _norm(header)
    for hint in DROP_HINTS:
        # whole-word or clear substring match
        if re.search(rf"\b{re.escape(hint)}\b", nh) or nh == hint:
            return True
    return False

def _to_num(series: pd.Series) -> pd.Series:
    # handle "700, 800" (average), thousands separators, stray text
    def one(v):
        if pd.isna(v):
            return np.nan
        s = str(v)
        parts = [p for p in re.split(r"[;,/]", s) if re.search(r"\d", p)]
        nums = []
        for p in parts:
            p = re.sub(r"[^0-9.\-]", "", p)
            try:
                nums.append(float(p))
            except ValueError:
                pass
        if not nums:
            cleaned = re.sub(r"[^0-9.\-]", "", s)
            try:
                return float(cleaned)
            except ValueError:
                return np.nan
        return sum(nums) / len(nums)
    return series.map(one)

def _match_column(raw_headers, aliases):
    """Return the raw header best matching any alias, or None."""
    normed = {h: _norm(h) for h in raw_headers}
    for h, nh in normed.items():
        for a in aliases:
            if nh == a:                      # exact
                return h
    for h, nh in normed.items():
        for a in aliases:
            if a in nh or nh in a:           # substring
                return h
    return None

# ----------------------------------------------------------------------------
# 2. AUTO-DETECT facility type from the columns present
# ----------------------------------------------------------------------------
def detect_facility_type(df: pd.DataFrame):
    headers = list(df.columns)
    scores = {}
    for ftype, spec in SCHEMAS.items():
        hits = sum(1 for aliases in spec["features"].values()
                   if _match_column(headers, aliases) is not None)
        scores[ftype] = hits / len(spec["features"])
    best = max(scores, key=scores.get)
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return {
        "suggested": best if scores[best] > 0 else None,
        "confidence": round(scores[best], 2),
        "scores": {k: round(v, 2) for k, v in ranked},
    }

# ----------------------------------------------------------------------------
# 3. PREPROCESS according to the chosen facility type
# ----------------------------------------------------------------------------
def preprocess(df: pd.DataFrame, facility_type: str):
    if facility_type not in SCHEMAS:
        raise ValueError(f"Unknown facility type: {facility_type}")
    spec = SCHEMAS[facility_type]
    headers = list(df.columns)
    report = {"facility_type": facility_type, "mapped": {}, "unmapped": [],
              "unit_conversions": [], "flagged_rows": {}, "dropped_no_target": 0,
              "extra_kept": [], "dropped_metadata": []}

    out = pd.DataFrame()

    # ---- map + convert each canonical feature ----
    for canon, aliases in spec["features"].items():
        raw = _match_column(headers, aliases)
        if raw is None:
            report["unmapped"].append(canon)
            continue
        report["mapped"][raw] = canon
        col = _to_num(df[raw]) if canon not in ("Structure_Type",) else df[raw].astype(str)

        # unit conversion driven by hints in the raw header
        if canon in spec.get("units", {}):
            nh = _norm(raw)
            for hint, factor in spec["units"][canon]:
                if re.search(rf"\b{re.escape(hint)}\b", nh):
                    col = col * factor
                    report["unit_conversions"].append(f"{raw}: x{factor} -> {canon}")
                    break
        out[canon] = col

    # ---- target (cost) ----
    tgt_raw = _match_column(headers, spec["target_aliases"])
    target_name = f"CAPEX_MMUSD"
    if tgt_raw is not None:
        report["mapped"][tgt_raw] = target_name
        t = _to_num(df[tgt_raw])
        # scale to MM USD if header looks like plain USD
        if re.search(r"\busd\b", _norm(tgt_raw)) and "mm" not in _norm(tgt_raw):
            if t.median(skipna=True) and t.median(skipna=True) > 10000:
                t = t / 1e6
                report["unit_conversions"].append(f"{tgt_raw}: /1e6 -> {target_name}")
        out[target_name] = t

    # ---- handle unknown columns ----
    # 1) identifiers / metadata (name, year, block, id, status...) are DROPPED,
    #    even if numeric, so they can never act as a spurious cost driver.
    # 2) genuinely unknown *numeric* columns are KEPT as extra__ and flagged,
    #    so a real new driver (e.g. reservoir pressure) is never lost silently.
    # 3) unknown non-numeric text is left out (listed under unmapped).
    known_raw = set(report["mapped"].keys())
    for h in headers:
        if h in known_raw:
            continue
        if _is_metadata(h):
            report["dropped_metadata"].append(h)
            continue
        numeric = _to_num(df[h])
        if numeric.notna().mean() > 0.6:        # mostly numeric -> could be a real driver
            safe = re.sub(r"[^0-9a-zA-Z]+", "_", str(h)).strip("_")
            out[f"extra__{safe}"] = numeric
            report["extra_kept"].append(h)
        else:
            report["unmapped"].append(h)

    # ---- validate ranges (flag, don't silently drop) ----
    for canon, (lo, hi) in spec.get("ranges", {}).items():
        if canon in out.columns:
            bad = ((out[canon] < lo) | (out[canon] > hi)) & out[canon].notna()
            if bad.any():
                report["flagged_rows"][canon] = int(bad.sum())

    # ---- move target to last, drop rows with no target ----
    if target_name in out.columns:
        before = len(out)
        out = out[out[target_name].notna()].copy()
        report["dropped_no_target"] = before - len(out)
        cols = [c for c in out.columns if c != target_name] + [target_name]
        out = out[cols]

    report["final_rows"] = len(out)
    report["final_columns"] = list(out.columns)
    return out, report


# ----------------------------------------------------------------------------
# demo / self-test
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    tests = {
        "Pipelines_training.csv": "Pipeline",
        "CPP_semisynthetic.csv": "CPP",
        "BSEE_Platform_Real_Cost.csv": "WHP",
        "CAPEX_WHP_400rows.csv": "WHP",
    }
    import os
    base = "/mnt/user-data/uploads"
    for fname, expected in tests.items():
        path = os.path.join(base, fname)
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path)
        det = detect_facility_type(df)
        clean, rep = preprocess(df, det["suggested"] or expected)
        print(f"\n=== {fname} ===")
        print(f"  detected: {det['suggested']} (conf {det['confidence']}, expected {expected})")
        print(f"  scores:   {det['scores']}")
        print(f"  mapped:   {rep['mapped']}")
        print(f"  unmapped:  {rep['unmapped']}")
        print(f"  DROPPED (metadata/id/year): {rep['dropped_metadata']}")
        print(f"  units:     {rep['unit_conversions']}")
        print(f"  extra kept (numeric unknowns): {rep['extra_kept']}")
        print(f"  flagged:  {rep['flagged_rows']}")
        print(f"  rows: {rep['final_rows']} | cols: {rep['final_columns']}")
