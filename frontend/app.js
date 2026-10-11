// Web-GIS Map Logic with High-Resolution Google/Esri Satellite & GeoJSON Layer

// Harita Başlangıcı
const map = L.map("map", {
  center: [36.2066, 36.1575],
  zoom: 17,
  maxZoom: 21,
});

// 1. Google Satellite Hybrid (En yüksek çözünürlük - Zoom 21'e kadar sokak sokak net görüntü)
const googleHybrid = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
  maxZoom: 21,
  attribution: "Google Uydu & Sokak",
}).addTo(map);

// 2. Esri World Imagery (maxNativeZoom: 17 sayesinde asla 'Map data not yet available' vermez, dijital büyütür)
const esriSat = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxNativeZoom: 17,
    maxZoom: 21,
    attribution: "Esri World Imagery",
  }
);

// 3. OpenStreetMap (Standart Vektör Şehir Haritası)
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "OpenStreetMap",
});

// Katman Değiştirici (Sağ üste harita seçenekleri ekle)
const baseMaps = {
  "🛰️ Google Uydu (Önerilen)": googleHybrid,
  "🌍 Esri Uydu": esriSat,
  "🗺️ Standart Şehir Haritası": osm,
};
L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

let currentGeoLayer = null;
let counts = {
  "no-damage": 0,
  "minor-damage": 0,
  "major-damage": 0,
  "destroyed": 0,
};

function resetCounts() {
  counts = {
    "no-damage": 0,
    "minor-damage": 0,
    "major-damage": 0,
    "destroyed": 0,
  };
}

function styleFeature(feature) {
  const color = feature.properties?.color || "#ffc107";
  return {
    fillColor: color,
    weight: 2,
    opacity: 1,
    color: "#ffffff",
    fillOpacity: 0.7,
  };
}

function onEachFeature(feature, layer) {
  const props = feature.properties || {};
  const status = props.damage_status || "no-damage";
  if (counts.hasOwnProperty(status)) {
    counts[status] += 1;
  }

  const popupContent = `
    <div style="font-size: 13px; line-height: 1.5;">
      <h4 style="margin: 0 0 6px 0; color: #1a202c;">Bina #${props.id || "-"}</h4>
      <b>Durum:</b> <span style="color:${props.color}; font-weight:700;">${props.damage_label || props.damage_status}</span><br>
      <b>Güven Skoru:</b> %${Math.round((props.confidence || 0) * 100)}<br>
      <b>Alan:</b> ${props.area_m2 ? props.area_m2 + " m²" : "Hesaplanıyor"}<br>
      <b>Bölge:</b> ${props.neighborhood || "Antakya"}<br>
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
    // maxZoom: 18 vererek aşırı yakınlaşıp boşluğa düşmeyi engelliyoruz
    map.flyToBounds(currentGeoLayer.getBounds(), { padding: [60, 60], maxZoom: 18, duration: 1.2 });
  }
  updateStatsUI();
}

// İlk açılışta önceden işlenmiş şehir binalarını yükle
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
    try {
      const res = await fetch("../data/samples/sample_buildings.geojson");
      const data = await res.json();
      statusEl.innerText = "Bağlantı: Yerel Örnek GeoJSON";
      statusEl.style.background = "#fffaf0";
      statusEl.style.color = "#7b341e";
      renderGeoJSON(data);
    } catch (fallbackErr) {
      statusEl.innerText = "Veri yüklenemedi!";
      statusEl.style.background = "#fff5f5";
      statusEl.style.color = "#c53030";
    }
  }
}

// Modal kontrolü
function openUploadModal() {
  document.getElementById("uploadModal").style.display = "flex";
}

function closeUploadModal() {
  document.getElementById("uploadModal").style.display = "none";
  document.getElementById("loadingStatus").style.display = "none";
}

// Kullanıcının yüklediği fotoğrafları FastAPI /api/predict'e gönderme
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
    alert("Hata: " + err.message);
  } finally {
    submitBtn.disabled = false;
    loadingStatus.style.display = "none";
  }
}

loadInitialData();
