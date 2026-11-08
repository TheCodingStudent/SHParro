let inputPoints = [];

const TRANINV_URL = "https://www.inegi.org.mx/app/geo2/traninv/api/utm";
const TRANITRF_URL = "https://www.inegi.org.mx/app/geo2/tranitrf/recibe.do";
const TRANITRF_DOWNLOAD_URL = "https://www.inegi.org.mx/app/geo2/tranitrf/download.do?file=";
const sourceRows = document.querySelector("#sourceRows");
const resultRows = document.querySelector("#resultRows");
const transformButton = document.querySelector("#transform");
const processing = document.querySelector("#processing");
const fields = ["sourceFrame","targetFrame","zone","zType"];
const frameNames = {nad27:"NAD27",itrf92:"ITRF92, época 1988.0",itrf2008:"ITRF2008, época 2010.0"};
let busy = false;
let currentReport = null;

const format = value => value == null || !Number.isFinite(value) ? "" : Number(value).toLocaleString("es-MX",{maximumFractionDigits:10});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function configuration() {
  const config = Object.fromEntries(fields.map(id => {
    const key = {sourceFrame:"source_frame",targetFrame:"target_frame",zone:"zone",zType:"z_type"}[id];
    const element = document.querySelector("#" + id);
    return [key,id === "zone" && element.value ? Number(element.value) : element.value];
  }));
  config.hemisphere = "N";
  return config;
}

function routeFor(config) {
  if (config.source_frame === config.target_frame) return [];
  if ((config.source_frame === "nad27" && config.target_frame === "itrf92") ||
      (config.source_frame === "itrf92" && config.target_frame === "nad27")) return ["TRANINV"];
  if (config.source_frame === "nad27" && config.target_frame === "itrf2008") return ["TRANINV","TRANITRF"];
  if (config.source_frame === "itrf2008" && config.target_frame === "nad27") return ["TRANITRF","TRANINV"];
  return ["TRANITRF"];
}

function utmToGeographic(easting,northing,zone,south = false) {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;
  const b = a * (1 - f);
  const eSquared = (a * a - b * b) / (a * a);
  const epSquared = eSquared / (1 - eSquared);
  const x = easting - 500000;
  const y = south ? northing - 10000000 : northing;
  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const M = y / k0;
  const mu = M / (a * (1 - eSquared / 4 - 3 * eSquared * eSquared / 64 - 5 * eSquared ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - eSquared)) / (1 + Math.sqrt(1 - eSquared));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    151 * e1 ** 3 / 96 * Math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
  const sinPhi = Math.sin(phi1), cosPhi = Math.cos(phi1), tanPhi = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - eSquared * sinPhi * sinPhi);
  const T1 = tanPhi * tanPhi;
  const C1 = epSquared * cosPhi * cosPhi;
  const R1 = a * (1 - eSquared) / (1 - eSquared * sinPhi * sinPhi) ** 1.5;
  const D = x / (N1 * k0);
  const latitude = phi1 - N1 * tanPhi / R1 * (
    D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * epSquared) * D ** 4 / 24 +
    (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * epSquared - 3 * C1 * C1) * D ** 6 / 720);
  const longitude = longOrigin * Math.PI / 180 + (
    D - (1 + 2 * T1 + C1) * D ** 3 / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * epSquared + 24 * T1 * T1) * D ** 5 / 120) / cosPhi;
  return {latitude:latitude * 180 / Math.PI,longitude:longitude * 180 / Math.PI};
}

function geographicToUtm(latitude,longitude,zone,south = false) {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  const a = 6378137;
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const eSquared = (a * a - b * b) / (a * a);
  const epSquared = eSquared / (1 - eSquared);
  const k0 = 0.9996;
  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const lonDiff = lon - longOrigin * Math.PI / 180;
  const N = a / Math.sqrt(1 - eSquared * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = epSquared * Math.cos(lat) ** 2;
  const A = Math.cos(lat) * lonDiff;
  const M = a * ((1 - eSquared / 4 - 3 * eSquared ** 2 / 64 - 5 * eSquared ** 3 / 256) * lat -
    (3 * eSquared / 8 + 3 * eSquared ** 2 / 32 + 45 * eSquared ** 3 / 1024) * Math.sin(2 * lat) +
    (15 * eSquared ** 2 / 256 + 45 * eSquared ** 3 / 1024) * Math.sin(4 * lat) -
    35 * eSquared ** 3 / 3072 * Math.sin(6 * lat));
  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 +
    (5 - 18 * T + T * T + 72 * C - 58 * epSquared) * A ** 5 / 120) + 500000;
  const northing = k0 * (M + N * Math.tan(lat) * (
    A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 +
    (61 - 58 * T + T * T + 600 * C - 330 * epSquared) * A ** 6 / 720));
  return {easting,northing:south ? northing + 10000000 : northing};
}

function decimalToDms(value) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return {degrees,minutes,seconds};
}

function formatDms(value,fractionDigits = 5) {
  const d = decimalToDms(value);
  return `${d.degrees},${String(d.minutes).padStart(2,"0")},${d.seconds.toFixed(fractionDigits)}`;
}

function renderPoints() {
  sourceRows.innerHTML = inputPoints.length ? inputPoints.map((point,index) => `
    <tr data-index="${index}">
      <td class="row-number">${index + 1}</td>
      <td><input class="sheet-input" data-field="id" aria-label="ID fila ${index + 1}" value="${escapeSheet(point.id)}"></td>
      <td><input class="sheet-input numeric-input" data-field="easting" inputmode="decimal" aria-label="Este fila ${index + 1}" value="${escapeSheet(point.easting ?? "")}"></td>
      <td><input class="sheet-input numeric-input" data-field="northing" inputmode="decimal" aria-label="Norte fila ${index + 1}" value="${escapeSheet(point.northing ?? "")}"></td>
      <td><input class="sheet-input numeric-input" data-field="z" inputmode="decimal" aria-label="Z fila ${index + 1}" value="${escapeSheet(point.z ?? "")}"></td>
      <td class="row-action"><button type="button" class="remove-point" data-remove="${index}" aria-label="Eliminar fila ${index + 1}" title="Eliminar fila">×</button></td>
    </tr>`).join("") : `
    <tr class="empty-sheet"><td colspan="6">No hay puntos. Pegue datos desde Excel o agregue una fila.</td></tr>`;
}

function escapeSheet(value) {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML.replaceAll('"',"&quot;");
}

function parseSheetNumber(value) {
  let text = String(value ?? "").trim();
  if (!text) return null;
  text = text
    .replace(/[\s\u00a0]/g,"")
    .replace(/[_'"]/g,"")
    .replace(/,/g, match => match);
  let normalized = text;
  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/\./g,"").replace(",", ".");
  } else if (normalized.includes(",")) {
    const parts = normalized.split(",");
    if (parts.length > 2) {
      normalized = parts.join("");
    } else {
      normalized = parts.length === 2 && parts[1].length === 3 ? parts.join("") :
        normalized.replace(",", ".");
    }
  } else if ((normalized.match(/\./g) || []).length > 1) {
    normalized = normalized.replace(/\./g,"");
  }
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function syncPointInputs() {
  sourceRows.querySelectorAll(".sheet-input").forEach(input => {
    input.addEventListener("input", () => {
      const row = input.closest("tr");
      const index = Number(row.dataset.index);
      const field = input.dataset.field;
      inputPoints[index] = inputPoints[index] || {};
      inputPoints[index][field] = field === "id" ? input.value : parseSheetNumber(input.value);
      updateInterface();
    });
    input.addEventListener("blur", () => {
      if (input.dataset.field === "id") return;
      const value = parseSheetNumber(input.value);
      input.value = value === null ? "" : String(value).replace(".",",");
    });
    input.addEventListener("paste", event => {
      if (!event.target.matches("[data-field='easting'],[data-field='northing'],[data-field='z']")) return;
      const text = event.clipboardData?.getData("text/plain");
      if (!text || text.includes("\t") || text.includes("\n")) return;
      event.preventDefault();
      const value = parseSheetNumber(text);
      event.target.value = value === null ? "" : String(value).replace(".", ",");
      event.target.dispatchEvent(new Event("input",{bubbles:true}));
    });
  });
  sourceRows.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      inputPoints.splice(Number(button.dataset.remove),1);
      renderEditablePoints();
    });
  });
}

function renderEditablePoints() {
  renderPoints();
  syncPointInputs();
  updateInterface();
}

function validPoints() {
  return inputPoints.filter(point =>
    String(point.id || "").trim() &&
    point.easting !== null && point.easting !== undefined && Number.isFinite(Number(point.easting)) &&
    point.northing !== null && point.northing !== undefined && Number.isFinite(Number(point.northing)) &&
    point.z !== null && point.z !== undefined && Number.isFinite(Number(point.z)));
}

function addPointRow() {
  const next = inputPoints.length + 1;
  inputPoints.push({id:`P${String(next).padStart(2,"0")}`,easting:null,northing:null,z:null});
  renderEditablePoints();
  const inputs = sourceRows.querySelectorAll("tr:last-child .sheet-input");
  inputs[1]?.focus();
  inputs[1]?.select();
}

function swapCoordinates() {
  inputPoints.forEach(point => {
    const easting = point.easting;
    point.easting = point.northing;
    point.northing = easting;
  });
  renderEditablePoints();
}

function pasteRows(event) {
  const text = event.clipboardData?.getData("text/plain");
  if (!text?.includes("\t") && !text.includes("\n")) return;
  event.preventDefault();
  const rows = text.trim().split(/\r?\n/).map(row => row.split("\t"));
  const hasHeader = rows[0]?.some(cell => /^(id|este|easting|x|norte|northing|y|z)$/i.test(cell.trim()));
  const data = hasHeader ? rows.slice(1) : rows;
  const startIndex = Number(event.target.closest("tr")?.dataset.index || 0);
  const fieldNames = ["id","easting","northing","z"];
  const startField = Math.max(0,fieldNames.indexOf(event.target.dataset.field));
  data.forEach((cells,rowOffset) => {
    const index = startIndex + rowOffset;
    while (inputPoints.length <= index) inputPoints.push({id:`P${String(inputPoints.length + 1).padStart(2,"0")}`,easting:null,northing:null,z:null});
    cells.forEach((cell,columnOffset) => {
      const field = fieldNames[startField + columnOffset];
      if (!field) return;
      inputPoints[index][field] = field === "id" ? cell.trim() : parseSheetNumber(cell);
    });
  });
  renderEditablePoints();
}

function updateInterface() {
  const config = configuration();
  transformButton.disabled = busy || !validPoints().length || fields.some(id => !document.querySelector("#" + id).value);
}

async function fetchWithTimeout(url,options,timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url,{...options,signal:controller.signal}); }
  finally { clearTimeout(timer); }
}

async function callTraninv(point,config,attempt = 0) {
  const datum = config.source_frame === "itrf92" ? "itrf92" : "nad27";
  const body = {datum,zona:config.zone,x:point.easting,y:point.northing};
  try {
    const response = await fetchWithTimeout(TRANINV_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error(`Respuesta no JSON de TRANINV (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(`TRANINV respondió HTTP ${response.status}: ${text.slice(0,300)}`);
    return {request:body,response:data};
  } catch (error) {
    if (attempt === 0 && error.name !== "AbortError") {
      await sleep(500);
      return callTraninv(point,config,attempt + 1);
    }
    throw error;
  }
}

async function callTranitrf(sourceFrame,geographicPoints) {
  const is92 = sourceFrame === "itrf92";
  const deA = is92 ? "de92a00" : "de00a92";
  const header = is92 ? "* ITRF 1992 época 1988.0" : "* ITRF 2008 época 2010.0";
  const lines = geographicPoints.map(p => {
    const lat = decimalToDms(p.latitude), lon = decimalToDms(p.longitude);
    const latHemisphere = p.latitude >= 0 ? "N" : "S";
    const lonHemisphere = p.longitude >= 0 ? "E" : "O";
    return `${p.id},${lat.degrees},${String(lat.minutes).padStart(2,"0")},${lat.seconds.toFixed(5)},${latHemisphere},${lon.degrees},${String(lon.minutes).padStart(2,"0")},${lon.seconds.toFixed(5)},${lonHemisphere},${p.height.toFixed(4)}`;
  });
  const form = new FormData();
  form.append("todo","upload");
  form.append("de_a",deA);
  form.append("select",is92 ? "1" : "2");
  form.append("tyfile",new File([header + "\r\n" + lines.join("\r\n") + "\r\n"],"transformacion.txt",{type:"text/plain"}));
  const inputText = header + "\r\n" + lines.join("\r\n") + "\r\n";

  const response = await fetchWithTimeout(TRANITRF_URL,{method:"POST",body:form});
  const responseText = await response.text();
  let result;
  try { result = JSON.parse(responseText); } catch (_) { throw new Error(`Respuesta no JSON de TRANITRF (HTTP ${response.status}).`); }
  if (!response.ok || !Array.isArray(result.errores) || result.errores.length) {
    throw new Error(`TRANITRF rechaza el archivo: ${(result.errores || []).join("; ") || responseText.slice(0,300)}`);
  }
  if (!result.archivo) throw new Error("TRANITRF no devolvió el nombre del archivo ZIP.");

  const zipResponse = await fetchWithTimeout(TRANITRF_DOWNLOAD_URL + encodeURIComponent(result.archivo));
  if (!zipResponse.ok) throw new Error(`Descarga TRANITRF HTTP ${zipResponse.status}.`);
  const zipBlob = await zipResponse.blob();
  return {request:{de_a:deA,select:is92 ? "1" : "2",input_text:inputText},response:result,zip:{size:zipBlob.size,type:zipBlob.type},zipBlob};
}

async function unzipFiles(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const files = {};
  for (let i = 0;i < bytes.length - 3;i++) {
    if (bytes[i] !== 80 || bytes[i + 1] !== 75 || bytes[i + 2] !== 1 || bytes[i + 3] !== 2) continue;
    const method = view.getUint16(i + 10,true);
    const compressedSize = view.getUint32(i + 20,true);
    const nameLength = view.getUint16(i + 28,true);
    const extraLength = view.getUint16(i + 30,true);
    const commentLength = view.getUint16(i + 32,true);
    const localOffset = view.getUint32(i + 42,true);
    const name = new TextDecoder("latin1").decode(bytes.slice(i + 46,i + 46 + nameLength));
    const start = localOffset + 30 + view.getUint16(localOffset + 26,true) + view.getUint16(localOffset + 28,true);
    let output;
    if (method === 0) output = bytes.slice(start,start + compressedSize);
    else if (method === 8) {
      const stream = new DecompressionStream("deflate-raw");
      const writer = stream.writable.getWriter();
      writer.write(bytes.slice(start,start + compressedSize));
      writer.close();
      output = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    } else throw new Error(`Método ZIP ${method} no compatible.`);
    files[name.split("/").pop()] = new TextDecoder("utf-8").decode(output);
  }
  return files;
}

function parseTranitrfCalculations(text) {
  const output = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/PLH\s+([^\s]+)\s+([NS])\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([EW])\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.-]+)/i);
    if (!match) continue;
    const latitude = Number(match[3]) + Number(match[4]) / 60 + Number(match[5]) / 3600;
    const longitude = Number(match[7]) + Number(match[8]) / 60 + Number(match[9]) / 3600;
    output[match[1]] = {
      latitude:match[2].toUpperCase() === "S" ? -latitude : latitude,
      longitude:match[6].toUpperCase() === "W" ? -longitude : longitude,
      height:Number(match[10])
    };
  }
  return output;
}

function traninvUtm(data) {
  const rows = Array.isArray(data) ? data : [data];
  const apiError = rows.find(item => item && typeof item === "object" && item.error)?.error;
  if (apiError) throw new Error(`TRANINV rechazó el punto: ${apiError}`);
  const row = rows.find(item => item.proy === "utm");
  if (!row?.itrf92 || !row?.nad27) {
    throw new Error("TRANINV no devolvió el resultado UTM. Revise que Este, Norte y Zona correspondan a coordenadas dentro de México.");
  }
  return row;
}

async function transform() {
  if (busy) return;
  busy = true;
  processing.hidden = false;
  updateInterface();
  const config = configuration();
  const route = routeFor(config);
  const report = {started_at:new Date().toISOString(),configuration:config,route,points:[]};
  const points = validPoints();
  const messages = [];
  try {
    if (!config.source_frame || !config.target_frame || !config.zone || !config.z_type) throw new Error("Complete todos los campos obligatorios.");
    if (!points.length) throw new Error("Capture al menos un punto válido en la tabla.");
    if (config.z_type !== "ellipsoidal" && route.length) messages.push("Z se conserva como dato original porque su tipo no está confirmado como altura elipsoidal.");
    if (config.source_frame === config.target_frame) {
      report.points = points.map(p => ({id:p.id,status:"sin_transformacion",source:{easting:p.easting,northing:p.northing,z:p.z},target:{easting:p.easting,northing:p.northing},warning:"Z original conservada; no fue transformada."}));
      messages.push("Los marcos son iguales; no se consultó INEGI.");
      renderResults(config,report.points, messages);
      return;
    }
    if (route.includes("TRANITRF") && config.z_type !== "ellipsoidal") throw new Error("TRANITRF requiere altura elipsoidal. Seleccione esa opción o conserve una altura no confirmada sin ejecutar la transformación.");

    if (route.length === 1 && route[0] === "TRANINV") {
      for (const point of points) {
        const exchange = await callTraninv({easting:point.easting,northing:point.northing},config);
        const utm = traninvUtm(exchange.response);
        const target = config.target_frame === "itrf92" ? utm.itrf92 : utm.nad27;
        report.points.push({id:point.id,status:"transformado",source:{easting:point.easting,northing:point.northing,z:point.z},target:{easting:target.x,northing:target.y},inegi:exchange});
        await sleep(50);
      }
      messages.push(`TRANINV: ${points.length} respuestas individuales obtenidas secuencialmente.`);
    } else {
      let working = [];
      report.points = points.map(p => ({
        id:p.id,status:"procesando",source:{easting:p.easting,northing:p.northing,z:p.z}
      }));
      if (config.source_frame === "nad27" && config.target_frame === "itrf2008") {
        for (let index = 0; index < points.length; index++) {
          const point = points[index];
          const exchange = await callTraninv({easting:point.easting,northing:point.northing},config);
          const utm = traninvUtm(exchange.response);
          const frame = config.source_frame === "nad27" ? utm.itrf92 : utm.nad27;
          working.push({id:point.id,height:point.z,point:frame});
          report.points[index] = {
            ...report.points[index],
            inegi_traninv:exchange,
            status:"procesando"
          };
          await sleep(50);
        }
        messages.push("TRANINV: salida intermedia NAD27/ITRF92 obtenida secuencialmente.");
      } else {
        working = points.map(p => ({id:p.id,height:p.z,point:{x:p.easting,y:p.northing}}));
      }

      const sourceFrameForItrf = config.source_frame === "nad27" || config.source_frame === "itrf92" ? "itrf92" : config.source_frame;
      const geographic = working.map(p => {
        if (sourceFrameForItrf === "itrf92") {
          const coord = utmToGeographic(p.point.x,p.point.y,config.zone,config.hemisphere === "S");
          return {id:p.id,latitude:coord.latitude,longitude:coord.longitude,height:p.height};
        }
        const coord = utmToGeographic(p.point.x,p.point.y,config.zone,config.hemisphere === "S");
        return {id:p.id,latitude:coord.latitude,longitude:coord.longitude,height:p.height};
      });
      const trf = await callTranitrf(sourceFrameForItrf,geographic);
      const files = await unzipFiles(trf.zipBlob);
      if (!files["CALCULOS.txt"]) throw new Error("El ZIP de TRANITRF no contiene CALCULOS.txt.");
      const parsed = parseTranitrfCalculations(files["CALCULOS.txt"]);
      trf.calculos = files["CALCULOS.txt"];
      trf.variacion = files["VARIACION.txt"] || null;

      for (const point of points) {
        const result = parsed[point.id];
        if (!result) throw new Error(`TRANITRF no devolvió el punto ${point.id} en CALCULOS.txt.`);
        const utm = geographicToUtm(result.latitude,result.longitude,config.zone,config.hemisphere === "S");
        let target = {easting:utm.easting,northing:utm.northing};
        let finalExchange = null;
        if (config.target_frame === "nad27") {
          finalExchange = await callTraninv({easting:utm.easting,northing:utm.northing}, {source_frame:"itrf92",zone:config.zone});
          target = traninvUtm(finalExchange.response).nad27;
          target = {easting:target.x,northing:target.y};
        }
        const original = report.points.find(p => p.id === point.id) || {id:point.id};
        report.points[report.points.findIndex(p => p.id === point.id)] = {
          id:point.id,status:"transformado",source:{easting:point.easting,northing:point.northing,z:point.z},
          target,target_height:result.height,inegi_tranitrf:trf,inegi_traninv:finalExchange || original.inegi_traninv,
          warning:"Altura elipsoidal transformada únicamente si CALCULOS.txt la devuelve."
        };
      }
      messages.push("TRANITRF: lote procesado y ZIP descargado.");
    }
    renderResults(config,report.points,messages);
  } catch (error) {
    const text = error.name === "AbortError" ? "Una solicitud excedió el tiempo máximo de 30 segundos." : error.message;
    messages.push(text);
    renderResults(config,report.points,messages);
  } finally {
    report.finished_at = new Date().toISOString();
    showMessages(messages);
    currentReport = report;
    document.querySelector("#generateReport").disabled = false;
    busy = false;
    processing.hidden = true;
    updateInterface();
  }
}

function renderResults(config,points,messages) {
  const byId = new Map(points.map(p => [p.id,p]));
  resultRows.innerHTML = validPoints().map(source => {
    const point = byId.get(source.id) || {status:"bloqueado",warning:messages.join(" ")};
    return `<tr><td>${source.id}</td><td>${format(source.easting)}</td><td>${format(source.northing)}</td><td>${format(source.z)}</td>
      <td>${format(point.target?.easting)}</td><td>${format(point.target?.northing)}</td><td>${format(point.target_height)}</td>
      <td>${point.status || ""}</td><td class="${point.status === "bloqueado" ? "error" : ""}">${point.warning || ""}</td></tr>`;
  }).join("");
}

function tableTextForClipboard(table, includeHeaders = true) {
  const headers = includeHeaders ? [...table.querySelectorAll("thead th")]
    .map(cell => cell.textContent.trim()).join("\t") : "";
  const rows = [...table.querySelectorAll("tbody tr")]
    .filter(row => row.querySelectorAll("td").length && !row.classList.contains("empty-sheet"))
    .map(row => [...row.querySelectorAll("td")].map(cell => cell.textContent.trim()).join("\t"));
  return [headers,...rows].filter((line,index) => index === 0 || line).join("\n");
}

async function copyResults() {
  const table = document.querySelector("#messages").previousElementSibling.querySelector("table");
  const text = tableTextForClipboard(table);
  if (!table.querySelector("tbody tr td")) {
    showMessages(["No hay resultados para copiar."]);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  const button = document.querySelector("#copyResults");
  const original = button.textContent;
  button.textContent = "Copiado";
  showMessages(["Resultados copiados. Puede pegarlos directamente en Excel."]);
  window.setTimeout(() => button.textContent = original, 1600);
}

function showMessages(messages) {
  document.querySelector("#messageList").textContent = messages.join("\n") || "Sin mensajes.";
}

function showReport(report) {
  currentReport = report;
}

function escapeReport(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function generateReport() {
  if (!currentReport) return;
  const configNames = {
    source_frame: frameNames[currentReport.configuration.source_frame],
    target_frame: frameNames[currentReport.configuration.target_frame],
    zone: currentReport.configuration.zone,
    z_type: {ellipsoidal:"Altura elipsoidal",orthometric:"Elevación ortométrica",unconfirmed:"No confirmado"}[currentReport.configuration.z_type]
  };
  const rows = [...resultRows.querySelectorAll("tr")].map(row =>
    [...row.querySelectorAll("td")].map(cell => `<td>${escapeReport(cell.textContent)}</td>`).join(""));
  const reportHtml = `<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Reporte TRAN-ALL</title>
  <style>
    body{margin:0;background:#f5f6f8;color:#202126;font:14px Segoe UI,Arial,sans-serif}.page{max-width:1180px;margin:auto;padding:40px}.brand{border-left:4px solid #b91c1c;padding-left:16px}.brand h1{margin:0;font-size:28px}.brand p{margin:6px 0;color:#696d78}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:28px 0}.meta div{border:1px solid #d8dae0;border-radius:6px;padding:12px;background:white}.meta small{display:block;color:#777b87;font-size:11px}.meta strong{display:block;margin-top:4px;font-size:13px}.table-wrap{overflow:auto;border:1px solid #d8dae0;border-radius:6px;background:white}table{width:100%;border-collapse:collapse;min-width:900px;font-family:Consolas,monospace;font-size:11px}th,td{border-bottom:1px solid #e6e7eb;padding:9px;text-align:left}th{background:#eceef2;text-align:center}.footer{display:flex;justify-content:space-between;margin-top:16px;color:#777b87;font-size:11px}@media print{body{background:white}.page{padding:0}button{display:none}@page{margin:12mm}} 
  </style>
  <div class="page"><div class="brand"><h1>Reporte de transformación geodésica</h1><p>TRAN-ALL · servicios oficiales de INEGI</p></div>
  <section class="meta">${Object.entries(configNames).map(([key,value]) => `<div><small>${key === "source_frame" ? "Marco origen" : key === "target_frame" ? "Marco destino" : key === "zone" ? "Zona UTM" : "Tipo de Z"}</small><strong>${escapeReport(value)}</strong></div>`).join("")}</section>
  <div class="table-wrap"><table><thead><tr><th>ID</th><th>Este origen</th><th>Norte origen</th><th>Z original</th><th>Este destino</th><th>Norte destino</th><th>Altura destino</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>${rows.map(row => `<tr>${row}</tr>`).join("")}</tbody></table></div>
  <div class="footer"><span>${currentReport.points.length} puntos procesados</span><span>Generado: ${new Date(currentReport.finished_at || Date.now()).toLocaleString("es-MX")}</span></div></div>`;
  const blob = new Blob([reportHtml],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const reportWindow = window.open(url,"_blank","noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url),60000);
  if (!reportWindow) showMessages(["El reporte fue generado, pero el navegador bloqueó la pestaña nueva."]);
}

renderEditablePoints();
document.querySelector("#addPoint").addEventListener("click",addPointRow);
document.querySelector("#clearPoints").addEventListener("click",() => {
  inputPoints = [];
  renderEditablePoints();
});
document.querySelector("#swapCoordinates").addEventListener("click",swapCoordinates);
document.querySelector("#copyResults").addEventListener("click",copyResults);
document.querySelector("#generateReport").addEventListener("click",generateReport);
sourceRows.addEventListener("paste",pasteRows);
fields.forEach(id => document.querySelector("#" + id).addEventListener("change",updateInterface));
transformButton.addEventListener("click",transform);
updateInterface();
