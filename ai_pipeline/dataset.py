"""
xBD / Satellite Building Damage Assessment Dataset Loader

xView2 (xBD) dataset standard:
- Pre-disaster image:  {prefix}_pre_disaster.png
- Post-disaster image: {prefix}_post_disaster.png
- Labels:              {prefix}_post_disaster.json

Damage Classes:
0: Background (No building)
1: No Damage (Hasarsız)
2: Minor Damage (Hafif Hasar)
3: Major Damage (Ağır Hasar)
4: Destroyed (Yıkık)
"""

import json
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset
from shapely.wkt import loads as load_wkt


DAMAGE_MAPPING: Dict[str, int] = {
    "un-classified": 1,
    "no-damage": 1,
    "minor-damage": 2,
    "major-damage": 3,
    "destroyed": 4,
}


class XBDDataset(Dataset):
    """
    PyTorch Dataset for paired pre- and post-disaster satellite imagery.
    """

    def __init__(
        self,
        images_dir: str | Path,
        labels_dir: Optional[str | Path] = None,
        transform: Optional[Callable] = None,
        img_size: int = 1024,
    ) -> None:
        self.images_dir = Path(images_dir)
        self.labels_dir = Path(labels_dir) if labels_dir else None
        self.transform = transform
        self.img_size = img_size

        # Find all post-disaster images
        self.post_images = sorted(list(self.images_dir.glob("*_post_disaster.png")))

    def __len__(self) -> int:
        return len(self.post_images)

    def _load_mask_from_json(self, json_path: Path, height: int, width: int) -> np.ndarray:
        mask = np.zeros((height, width), dtype=np.uint8)
        if not json_path.exists():
            return mask

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        features = data.get("features", {}).get("xy", [])
        for feat in features:
            properties = feat.get("properties", {})
            subtype = properties.get("subtype", "no-damage")
            class_idx = DAMAGE_MAPPING.get(subtype, 1)

            wkt_str = feat.get("wkt")
            if not wkt_str:
                continue

            try:
                geom = load_wkt(wkt_str)
                if geom.geom_type == "Polygon":
                    coords = np.array(geom.exterior.coords, dtype=np.int32)
                    cv2.fillPoly(mask, [coords], class_idx)
                elif geom.geom_type == "MultiPolygon":
                    for poly in geom.geoms:
                        coords = np.array(poly.exterior.coords, dtype=np.int32)
                        cv2.fillPoly(mask, [coords], class_idx)
            except Exception:
                continue

        return mask

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        post_path = self.post_images[idx]
        pre_path = Path(str(post_path).replace("_post_disaster.png", "_pre_disaster.png"))

        # Load RGB images
        pre_img = cv2.imread(str(pre_path))
        if pre_img is None:
            raise FileNotFoundError(f"Pre-disaster image not found: {pre_path}")
        pre_img = cv2.cvtColor(pre_img, cv2.COLOR_BGR2RGB)

        post_img = cv2.imread(str(post_path))
        if post_img is None:
            raise FileNotFoundError(f"Post-disaster image not found: {post_path}")
        post_img = cv2.cvtColor(post_img, cv2.COLOR_BGR2RGB)

        h, w, _ = post_img.shape

        # Load mask if labels_dir provided
        if self.labels_dir:
            json_filename = post_path.name.replace(".png", ".json")
            json_path = self.labels_dir / json_filename
            mask = self._load_mask_from_json(json_path, h, w)
        else:
            mask = np.zeros((h, w), dtype=np.uint8)

        # Apply Albumentations or custom transform
        if self.transform is not None:
            augmented = self.transform(image=pre_img, post_image=post_img, mask=mask)
            pre_img = augmented["image"]
            post_img = augmented.get("post_image", post_img)
            mask = augmented["mask"]

        # Convert to Tensor (C, H, W) normalized to [0, 1]
        pre_tensor = torch.from_numpy(pre_img.transpose(2, 0, 1)).float() / 255.0
        post_tensor = torch.from_numpy(post_img.transpose(2, 0, 1)).float() / 255.0
        mask_tensor = torch.from_numpy(mask).long()

        return pre_tensor, post_tensor, mask_tensor
