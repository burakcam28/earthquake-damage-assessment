// Web-GIS Map Logic with Satellite Basemap & GeoJSON Layer

const map = L.map("map").setView([36.2066, 36.1575], 18);

// Esri World Imagery (High-Resolution Satellite Basemap)
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics",
    maxZoom: 19,
  }
).addTo(map);

// OpenStreetMap Labels Overlay for navigation
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
  {
    subdomains: "abcd",
    maxZoom: 19,
  }
).addTo(map);

const counts = {
  "no-damage": 0,
  "minor-damage": 0,
  "major-damage": 0,
  "destroyed": 0,
};

function styleFeature(feature) {
  const color = feature.properties?.color || "#ffc107";
  return {
    fillColor: color,
    weight: 2,
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

  const popupContent = `
    <div style="font-size: 13px; line-height: 1.5;">
      <h4 style="margin: 0 0 6px 0; color: #1a202c;">Bina #${props.id || "-"}</h4>
      <b>Durum:</b> <span style="color:${props.color}; font-weight:700;">${props.damage_label || props.damage_status}</span><br>
      <b>Güven Skoru:</b> %${Math.round((props.confidence || 0) * 100)}<br>
      <b>Mahalle:</b> ${props.neighborhood || "Belirtilmemiş"}<br>
      <small style="color: #718096;">Değerlendirme: ${props.date_assessed || "-"}</small>
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

// Fetch from backend API, or fall back to local sample GeoJSON
async function loadBuildingData() {
  const statusEl = document.getElementById("data-source-status");
  let data = null;

  try {
    // Attempt FastAPI backend first
    const res = await fetch("http://127.0.0.1:8000/api/buildings");
    if (!res.ok) throw new Error("Backend not responding");
    data = await res.json();
    statusEl.innerText = "Bağlantı: Canlı FastAPI Servisi";
    statusEl.style.background = "#e6fffa";
    statusEl.style.color = "#234e52";
  } catch (err) {
    // Fallback to local sample GeoJSON
    try {
      const res = await fetch("../data/samples/sample_buildings.geojson");
      data = await res.json();
      statusEl.innerText = "Bağlantı: Yerel Örnek GeoJSON";
      statusEl.style.background = "#fffaf0";
      statusEl.style.color = "#7b341e";
    } catch (fallbackErr) {
      statusEl.innerText = "Veri yüklenemedi!";
      statusEl.style.background = "#fff5f5";
      statusEl.style.color = "#c53030";
      return;
    }
  }

  if (data) {
    const geoLayer = L.geoJSON(data, {
      style: styleFeature,
      onEachFeature: onEachFeature,
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), { padding: [50, 50] });
    updateStatsUI();
  }
}

loadBuildingData();
