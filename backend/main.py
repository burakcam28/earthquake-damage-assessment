"""
FastAPI Spatial Backend Service for Earthquake Damage Assessment
"""

import json
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Earthquake Damage Assessment API",
    description="Web-GIS Spatial API delivering building damage GeoJSON vectors",
    version="0.1.0",
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_GEOJSON_PATH = Path(__file__).resolve().parent.parent / "data" / "samples" / "sample_buildings.geojson"


@app.get("/")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "earthquake-damage-assessment-api"}


@app.get("/api/buildings")
def get_buildings() -> Dict[str, Any]:
    """
    Returns damage assessed building polygons as a GeoJSON FeatureCollection.
    Falls back to sample GeoJSON data when PostGIS database is not active.
    """
    if not SAMPLE_GEOJSON_PATH.exists():
        raise HTTPException(status_code=404, detail="Sample GeoJSON data file not found")

    with open(SAMPLE_GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    return data
