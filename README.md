# Uydu Görüntüleriyle Deprem Hasar Tespiti ve Web-GIS Karar Destek Sistemi

Bu proje, yüksek çözünürlüklü (VHR) uydu görüntülerini (xView2 / Maxar Open Data) derin öğrenme modelleriyle işleyerek deprem sonrası bina hasarlarını tespit eden, sonuçları PostGIS veritabanında mekânsal olarak indeksleyen ve etkileşimli bir Web-GIS arayüzü üzerinde karar vericilere sunan uçtan uca bir sistemdir.

---

## 🏗️ Sistem Mimarisi

Sistem 4 ana bileşenden oluşur:

1. **Yapay Zekâ ve Görüntü İşleme Boru Hattı (`ai_pipeline/`):**
   - Öncesi ve sonrası uydu görüntülerini (pre/post disaster) işleyen çift kollu (Siamese) segmentasyon ağı.
   - Sınıf dengesizliğini aşmak için hibrit kayıp fonksiyonu (Focal Loss + Dice Loss).
   - Tespit edilen bina hasar maskelerinin coğrafi koordinatlara (Affine Transform) dönüştürülüp vektörize edilmesi.

2. **Mekânsal Veritabanı (PostgreSQL + PostGIS):**
   - Vektörize edilmiş bina sınırlarının (poligonlar), hasar sınıflarının ve model güven skorlarının saklanması.
   - Hızlı mekânsal sorgulama ve mahalle/bölge bazlı istatistik analizleri.

3. **Arka Uç API Servisi (`backend/`):**
   - FastAPI ile geliştirilen, haritaya hafif GeoJSON formatında veri akışı sağlayan asenkron servis.

4. **Web-GIS Harita Arayüzü (`frontend/`):**
   - Esri World Imagery uydu altlığı üzerinde binaları hasar düzeyine göre renklendiren etkileşimli harita (Leaflet / MapLibre GL).

---

## 📁 Dizin Yapısı

```text
earthquake-damage-assessment/
├── README.md
├── .gitignore
├── requirements.txt
├── data/
│   ├── raw/                 # Ham uydu görüntüleri (Git'e atılmaz)
│   ├── processed/           # 512x512/256x256 kırpılmış patch'ler
│   └── samples/             # Test ve demo için hafif örnek GeoJSON verileri
├── ai_pipeline/             # Derin Öğrenme ve Görüntü İşleme
│   ├── dataset.py           # PyTorch Dataset & DataLoader
│   ├── losses.py            # Focal Loss + Dice Loss
│   ├── models/
│   │   └── siamese_unet.py  # Siamese U-Net mimarisi
│   └── inference.py         # Çıktı maskesini GeoJSON'a dönüştürme
├── backend/                 # FastAPI Servisi
│   ├── main.py              # API giriş noktası
│   ├── database.py          # Veritabanı bağlantısı
│   └── models.py            # SQLAlchemy / GeoAlchemy2 modelleri
└── frontend/                # Web-GIS Kullanıcı Arayüzü
    ├── index.html           # Harita arayüzü
    └── app.js               # Harita etkileşimleri ve API entegrasyonu
```

---

## ⚠️ Kritik Teknik Kurallar (Hata Önleme Rehberi)

1. **Çözünürlük (Resolution):** Sentinel-2 gibi 10m çözünürlüklü görüntüler bina hasar tespiti için yetersizdir. Yalnızca alt-metre (VHR) görüntüler (Maxar WorldView / xBD) kullanılmalıdır.
2. **Koordinat Korunumu:** GeoTIFF dosyaları kesilirken veya işlenirken `Rasterio` ile coğrafi referans (Affine transform) matrisi mutlaka korunmalıdır.
3. **Sınıflandırma Mantığı:** Model 4 değil en az **5 sınıf** tahmin eder:
   - `0`: Arka Plan (Bina Olmayan Alan)
   - `1`: Hasarsız (No Damage)
   - `2`: Hafif Hasar (Minor Damage)
   - `3`: Ağır Hasar (Major Damage)
   - `4`: Yıkık (Destroyed)
4. **Performans:** Model harita üzerinde canlı (real-time) çalıştırılmaz; toplu işleme (batch inference) ile veritabanına aktarılır, arayüz sadece veritabanından veri çeker.

---

## 🚀 Hızlı Başlangıç

### 1. Ortam Kurulumu
```bash
python -m venv .venv
source .venv/bin/activate  # Windows için: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Backend Çalıştırma
```bash
uvicorn backend.main:app --reload --port 8000
```

### 3. Frontend Görüntüleme
`frontend/index.html` dosyasını tarayıcınızda açarak harita arayüzünü doğrudan test edebilirsiniz.
