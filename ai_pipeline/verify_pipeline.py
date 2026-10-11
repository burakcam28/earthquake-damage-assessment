"""
Verification & Test Script for Earthquake Damage AI Pipeline

Performs an end-to-end sanity check:
1. Instantiates the SiameseUNet model
2. Simulates (or loads) a pair of pre- and post-disaster satellite images
3. Runs forward pass through SiameseUNet
4. Verifies output tensor shape: (Batch, 5, Height, Width)
5. Tests the loss function (Focal + Dice Loss)
6. Tests raster-to-GeoJSON vectorization
"""

import sys
from pathlib import Path
import torch
import numpy as np

# Ensure ai_pipeline is importable
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from ai_pipeline.models.siamese_unet import SiameseUNet
from ai_pipeline.losses import DamageAssessmentLoss
from ai_pipeline.inference import mask_to_geojson


def run_pipeline_check():
    print("=" * 60)
    print("🛰️  Deprem Hasar Tespiti Yapay Zekâ Boru Hattı Testi")
    print("=" * 60)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[1/4] Kullanılan Donanım: {device}")

    # 1. Model Başlatma
    print("[2/4] Siamese U-Net Modeli Yükleniyor...")
    model = SiameseUNet(in_channels=3, num_classes=5, base_channels=32).to(device)
    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"      Model Parametre Sayısı: {total_params:,}")

    # 2. Sentetik Öncesi/Sonrası Girdi Testi (Batch: 2, 256x256)
    print("[3/4] Öncesi ve Sonrası Görüntü Çifti ile İleri Yayılım (Forward Pass)...")
    dummy_pre = torch.randn(2, 3, 256, 256, device=device)
    dummy_post = torch.randn(2, 3, 256, 256, device=device)

    with torch.no_grad():
        output = model(dummy_pre, dummy_post)

    assert output.shape == (2, 5, 256, 256), f"Beklenmeyen çıktı boyutu: {output.shape}"
    print(f"      Çıktı Boyutu Başarılı: {output.shape} (5 Sınıflı Lojitler)")

    # 3. Kayıp Fonksiyonu Testi
    criterion = DamageAssessmentLoss(num_classes=5)
    dummy_targets = torch.randint(0, 5, (2, 256, 256), device=device)
    loss = criterion(output, dummy_targets)
    print(f"      Hibrit Kayıp (Focal + Dice) Skoru: {loss.item():.4f}")

    # 4. Vektörizasyon Testi
    print("[4/4] Model Çıktısı Piksel Maskesinden GeoJSON'a Dönüştürülüyor...")
    pred_mask = torch.argmax(output[0], dim=0).cpu().numpy().astype(np.uint8)
    geojson_result = mask_to_geojson(pred_mask)
    num_polygons = len(geojson_result.get("features", []))
    print(f"      Vektörizasyon Başarılı! Üretilen Poligon Sayısı: {num_polygons}")

    print("=" * 60)
    print("✅ TÜM KONTROLLER BAŞARIYLA GEÇTİ! Yapay zekâ hattı eğitime hazır.")
    print("=" * 60)


if __name__ == "__main__":
    run_pipeline_check()
