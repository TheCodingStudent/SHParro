const tabs=[...document.querySelectorAll("[data-source]")];
const panels=[...document.querySelectorAll("[data-panel]")];
const batchRows=document.querySelector("#batchRows");
const batchData=[["",""]];
let batchResults=[];

const numberValue=value=>Number(String(value ?? "").trim().replace(/\s/g,"").replace(/,/g,"."));

tabs.forEach(tab=>tab.addEventListener("click",()=>{
  tabs.forEach(item=>item.classList.toggle("active",item===tab));
  panels.forEach(panel=>panel.hidden=panel.dataset.panel!==tab.dataset.source);
}));

function wcsUrl(lat,lon,resolution,format="GeoTIFF") {
  const delta=resolution===15?0.002:0.01;
  const coverage={15:"cem30_workespace:cem3_r15",30:"cem30_workespace:cem3_r30",60:"cem30_workespace:cem3_r60",90:"cem30_workespace:cem3_r90",120:"cem30_workespace:cem3_r120"}[resolution];
  const params=new URLSearchParams({
    service:"WCS",version:"1.0.0",request:"GetCoverage",coverage,
    crs:"EPSG:4326",bbox:[lon-delta,lat-delta,lon+delta,lat+delta].join(","),
    format,width:"32",height:"32"
  });
  return `https://gaia.inegi.org.mx/geoserver/cem30_workespace/wcs?${params}`;
}

function validPoint(lat,lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat>=14.5 && lat<=32.75 && lon>=-117.2 && lon<=-86.7;
}

async function queryPoint(lat,lon,resolution) {
  const response=await fetch(wcsUrl(lat,lon,resolution));
  if (!response.ok) throw new Error(`INEGI respondió ${response.status}.`);
  const data=await response.arrayBuffer();
  const tiff=await GeoTIFF.fromArrayBuffer(data);
  const image=await tiff.getImage();
  const raster=await image.readRasters({samples:[0]});
  const bbox=image.getBoundingBox();
  const width=image.getWidth(), height=image.getHeight();
  const col=Math.max(0,Math.min(width-1,Math.floor((lon-bbox[0])/(bbox[2]-bbox[0])*width)));
  const row=Math.max(0,Math.min(height-1,Math.floor((bbox[3]-lat)/(bbox[3]-bbox[1])*height)));
  const elevation=Number(raster[0][row*width+col]);
  if (!Number.isFinite(elevation) || elevation<=-32768) throw new Error("El punto no contiene una elevación válida.");
  return elevation;
}

document.querySelector("#queryWcs").addEventListener("click",async()=>{
  const lat=numberValue(document.querySelector("#latitude").value);
  const lon=numberValue(document.querySelector("#longitude").value);
  const resolution=Number(document.querySelector("#wcsResolution").value);
  const result=document.querySelector("#wcsResult");
  const status=document.querySelector("#wcsStatus");
  result.hidden=true;
  status.textContent="";
  if (!validPoint(lat,lon)) {
    status.textContent="Capture coordenadas geográficas válidas dentro de la cobertura CEM.";
    return;
  }
  try {
    status.textContent="Consultando cobertura WCS de INEGI...";
    const elevation=await queryPoint(lat,lon,resolution);
    result.innerHTML=`<span class="elevation-value">${elevation.toFixed(2)} m</span><br>Latitud ${lat.toFixed(6)} · Longitud ${lon.toFixed(6)} · CEM ${resolution} m`;
    result.hidden=false;
    const link=document.querySelector("#downloadRaster");
    link.hidden=false;
    link.href=wcsUrl(lat,lon,resolution);
    status.textContent="Consulta completada.";
  } catch (error) {
    status.textContent=`${error.message} Puede requerirse abrir la consulta desde el servidor de INEGI o habilitar acceso CORS/proxy.`;
  }
});

document.querySelector("#findChartDownloads").addEventListener("click",async()=>{
  const code=document.querySelector("#chartCode").value.trim().toUpperCase();
  const resolution=document.querySelector("#chartResolution").value;
  const model=document.querySelector("#chartModel").value;
  const container=document.querySelector("#chartResult");
  container.hidden=false;
  if (!code) {
    container.innerHTML="<b>Capture una clave de carta.</b>";
    return;
  }
  container.innerHTML="Consultando el catálogo oficial de cartas...";
  const endpoint="https://www.inegi.org.mx/app/geo2/elevacionesmex/getF10KDescarga.do";
  try {
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({res:resolution,mod:model,cve:code})});
    if (!response.ok) throw new Error(`INEGI respondió ${response.status}.`);
    const records=await response.json();
    if (!Array.isArray(records)||!records.length) {
      container.innerHTML=`No se encontró una carta ${code} con resolución ${resolution} m en el modelo seleccionado.`;
      return;
    }
    container.innerHTML=records.map(record=>{
      const url=typeof record==="string"?record:(record.url||record.archivo||record.descarga||record.href||Object.values(record)[0]);
      const name=typeof record==="object"?(record.nombre||record.name||record.archivo||code):url;
      return `<div class="download-item"><span>${name}</span><a href="${String(url).startsWith("http")?url:"https://www.inegi.org.mx/app/geo2/elevacionesmex/"+url}" target="_blank" rel="noopener">Descargar</a></div>`;
    }).join("");
  } catch (error) {
    container.innerHTML=`El navegador no pudo consultar el servicio de cartas: ${error.message}<br><br><a href="https://www.inegi.org.mx/app/geo2/elevacionesmex/" target="_blank" rel="noopener">Abrir catálogo oficial de MDE 5 m</a>`;
  }
});

function renderBatch() {
  batchRows.innerHTML=batchData.map((row,index)=>`<tr><td>${index+1}</td><td><input data-row="${index}" data-column="0" value="${row[0]??""}"></td><td><input data-row="${index}" data-column="1" value="${row[1]??""}"></td><td class="batch-elevation">${batchResults[index]??""}</td></tr>`).join("");
}

batchRows.addEventListener("input",event=>{
  const input=event.target;
  const row=Number(input.dataset.row),column=Number(input.dataset.column);
  if (!Number.isInteger(row)||!Number.isInteger(column)) return;
  batchData[row][column]=input.value;
  if (row===batchData.length-1) batchData.push(["",""]);
});
batchRows.addEventListener("paste",event=>{
  const text=event.clipboardData?.getData("text/plain");
  if (!text)return;
  event.preventDefault();
  const startRow=Number(event.target.dataset.row||0);
  text.trim().split(/\r?\n/).forEach((line,rowOffset)=>{
    const cells=line.includes("\t")?line.split("\t"):(line.includes(",")?[...line.matchAll(/(?:^|,)("([^"]|"")*"|[^,]*)/g)].map(match=>match[1]):[line]);
    while (batchData.length<=startRow+rowOffset) batchData.push(["",""]);
    batchData[startRow+rowOffset]=[cells[0]||"",cells[1]||""];
  });
  renderBatch();
});

document.querySelector("#clearBatch").addEventListener("click",()=>{
  batchData.splice(0,batchData.length,["",""]);batchResults=[];renderBatch();
});
document.querySelector("#queryBatch").addEventListener("click",async()=>{
  const resolution=15;
  batchResults=[];
  const status=document.querySelector("#batchStatus");
  const points=batchData.filter(row=>row[0]!==""||row[1]!=="");
  if (!points.length) return;
  status.textContent=`Consultando ${points.length} puntos...`;
  for (let index=0;index<batchData.length;index++) {
    if (!batchData[index][0]&&!batchData[index][1]) continue;
    const lat=numberValue(batchData[index][0]),lon=numberValue(batchData[index][1]);
    try {
      batchResults[index]=validPoint(lat,lon)?(await queryPoint(lat,lon,resolution)).toFixed(2):"Coordenada inválida";
    } catch {
      batchResults[index]="Error";
    }
  }
  renderBatch();
  status.textContent="Consulta masiva completada.";
});
document.querySelector("#copyBatch").addEventListener("click",()=>{
  const text=["Latitud\tLongitud\tElevacion m",...batchData.map((row,index)=>`${row[0]}\t${row[1]}\t${batchResults[index]??""}`)].join("\n");
  navigator.clipboard.writeText(text);
});
document.querySelector("#downloadCsv").addEventListener("click",()=>{
  const csv=["Latitud,Longitud,Elevacion m",...batchData.map((row,index)=>`${row[0]},${row[1]},${batchResults[index]??""}`)].join("\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
  link.download="consultas_cem.csv";link.click();
});
renderBatch();
