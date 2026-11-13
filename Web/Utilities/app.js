const PRECISION = 6;
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const mobilePanelButtons = [...document.querySelectorAll("[data-mobile-panel]")];
const mobilePanels = [...document.querySelectorAll("[data-mobile-panel-content]")];
const sheetRows = document.querySelector("#sheetRows");
const resultRows = document.querySelector("#resultRows");
const messages = document.querySelector("#messages");
let mode = "utm-geographic";
let sheet = [{a:"", b:""}];
let batchResults = [];

function setMobilePanel(panel) {
  mobilePanelButtons.forEach(button => button.classList.toggle("active", button.dataset.mobilePanel === panel));
  mobilePanels.forEach(section => section.classList.toggle("is-mobile-active", section.dataset.mobilePanelContent === panel));
}

mobilePanelButtons.forEach(button => button.addEventListener("click", () => setMobilePanel(button.dataset.mobilePanel)));

const DATUMS = {
  wgs84:{name:"WGS84",ellipsoid:"GRS80 / WGS84",axes:"a = 6 378 137 m",flattening:"1 / 298.257223563",epoch:"Fijo",note:"Marco mundial compatible con GNSS moderno."},
  nad27:{name:"NAD27",ellipsoid:"Clarke 1866",axes:"a = 6 378 206.4 m",flattening:"1 / 294.978698214",epoch:"Sin época dinámica",note:"Datum local norteamericano. Las transformaciones precisas requieren rejilla regional oficial."},
  itrf92:{name:"ITRF92",ellipsoid:"GRS80 / WGS84",axes:"a = 6 378 137 m",flattening:"1 / 298.257222101",epoch:"1988.0",note:"Marco terrestre internacional referido a la época 1988.0."},
  itrf2008:{name:"ITRF2008",ellipsoid:"GRS80 / WGS84",axes:"a = 6 378 137 m",flattening:"1 / 298.257222101",epoch:"2010.0",note:"Marco terrestre internacional referido a la época 2010.0."},
  itrf2014:{name:"ITRF2014",ellipsoid:"GRS80 / WGS84",axes:"a = 6 378 137 m",flattening:"1 / 298.257222101",epoch:"2010.0",note:"Marco terrestre actual. Requiere coordenadas en la época indicada y movimiento de placa para otros periodos."}
};

const toNumber = value => {
  const normalized = String(value ?? "").trim().replace(/\s/g,"").replace(/,/g,".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
};

function validateZone(zone) {
  const value = Number(zone);
  if (!Number.isInteger(value) || value < 1 || value > 60) throw new Error("La zona UTM debe estar entre 1 y 60.");
  return value;
}

function datumEllipsoid(datumKey) {
  return datumKey === "nad27"
    ? {a:6378206.4,f:1/294.978698214}
    : {a:6378137,f:1/298.257223563};
}

function utmToGeographic(easting,northing,zone,south = false,datumKey="wgs84") {
  validateZone(zone);
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) throw new Error("Este y norte deben ser números válidos.");
  const {a,f} = datumEllipsoid(datumKey), k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const x = easting - 500000;
  const y = south ? northing - 10000000 : northing;
  const M = y / k0;
  const mu = M / (a * (1 - e2/4 - 3*Math.pow(e2,2)/64 - 5*Math.pow(e2,3)/256));
  const e1 = (1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const phi = mu + (3*e1/2-27*Math.pow(e1,3)/32)*Math.sin(2*mu)
    + (21*Math.pow(e1,2)/16-55*Math.pow(e1,4)/32)*Math.sin(4*mu)
    + (151*Math.pow(e1,3)/96)*Math.sin(6*mu);
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi), tanPhi = Math.tan(phi);
  const N = a / Math.sqrt(1-e2*sinPhi*sinPhi);
  const T = tanPhi*tanPhi, C = ep2*cosPhi*cosPhi;
  const R = a*(1-e2)/Math.pow(1-e2*sinPhi*sinPhi,1.5);
  const D = x/(N*k0);
  const latitude = phi - (N*tanPhi/R)*(
    D*D/2-(5+3*T+10*C-4*C*C-9*ep2)*Math.pow(D,4)/24
    +(61+90*T+298*C+45*T*T-252*ep2-3*C*C)*Math.pow(D,6)/720);
  const longitude = ((zone-1)*6-180+3)*Math.PI/180 + (
    D-(1+2*T+C)*Math.pow(D,3)/6
    +(5-2*C+28*T-3*C*C+8*ep2+24*T*T)*Math.pow(D,5)/120)/cosPhi;
  return {latitude:latitude*180/Math.PI,longitude:longitude*180/Math.PI};
}

function geographicToUtm(latitude,longitude,zone,datumKey="wgs84") {
  validateZone(zone);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Latitud y longitud deben ser números válidos.");
  const southern = latitude < 0;
  if (!Number.isFinite(latitude) || latitude < -80 || latitude > 84) throw new Error("La latitud debe estar entre -80° y 84°.");
  const lon0 = (zone-1)*6-180+3;
  if (longitude < lon0-3 || longitude > lon0+3) throw new Error(`La longitud no pertenece a la zona ${zone}; el rango central recomendado es ${lon0-3}° a ${lon0+3}°.`);
  const {a,f}=datumEllipsoid(datumKey),k0=0.9996;
  const e2=f*(2-f), ep2=e2/(1-e2);
  const lat=latitude*Math.PI/180, lon=longitude*Math.PI/180, lonOrigin=lon0*Math.PI/180;
  const N=a/Math.sqrt(1-e2*Math.pow(Math.sin(lat),2));
  const T=Math.pow(Math.tan(lat),2), C=ep2*Math.pow(Math.cos(lat),2), A=Math.cos(lat)*(lon-lonOrigin);
  const M=a*((1-e2/4-3*Math.pow(e2,2)/64-5*Math.pow(e2,3)/256)*lat
    -(3*e2/8+3*Math.pow(e2,2)/32+45*Math.pow(e2,3)/1024)*Math.sin(2*lat)
    +(15*Math.pow(e2,2)/256+45*Math.pow(e2,3)/1024)*Math.sin(4*lat)
    -(35*Math.pow(e2,3)/3072)*Math.sin(6*lat));
  const easting=k0*N*(A+(1-T+C)*Math.pow(A,3)/6+(5-18*T+T*T+72*C-58*ep2)*Math.pow(A,5)/120)+500000;
  let northing=k0*(M+N*Math.tan(lat)*(Math.pow(A,2)/2+(5-T+9*C+4*C*C)*Math.pow(A,4)/24+(61-58*T+T*T+600*C-330*ep2)*Math.pow(A,6)/720));
  if (southern) northing += 10000000;
  return {easting,northing,south:southern};
}

function parseGeo(value,format) {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  if (format === "dd") return toNumber(text);
  const parts=text.replace(/,/g,".").split(/[\s°º'"]/u).filter(Boolean).map(toNumber);
  if (parts.length === 2 && format === "dmm") return parts[0] + Math.sign(parts[0])*parts[1]/60;
  if (parts.length === 3 && format === "dms") return parts[0] + Math.sign(parts[0])*parts[1]/60 + Math.sign(parts[0])*parts[2]/3600;
  return NaN;
}

function formatNumber(number) { return number.toFixed(PRECISION); }
function formatDms(number) {
  const sign=number<0?-1:1, absolute=Math.abs(number);
  const degrees=Math.floor(absolute);
  const minutesFull=(absolute-degrees)*60;
  const minutes=Math.floor(minutesFull);
  const seconds=(minutesFull-minutes)*60;
  return `${sign<0?"-":""}${degrees}° ${minutes}' ${seconds.toFixed(PRECISION)}"`;
}

function showMessage(text,error=false) { messages.className=error?"error":""; messages.textContent=text; }

function updateDatumInfo() {
  const key=document.querySelector("#sourceDatum").value;
  const datum=DATUMS[key];
  document.querySelector("#datumSummary").innerHTML=`
    <strong>${datum.name}</strong>
    <p>${datum.note}</p>
    <dl>
      <dt>Elipsoide</dt><dd>${datum.ellipsoid}</dd>
      <dt>Eje mayor</dt><dd>${datum.axes}</dd>
      <dt>Aplanamiento</dt><dd>${datum.flattening}</dd>
      <dt>Época</dt><dd>${datum.epoch}</dd>
    </dl>`;
  document.querySelector("header .eyebrow").textContent=`GEODESIA / UTILIDADES / ${datum.name}`;
}

function setMode(next) {
  mode=next;
  modeButtons.forEach(button=>button.classList.toggle("active",button.dataset.mode===mode));
  document.querySelector(".utm-fields").hidden=mode==="geographic-utm";
  document.querySelector(".geographic-fields").hidden=mode==="utm-geographic";
  renderSheet();
  showMessage("");
}

function renderSheet() {
  const headers=mode==="utm-geographic" ? ["Este","Norte"] : ["Latitud","Longitud"];
  document.querySelector("#sheetHeader").innerHTML=`<tr><th>#</th>${headers.map(x=>`<th>${x}</th>`).join("")}<th></th></tr>`;
  sheetRows.innerHTML=sheet.map((row,index)=>`
    <tr><td>${index+1}</td>
    <td><input class="sheet-input" data-index="${index}" data-field="a" value="${row.a ?? ""}"></td>
    <td><input class="sheet-input" data-index="${index}" data-field="b" value="${row.b ?? ""}"></td>
    <td><button type="button" data-remove="${index}" aria-label="Eliminar fila">×</button></td></tr>`).join("");
}

function syncSheetInputs() {
  sheetRows.querySelectorAll(".sheet-input").forEach(input=>{
    input.addEventListener("input",()=>{sheet[Number(input.dataset.index)][input.dataset.field]=input.value;});
  });
  sheetRows.querySelectorAll("[data-remove]").forEach(button=>{
    button.addEventListener("click",()=>{sheet.splice(Number(button.dataset.remove),1);if(!sheet.length)sheet=[{a:"",b:""}];renderSheet();syncSheetInputs();});
  });
}

document.querySelector("#convertSingle").addEventListener("click",()=>{
  try {
    const zone=validateZone(document.querySelector("#zone").value);
    let output;
    if(mode==="utm-geographic") {
      output=utmToGeographic(toNumber(document.querySelector("#singleEasting").value),toNumber(document.querySelector("#singleNorthing").value),zone,document.querySelector("#hemisphere").value==="S",document.querySelector("#sourceDatum").value);
      document.querySelector("#singleResult").innerHTML=`Datum de origen: <b>${DATUMS[document.querySelector("#sourceDatum").value].name}</b><br>Latitud: <b>${formatNumber(output.latitude)}</b><br>Longitud: <b>${formatNumber(output.longitude)}</b><br>DMS: <b>${formatDms(output.latitude)}</b>, <b>${formatDms(output.longitude)}</b>`;
    } else {
      const format=document.querySelector("#geoFormat").value;
      const latitude=parseGeo(document.querySelector("#latitude").value,format);
      const longitude=parseGeo(document.querySelector("#longitude").value,format);
      output=geographicToUtm(latitude,longitude,zone,document.querySelector("#sourceDatum").value);
      document.querySelector("#singleResult").innerHTML=`Datum de origen: <b>${DATUMS[document.querySelector("#sourceDatum").value].name}</b><br>Este: <b>${formatNumber(output.easting)}</b><br>Norte: <b>${formatNumber(output.northing)}</b><br>Zona: <b>${zone}</b> ${output.south?"S":"N"}`;
    }
    document.querySelector("#singleResult").hidden=false;
    showMessage("Conversión completada.");
  } catch(error){document.querySelector("#singleResult").hidden=true;showMessage(error.message,true);}
});

function convertBatch() {
  try {
    const zone=validateZone(document.querySelector("#zone").value);
    batchResults=[];
    sheet.forEach((row,index)=>{
      if(mode==="utm-geographic") {
        const output=utmToGeographic(toNumber(row.a),toNumber(row.b),zone,document.querySelector("#hemisphere").value==="S",document.querySelector("#sourceDatum").value);
        batchResults.push([formatNumber(output.latitude),formatNumber(output.longitude),DATUMS[document.querySelector("#sourceDatum").value].name]);
      } else {
        const format=document.querySelector("#geoFormat").value;
        const output=geographicToUtm(parseGeo(row.a,format),parseGeo(row.b,format),zone,document.querySelector("#sourceDatum").value);
        batchResults.push([formatNumber(output.easting),formatNumber(output.northing),DATUMS[document.querySelector("#sourceDatum").value].name]);
      }
      void index;
    });
    const headers=mode==="utm-geographic"?["Latitud","Longitud","Datum"]:["Este","Norte","Datum"];
    document.querySelector("#resultHeader").innerHTML=`<tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr>`;
    resultRows.innerHTML=batchResults.map(row=>`<tr>${row.map(value=>`<td>${value}</td>`).join("")}</tr>`).join("");
    document.querySelector("#batchResultWrap").hidden=false;
    document.querySelector("#copyResults").disabled=false;
    document.querySelector("#downloadCsv").disabled=false;
    showMessage(`${batchResults.length} coordenadas convertidas.`);
  } catch(error){showMessage(error.message,true);}
}

function copyResults() {
  const headers=mode==="utm-geographic"?"Latitud\tLongitud\tDatum":"Este\tNorte\tDatum";
  const text=[headers,...batchResults.map(row=>row.join("\t"))].join("\n");
  navigator.clipboard.writeText(text).then(()=>showMessage("Resultados copiados para pegar en Excel."));
}

function downloadCsv() {
  const headers=mode==="utm-geographic"?"Latitud,Longitud,Datum":"Este,Norte,Datum";
  const blob=new Blob([`\ufeff${headers}\r\n${batchResults.map(row=>row.join(",")).join("\r\n")}`],{type:"text/csv;charset=utf-8"});
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);link.download="coordenadas_convertidas.csv";link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

modeButtons.forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
document.querySelector("#sourceDatum").addEventListener("change",()=>{updateDatumInfo();showMessage(`Datum de origen cambiado a ${DATUMS[document.querySelector("#sourceDatum").value].name}.`);});
document.querySelector("#convertBatch").addEventListener("click",convertBatch);
document.querySelector("#copyResults").addEventListener("click",copyResults);
document.querySelector("#downloadCsv").addEventListener("click",downloadCsv);
document.querySelector("#clearSheet").addEventListener("click",()=>{sheet=[{a:"",b:""}];batchResults=[];renderSheet();syncSheetInputs();document.querySelector("#batchResultWrap").hidden=true;document.querySelector("#copyResults").disabled=true;document.querySelector("#downloadCsv").disabled=true;showMessage("");});
document.querySelector("#swapCoordinates").addEventListener("click",()=>{sheet.forEach(row=>{const value=row.a;row.a=row.b;row.b=value;});renderSheet();syncSheetInputs();});
sheetRows.addEventListener("paste",event=>{
  const text=event.clipboardData?.getData("text/plain");if(!text)return;
  event.preventDefault();
  const start=Number(event.target.dataset.index||0);
  text.trim().split(/\r?\n/).forEach((line,rowOffset)=>{
    const cells=line.split(/\t|,/);
    sheet[start+rowOffset]={a:cells[0]||"",b:cells[1]||""};
  });
  renderSheet();syncSheetInputs();
});

renderSheet();syncSheetInputs();setMode(mode);updateDatumInfo();

function fitDatumSidebarToStepTwo() {
  const sidebar=document.querySelector(".datum-sidebar");
  const cards=document.querySelectorAll("main .card");
  if (!sidebar || cards.length < 2 || window.innerWidth <= 900) {
    if (sidebar) sidebar.style.height="";
    return;
  }
  const sidebarTop=sidebar.getBoundingClientRect().top;
  const stepTwoBottom=cards[1].getBoundingClientRect().bottom;
  sidebar.style.height=`${Math.max(520,stepTwoBottom-sidebarTop)}px`;
}

window.addEventListener("resize",fitDatumSidebarToStepTwo);
if ("ResizeObserver" in window) {
  const observer=new ResizeObserver(fitDatumSidebarToStepTwo);
  observer.observe(document.querySelector("main"));
}
requestAnimationFrame(()=>requestAnimationFrame(fitDatumSidebarToStepTwo));
