// Web-GIS Map Logic with High-Resolution Retina Satellite, Verified Basemaps & GeoJSON Layer

// Harita Başlangıcı (Antakya Merkezi)
const map = L.map("map", {
  center: [36.2066, 36.1575],
  zoom: 17,
  maxZoom: 21,
});

// 1. Google Satellite Hybrid - Yüksek Netlik (Retina 512px Karolar)
const googleHybrid = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2",
  {
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 21,
    attribution: "Google Uydu (HD)",
  }
).addTo(map);

// 2. Esri World Imagery (Yedek Uydu Altlığı)
const esriSat = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxNativeZoom: 17,
    maxZoom: 21,
    attribution: "Esri World Imagery",
  }
);

// 3. Esri World Street Map (403 vermeyen, kurumsal ve detaylı Türkçe sokak haritası)
const esriStreet = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Esri Street Map",
  }
);

// Katman Değiştirici Sol Altta
const baseMaps = {
  "🛰️ Google Uydu (HD)": googleHybrid,
  "🌍 Esri Uydu": esriSat,
  "🗺️ Şehir Haritası": esriStreet,
};
L.control.layers(baseMaps, null, { position: "bottomleft" }).addTo(map);

// FastAPI kapalıyken bile tarayıcının file:// CORS engeline takılmaması için gömülü yedek veri
const EMBEDDED_SAMPLE_DATA = {
  "type": "FeatureCollection",
  "name": "sample_buildings_antakya",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": 1,
        "neighborhood": "Antakya Merkez",
        "damage_status": "destroyed",
        "damage_label": "Yıkık",
        "confidence": 0.92,
        "color": "#dc3545",
        "area_m2": 240.5
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[36.1570, 36.2065], [36.1574, 36.2065], [36.1574, 36.2069], [36.1570, 36.2069], [36.1570, 36.2065]]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": 2,
        "neighborhood": "Antakya Merkez",
        "damage_status": "no-damage",
        "damage_label": "Hasarsız",
        "confidence": 0.96,
        "color": "#28a745",
        "area_m2": 265.4
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[36.1576, 36.2063], [36.1580, 36.2063], [36.1580, 36.2067], [36.1576, 36.2067], [36.1576, 36.2063]]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": 3,
        "neighborhood": "Antakya Merkez",
        "damage_status": "minor-damage",
        "damage_label": "Hafif Hasar",
        "confidence": 0.84,
        "color": "#ffc107",
        "area_m2": 180.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[36.1565, 36.2070], [36.1569, 36.2070], [36.1569, 36.2074], [36.1565, 36.2074], [36.1565, 36.2070]]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": 4,
        "neighborhood": "Antakya Merkez",
        "damage_status": "major-damage",
        "damage_label": "Ağır Hasar",
        "confidence": 0.88,
        "color": "#fd7e14",
        "area_m2": 310.2
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[36.1582, 36.2068], [36.1586, 36.2068], [36.1586, 36.2072], [36.1582, 36.2072], [36.1582, 36.2068]]]
      }
    }
  ]
};

let currentGeoLayer = null;
let counts = { "no-damage": 0, "minor-damage": 0, "major-damage": 0, "destroyed": 0 };

function resetCounts() {
  counts = { "no-damage": 0, "minor-damage": 0, "major-damage": 0, "destroyed": 0 };
}

function styleFeature(feature) {
  const color = feature.properties?.color || "#ffc107";
  return {
    fillColor: color,
    weight: 2.5,
    opacity: 1,
    color: "#ffffff",
    fillOpacity: 0.65,
  };
}

function onEachFeature(feature, layer) {
  const props = feature.properties || {};
  const status = props.damage_status || "no-damage";
  if (counts.hasOwnProperty(status)) {
    counts[status] += 1;
  }

  // Hover efekti: Fare üzerine gelince kalınlaşsın
  layer.on({
    mouseover: function(e) {
      const l = e.target;
      l.setStyle({ weight: 4, fillOpacity: 0.85 });
    },
    mouseout: function(e) {
      if (currentGeoLayer) {
        currentGeoLayer.resetStyle(e.target);
      }
    },
  });

  const popupContent = `
    <div style="font-size: 13px; line-height: 1.6; min-width: 170px;">
      <h4 style="margin: 0 0 6px 0; color: #1a202c; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
        Bina #${props.id || "-"}
      </h4>
      <b>Hasar Durumu:</b> <span style="color:${props.color}; font-weight:700;">${props.damage_label || props.damage_status}</span><br>
      <b>Güven Skoru:</b> %${Math.round((props.confidence || 0) * 100)}<br>
      <b>Tahmini Alan:</b> ${props.area_m2 ? props.area_m2 + " m²" : "Hesaplanıyor"}<br>
      <b>Konum:</b> ${props.neighborhood || "Antakya"}<br>
    </div>
  `;
  layer.bindPopup(popupContent);
}

function updateStatsUI() {
  document.getElementById("count-no-damage").innerText = counts["no-damage"];
  document.getElementById("count-minor").innerText = counts["minor-damage"];
  document.getElementById("count-major").innerText = counts["major-damage"];
  document.getElementById("count-destroyed").innerText = counts["destroyed"];
}

function renderGeoJSON(data) {
  if (currentGeoLayer) {
    map.removeLayer(currentGeoLayer);
  }
  resetCounts();

  currentGeoLayer = L.geoJSON(data, {
    style: styleFeature,
    onEachFeature: onEachFeature,
  }).addTo(map);

  if (currentGeoLayer.getBounds().isValid()) {
    map.flyToBounds(currentGeoLayer.getBounds(), { padding: [60, 60], maxZoom: 18, duration: 1.2 });
  }
  updateStatsUI();
}

async function loadInitialData() {
  const statusEl = document.getElementById("data-source-status");

  try {
    const res = await fetch("http://127.0.0.1:8000/api/buildings");
    if (!res.ok) throw new Error("Backend offline");
    const data = await res.json();
    statusEl.innerText = "Bağlantı: Canlı FastAPI Servisi";
    statusEl.style.background = "#e6fffa";
    statusEl.style.color = "#234e52";
    renderGeoJSON(data);
  } catch (err) {
    statusEl.innerText = "Bağlantı: Çevrimdışı Örnek Veri (Backend Kapalı)";
    statusEl.style.background = "#fffaf0";
    statusEl.style.color = "#7b341e";
    renderGeoJSON(EMBEDDED_SAMPLE_DATA);
  }
}

function openUploadModal() {
  document.getElementById("uploadModal").style.display = "flex";
}

function closeUploadModal() {
  document.getElementById("uploadModal").style.display = "none";
  document.getElementById("loadingStatus").style.display = "none";
}

async function handlePredictSubmit(event) {
  event.preventDefault();

  const preFile = document.getElementById("preImageInput").files[0];
  const postFile = document.getElementById("postImageInput").files[0];
  const loadingStatus = document.getElementById("loadingStatus");
  const submitBtn = document.getElementById("submitBtn");
  const statusEl = document.getElementById("data-source-status");

  if (!preFile || !postFile) {
    alert("Lütfen hem öncesi hem de sonrası uydu görüntüsünü seçin.");
    return;
  }

  const formData = new FormData();
  formData.append("pre_image", preFile);
  formData.append("post_image", postFile);

  submitBtn.disabled = true;
  loadingStatus.style.display = "block";

  try {
    const res = await fetch("http://127.0.0.1:8000/api/predict", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Analiz sırasında sunucu hatası oluştu.");
    }

    const resultGeoJSON = await res.json();
    renderGeoJSON(resultGeoJSON);

    document.getElementById("region-title").innerText = "Yeni Analiz Edilen Bölge (Canlı Çıktı)";
    const execTime = resultGeoJSON.metadata?.execution_time_ms || 0;
    const totalCount = resultGeoJSON.metadata?.total_detected_buildings || 0;

    statusEl.innerText = `Sonuç: Canlı Analiz Tamamlandı (${execTime} ms - ${totalCount} Bina)`;
    statusEl.style.background = "#e6fffa";
    statusEl.style.color = "#234e52";

    closeUploadModal();
  } catch (err) {
    alert("Hata: Backend (FastAPI) açık değil. Lütfen terminalde 'uvicorn backend.main:app --reload --port 8000' komutunu çalıştırın.");
  } finally {
    submitBtn.disabled = false;
    loadingStatus.style.display = "none";
  }
}

loadInitialData();
