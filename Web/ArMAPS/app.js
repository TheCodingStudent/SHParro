const MEXICO_CENTER = [23.8, -102.5];
const INEGI_WMS = "https://gaia.inegi.org.mx/geoserver/wms";
const INEGI_MDM61_WMS = "https://gaia.inegi.org.mx/NLB/tunnel/wms/wms61?";

window.addEventListener("DOMContentLoaded", () => {
  const inegiServiceStatus = document.querySelector("#inegiServiceStatus");
  const mdm61LayerList = document.querySelector("#mdm61LayerList");

  async function loadMdm61Capabilities() {
    const capabilitiesUrl = `${INEGI_MDM61_WMS}service=WMS&request=GetCapabilities&version=1.1.1`;
    try {
      const response = await fetch(capabilitiesUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const documentXml = new DOMParser().parseFromString(xml, "application/xml");
      const parserError = documentXml.querySelector("parsererror");
      if (parserError) throw new Error("GetCapabilities inválido");

      const layers = [...documentXml.querySelectorAll("Layer")].filter(layer => layer.querySelector(":scope > Name"));
      mdm61LayerList.replaceChildren();
      const names = new Set();

      layers.forEach(layer => {
        const name = layer.querySelector(":scope > Name")?.textContent.trim();
        const title = layer.querySelector(":scope > Title")?.textContent.trim();
        if (!name || names.has(name)) return;
        names.add(name);

        const label = document.createElement("label");
        label.className = "layer-row";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.layer = name;
        input.dataset.wms = INEGI_MDM61_WMS;
        input.dataset.version = "1.1.1";
        input.dataset.crs = "EPSG:4326";
        input.dataset.format = "image/png";
        input.dataset.transparent = "true";

        const text = document.createElement("span");
        text.textContent = title || name;
        label.append(input, text);
        mdm61LayerList.appendChild(label);
      });

      if (!names.size) throw new Error("El catálogo no contiene capas nombradas");
      inegiServiceStatus.textContent = `Servicio INEGI disponible · ${names.size} capas`;
      inegiServiceStatus.className = "service-status available";
      bindMdm61Rows();
    } catch {
      inegiServiceStatus.textContent = "Servicio INEGI no disponible actualmente";
      inegiServiceStatus.className = "service-status unavailable";
      mdm61LayerList.innerHTML = '<div class="catalog-loading">Catálogo temporalmente fuera de servicio.</div>';
    }
  }

  function bindMdm61Rows() {
    decorateLayerTypes(mdm61LayerList);
    mdm61LayerList.querySelectorAll("[data-layer]").forEach(input => {
      input.addEventListener("change", handleWmsLayerChange);
    });
  }

  function decorateLayerTypes(root = document) {
    root.querySelectorAll(".layer-row").forEach(row => {
      const input = row.querySelector("input[data-layer]");
      if (!input || row.querySelector(".layer-type-badge")) return;
      const badge = document.createElement("span");
      const isWmts = Boolean(input.dataset.wmts);
      badge.className = "layer-type-badge";
      badge.textContent = isWmts ? "WMTS" : "WMS";
      badge.title = isWmts ? "Web Map Tile Service" : "Web Map Service";
      badge.setAttribute("aria-label", badge.title);
      input.before(badge);
    });
  }

  const map = L.map("map", {
    center: MEXICO_CENTER,
    zoom: 5,
    minZoom: 3,
    zoomControl: false
  });
  map.createPane("wms-overlay");
  map.getPane("wms-overlay").style.zIndex = 450;

  const sidebar = document.querySelector(".map-sidebar");
  const basemapPicker = document.querySelector(".basemap-picker");
  const mapArea = document.querySelector(".map-area");
  const sidebarToggle = document.querySelector("#sidebarToggle");
  sidebarToggle?.addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("collapsed");
    document.querySelector(".armaps-shell")?.classList.toggle("sidebar-collapsed", collapsed);
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    sidebarToggle.setAttribute("aria-label", collapsed ? "Expandir sidebar" : "Colapsar sidebar");
    sidebarToggle.textContent = collapsed ? "\u203A" : "\u2039";
    window.setTimeout(() => map.invalidateSize(), 260);
  });

  document.querySelectorAll(".unavailable-layer").forEach(row => {
    if (!row.textContent.toLowerCase().includes("municipios")) return;
    const input = row.querySelector("input");
    input.disabled = false;
    input.dataset.layer = "bd_geo_cpv2025:municipios";
    row.classList.remove("unavailable-layer");
  });

  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  const baseMaps = {
    streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }),
    satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }),
    topographic: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    }),
    light: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 20,
      attribution: "Tiles &copy; Esri"
    }),
    dark: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 20,
      attribution: "Tiles &copy; Esri"
    }),
    terrain: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: "OpenTopoMap"
    })
  };
  let activeBase = baseMaps.streets.addTo(map);

  function updateSidebarTone() {
    sidebar?.classList.remove("light-text");
    sidebar?.classList.add("dark-text");
    basemapPicker?.classList.remove("light-text");
    basemapPicker?.classList.add("dark-text");
    mapArea?.classList.remove("light-text");
    mapArea?.classList.add("dark-text");
  }
  updateSidebarTone();

  document.querySelector("#zoomInButton")?.addEventListener("click", () => map.zoomIn());
  document.querySelector("#zoomOutButton")?.addEventListener("click", () => map.zoomOut());

  const wmsLayers = new Map();
  function setWmsOpacity(opacity) {
    wmsLayers.forEach(layer => layer.setOpacity(opacity));
  }

  document.querySelectorAll("[data-basemap]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-basemap]").forEach(item => item.classList.toggle("active", item === button));
      map.removeLayer(activeBase);
      activeBase = baseMaps[button.dataset.basemap];
      activeBase.addTo(map);
      document.querySelector("#activeBasemapName").textContent = button.querySelector("span:last-child").textContent;
      updateSidebarTone();
    });
  });

  function handleWmsLayerChange(event) {
      const input = event.currentTarget;
      if (input.checked) {
        let state = input.parentElement.querySelector(".layer-state");
        if (!state) {
          state = document.createElement("span");
          state.className = "layer-state";
          input.parentElement.appendChild(state);
        }
        state.textContent = "cargando";
        state.className = "layer-state loading";
        const opacity = 1;
        const wmtsTemplate = input.dataset.wmts;
        let wmsUrl = input.dataset.wms || INEGI_WMS;
        const nasaLayer = wmsUrl.includes("gibs.earthdata.nasa.gov");
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const wmsVersion = input.dataset.version || "1.3.0";
        const wmsCrs = input.dataset.crs === "EPSG:4326" ? L.CRS.EPSG4326 : L.CRS.EPSG3857;
        const layer = wmtsTemplate
          ? L.tileLayer(wmtsTemplate.replace("{time}", yesterday.toISOString().slice(0, 10)), {
              opacity,
              keepBuffer: 2,
              updateWhenIdle: true,
              pane: "wms-overlay"
            })
          : L.tileLayer.wms(wmsUrl, {
              layers: input.dataset.layer,
              format: input.dataset.format || "image/png",
              transparent: input.dataset.transparent !== "false",
              version: wmsVersion,
              crs: wmsCrs,
              opacity,
              keepBuffer: 2,
              updateWhenIdle: true,
              pane: "wms-overlay",
              ...(nasaLayer ? { time: yesterday.toISOString().slice(0, 10) } : {})
            });
        let loadedTiles = 0;
        let failedTiles = 0;
        let retryTimer = null;
        const layerKey = `${wmtsTemplate || wmsUrl}|${input.dataset.layer}`;
        layer.on("tileload", () => {
          loadedTiles += 1;
          failedTiles = 0;
          state.textContent = "visible";
          state.className = "layer-state loaded";
        });
        layer.on("tileerror", () => {
          failedTiles += 1;
          if (loadedTiles === 0 && failedTiles >= 2) {
            state.textContent = "sin respuesta del servicio";
            state.className = "layer-state error";
            if (!retryTimer) {
              retryTimer = window.setTimeout(() => {
                retryTimer = null;
                if (input.checked) layer.redraw();
              }, 15000);
            }
          }
        });
        layer.addTo(map);
        wmsLayers.set(layerKey, layer);
      } else {
        const wmsUrl = input.dataset.wms || INEGI_WMS;
        const layerKey = `${input.dataset.wmts || wmsUrl}|${input.dataset.layer}`;
        const layer = wmsLayers.get(layerKey);
        if (layer) {
          map.removeLayer(layer);
          wmsLayers.delete(layerKey);
        }
        const state = input.parentElement.querySelector(".layer-state");
        if (state) {
          state.textContent = "";
          state.className = "layer-state";
        }
      }
  }

  decorateLayerTypes();
  document.querySelectorAll("[data-layer]").forEach(input => {
    input.addEventListener("change", handleWmsLayerChange);
  });

  map.on("mousemove", event => {
    document.querySelector("#coordinates").textContent =
      `Lat ${event.latlng.lat.toFixed(5)} · Lon ${event.latlng.lng.toFixed(5)}`;
  });
  map.on("mouseout", () => {
    document.querySelector("#coordinates").textContent = "Lat 19.4326 · Lon -99.1332";
  });

  const locateButton = document.querySelector("#locateButton");
  const locationStatus = document.querySelector("#locationStatus");
  let locationMarker = null;
  let locationAccuracy = null;
  let locationStatusTimer = null;

  function showLocationStatus(message, visible = true) {
    locationStatus.textContent = message;
    locationStatus.classList.toggle("visible", visible);
    window.clearTimeout(locationStatusTimer);
    if (visible) {
      locationStatusTimer = window.setTimeout(() => locationStatus.classList.remove("visible"), 6000);
    }
  }

  locateButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showLocationStatus("Este navegador no admite geolocalización.");
      return;
    }

    locateButton.classList.add("loading");
    locateButton.setAttribute("aria-busy", "true");
    navigator.geolocation.getCurrentPosition(
      position => {
        const latLng = [position.coords.latitude, position.coords.longitude];
        const accuracy = Math.round(position.coords.accuracy);
        locateButton.classList.remove("loading");
        locateButton.classList.add("active");
        locateButton.removeAttribute("aria-busy");
        map.setView(latLng, Math.max(map.getZoom(), 16), { animate: true, duration: 1.2 });

        if (locationMarker) map.removeLayer(locationMarker);
        if (locationAccuracy) map.removeLayer(locationAccuracy);
        locationAccuracy = L.circle(latLng, {
          radius: position.coords.accuracy,
          color: "#ff3864",
          fillColor: "#ff3864",
          fillOpacity: 0.12,
          weight: 1
        }).addTo(map);
        locationMarker = L.circleMarker(latLng, {
          radius: 7,
          color: "#ffffff",
          fillColor: "#ff3864",
          fillOpacity: 1,
          weight: 2
        }).addTo(map);
        showLocationStatus(`Ubicación obtenida · precisión aproximada de ${accuracy} m`);
      },
      error => {
        locateButton.classList.remove("loading");
        locateButton.removeAttribute("aria-busy");
        const messages = {
          1: "Permiso de ubicación denegado. Actívalo en la configuración del navegador.",
          2: "No fue posible obtener la ubicación del dispositivo.",
          3: "La ubicación tardó demasiado en responder."
        };
        showLocationStatus(messages[error.code] || "No fue posible obtener la ubicación.");
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  });

  const searchInput = document.querySelector("#placeSearch");
  const searchStatus = document.querySelector("#searchStatus");
  async function searchPlace() {
    const query = searchInput.value.trim();
    if (!query) return;
    searchStatus.textContent = "Buscando...";
    try {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "1",
        countrycodes: "mx"
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": "es-MX" }
      });
      if (!response.ok) throw new Error(`Servicio de búsqueda: ${response.status}`);
      const results = await response.json();
      if (!results.length) {
        searchStatus.textContent = "No se encontraron resultados.";
        return;
      }
      const place = results[0];
      const lat = Number(place.lat);
      const lon = Number(place.lon);
      map.flyTo([lat, lon], 12, { duration: 1.2 });
      searchStatus.textContent = place.display_name;
    } catch (error) {
      searchStatus.textContent = "No fue posible buscar el lugar.";
    }
  }
  document.querySelector("#searchButton").addEventListener("click", searchPlace);
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") searchPlace();
  });
  loadMdm61Capabilities();
});
