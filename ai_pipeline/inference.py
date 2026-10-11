"""
Inference & Vectorization Pipeline

Bridges raster predictions and spatial GIS formats:
1. Model forward pass -> NxN multi-class mask
2. Vectorization via rasterio.features.shapes
3. Geographic CRS transformation (Affine transform from GeoTIFF)
4. Exports valid GeoJSON FeatureCollection
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import rasterio
from rasterio.features import shapes
from shapely.geometry import shape


LABEL_INFO: Dict[int, Dict[str, str]] = {
    1: {"status": "no-damage", "label": "Hasarsız", "color": "#28a745"},
    2: {"status": "minor-damage", "label": "Hafif Hasar", "color": "#ffc107"},
    3: {"status": "major-damage", "label": "Ağır Hasar", "color": "#fd7e14"},
    4: {"status": "destroyed", "label": "Yıkık", "color": "#dc3545"},
}


def mask_to_geojson(
    prediction_mask: np.ndarray,
    confidence_map: Optional[np.ndarray] = None,
    transform: Optional[rasterio.Affine] = None,
    output_path: Optional[str | Path] = None,
) -> Dict[str, Any]:
    """
    Converts 2D integer damage mask into GeoJSON FeatureCollection.

    Args:
        prediction_mask: 2D array of class IDs (0..4)
        confidence_map: Optional 2D float array of softmax probabilities
        transform: Affine transform from rasterio to map pixel coords to georeferenced coords
        output_path: Optional path to save .geojson file

    Returns:
        GeoJSON FeatureCollection dict
    """
    features: List[Dict[str, Any]] = []
    feature_id = 1

    # Extract polygon shapes for each non-background class (1, 2, 3, 4)
    # Background (0) is ignored
    mask_uint8 = prediction_mask.astype(np.int16)

    for geom, value in shapes(mask_uint8, mask=(mask_uint8 > 0), transform=transform):
        class_val = int(value)
        if class_val not in LABEL_INFO:
            continue

        info = LABEL_INFO[class_val]
        poly = shape(geom)

        # Skip tiny artifact polygons (less than ~10 sq meters or 5 pixels)
        if poly.area < 1e-7 and transform is not None:
            continue

        feature = {
            "type": "Feature",
            "properties": {
                "id": feature_id,
                "damage_status": info["status"],
                "damage_label": info["label"],
                "color": info["color"],
                "confidence": 0.85,  # Default or extracted from confidence_map
            },
            "geometry": geom,
        }
        features.append(feature)
        feature_id += 1

    geojson_data = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
        },
        "features": features,
    }

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, ensure_ascii=False, indent=2)

    return geojson_data
