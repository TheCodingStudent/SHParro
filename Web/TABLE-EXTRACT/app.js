import * as pdfjsLib from "./vendor/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).toString();

const state = {
  documents: [],
  templates: [],
  selectedDocumentId: null,
  selectedPageNumber: null,
  zoom: 1,
  renderTask: null,
  loading: false
};

const $ = selector => document.querySelector(selector);

function createId(prefix) {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value ?? "";
  return element.innerHTML;
}

function selectedDocument() {
  return state.documents.find(documentItem => documentItem.id === state.selectedDocumentId) || null;
}

function selectedPage() {
  const documentItem = selectedDocument();
  return documentItem?.pages.find(page => page.number === state.selectedPageNumber) || null;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $("#toastRegion").append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function setPageStatus(message) {
  $("#pageStatus").textContent = message;
}

function pageStateLabel(page) {
  const labels = {
    "sin-plantilla": "Sin plantilla",
    "plantilla-asignada": "Plantilla asignada",
    "lista-para-procesar": "Lista para procesar",
    procesada: "Procesada",
    "requiere-revision": "Requiere revisión",
    error: "Error"
  };
  return labels[page.status] || labels["sin-plantilla"];
}

function renderDocuments() {
  $("#documentCount").textContent = state.documents.length;
  const list = $("#documentsList");
  if (!state.documents.length) {
    list.innerHTML = '<div class="empty-state">Añade uno o varios PDFs para comenzar.</div>';
    return;
  }
  list.innerHTML = state.documents.map(documentItem => `
    <button class="document-item ${documentItem.id === state.selectedDocumentId ? "active" : ""}" type="button" data-document-id="${escapeHtml(documentItem.id)}">
      <div class="document-name" title="${escapeHtml(documentItem.name)}">${escapeHtml(documentItem.name)}</div>
      <div class="document-meta">${documentItem.pageCount} página${documentItem.pageCount === 1 ? "" : "s"}</div>
      <span class="status-chip ${documentItem.error ? "error" : "ready"}">${documentItem.error ? "Error de lectura" : "Cargado"}</span>
    </button>`).join("");
  list.querySelectorAll("[data-document-id]").forEach(button => button.addEventListener("click", () => selectDocument(button.dataset.documentId)));
}

function renderPages() {
  const documentItem = selectedDocument();
  const list = $("#pagesList");
  if (!documentItem) {
    list.innerHTML = '<div class="empty-state">Las páginas se listarán aquí.</div>';
    return;
  }
  list.innerHTML = documentItem.pages.map(page => `
    <button class="page-item ${page.number === state.selectedPageNumber ? "active" : ""}" type="button" data-page-number="${page.number}">
      <canvas class="page-thumb" width="34" height="45" aria-hidden="true"></canvas>
      <span><div class="page-name">Página ${page.number}</div><div class="page-meta">${pageStateLabel(page)}</div></span>
    </button>`).join("");
  list.querySelectorAll("[data-page-number]").forEach(button => button.addEventListener("click", () => selectPage(Number(button.dataset.pageNumber))));
  documentItem.pages.forEach(page => renderThumbnail(page));
}

async function renderThumbnail(page) {
  const button = $((`[data-page-number="${page.number}"]`));
  const canvas = button?.querySelector("canvas");
  if (!canvas) return;
  try {
    const pdfPage = await selectedDocument().pdf.getPage(page.number);
    const viewport = pdfPage.getViewport({ scale: .16 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  } catch {
    // La vista principal informará los errores de renderizado.
  }
}

function renderTemplates() {
  $("#templateCount").textContent = state.templates.length;
  const list = $("#templatesList");
  if (!state.templates.length) {
    list.innerHTML = '<div class="empty-state">Importa un archivo JSON para agregar plantillas.</div>';
    return;
  }
  list.innerHTML = state.templates.map(template => `
    <div class="template-item">
      <div>
        <div class="template-name" title="${escapeHtml(template.nombre || template.name || template.id)}">${escapeHtml(template.nombre || template.name || template.id)}</div>
        <div class="template-meta">${escapeHtml(template.descripcion || "Sin descripción")}</div>
      </div>
      <button class="secondary-button" type="button" data-assign-template="${escapeHtml(template.id)}">Asignar</button>
    </div>`).join("");
  list.querySelectorAll("[data-assign-template]").forEach(button => button.addEventListener("click", () => assignTemplate(button.dataset.assignTemplate)));
}

async function renderCurrentPage() {
  const documentItem = selectedDocument();
  const page = selectedPage();
  const canvas = $("#pageCanvas");
  if (state.renderTask) {
    state.renderTask.cancel();
    try { await state.renderTask.promise; } catch { /* render cancelado intencionalmente */ }
    state.renderTask = null;
  }
  if (!documentItem || !page) {
    canvas.hidden = true;
    $("#viewerTitle").textContent = "Selecciona un documento";
    $("#pageIndicator").textContent = "— / —";
    $("#zoomIndicator").textContent = "100%";
    setPageStatus("Sin documento seleccionado.");
    return;
  }
  try {
    const pdfPage = await documentItem.pdf.getPage(page.number);
    const viewport = pdfPage.getViewport({ scale: state.zoom });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.hidden = false;
    const renderTask = pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport });
    state.renderTask = renderTask;
    await renderTask.promise;
    if (state.renderTask === renderTask) state.renderTask = null;
    $("#viewerTitle").textContent = documentItem.name;
    $("#pageIndicator").textContent = `${page.number} / ${documentItem.pageCount}`;
    $("#zoomIndicator").textContent = `${Math.round(state.zoom * 100)}%`;
    setPageStatus(`Página ${page.number}: ${pageStateLabel(page)}${page.templateId ? ` · ${templateName(page.templateId)}` : ""}`);
  } catch (error) {
    if (error?.name === "RenderingCancelledException") return;
    canvas.hidden = true;
    setPageStatus("No se pudo renderizar esta página.");
    showToast("No se pudo renderizar la página seleccionada.", "error");
    console.warn(error);
  }
}

function templateName(id) {
  const template = state.templates.find(item => item.id === id);
  return template ? (template.nombre || template.name || template.id) : "Plantilla desconocida";
}

function selectDocument(id) {
  state.selectedDocumentId = id;
  const documentItem = selectedDocument();
  state.selectedPageNumber = documentItem?.pages[0]?.number || null;
  state.zoom = 1;
  renderDocuments();
  renderPages();
  renderCurrentPage();
}

function selectPage(number) {
  state.selectedPageNumber = number;
  state.zoom = 1;
  renderPages();
  renderCurrentPage();
}

function assignTemplate(templateId) {
  const page = selectedPage();
  if (!page) return showToast("Selecciona una página antes de asignar una plantilla.", "error");
  page.templateId = templateId;
  page.status = "plantilla-asignada";
  renderPages();
  renderCurrentPage();
  showToast(`Plantilla asignada a la página ${page.number}.`);
}

async function addFiles(fileList) {
  const files = [...fileList].filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!files.length) return;
  for (const file of files) {
    const duplicate = state.documents.some(documentItem => documentItem.name === file.name && documentItem.file.size === file.size && documentItem.file.lastModified === file.lastModified);
    if (duplicate) continue;
    const documentItem = { id: createId("pdf"), file, name: file.name, pdf: null, pageCount: 0, pages: [], error: null };
    try {
      const data = await file.arrayBuffer();
      documentItem.pdf = await pdfjsLib.getDocument({ data }).promise;
      documentItem.pageCount = documentItem.pdf.numPages;
      documentItem.pages = Array.from({ length: documentItem.pageCount }, (_, index) => ({ number: index + 1, status: "sin-plantilla", templateId: null }));
      state.documents.push(documentItem);
    } catch (error) {
      documentItem.error = error?.message || "PDF no válido";
      state.documents.push(documentItem);
    }
  }
  renderDocuments();
  const validDocument = state.documents.find(documentItem => !documentItem.error && documentItem.id === state.selectedDocumentId) || state.documents.find(documentItem => !documentItem.error);
  if (validDocument && !state.selectedDocumentId) selectDocument(validDocument.id);
  else if (validDocument) { renderPages(); renderCurrentPage(); }
  showToast(`${files.length} archivo${files.length === 1 ? "" : "s"} revisado${files.length === 1 ? "" : "s"}.`);
}

async function importTemplates(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const templates = Array.isArray(parsed) ? parsed : parsed.plantillas;
    if (!Array.isArray(templates)) throw new Error("El JSON no contiene un arreglo de plantillas.");
    state.templates = templates.filter(template => template && template.id);
    renderTemplates();
    renderCurrentPage();
    showToast(`${state.templates.length} plantilla${state.templates.length === 1 ? "" : "s"} cargada${state.templates.length === 1 ? "" : "s"}.`);
  } catch (error) {
    showToast(`No se pudo importar el JSON: ${error.message}`, "error");
  }
}

function exportTemplates() {
  const payload = JSON.stringify({ version: "1.0", plantillas: state.templates }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantillas-table-extract.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Archivo JSON de plantillas descargado.");
}

async function loadStarterTemplates() {
  try {
    const response = await fetch("./templates.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();
    state.templates = Array.isArray(parsed) ? parsed : (parsed.plantillas || []);
  } catch {
    state.templates = [];
  }
  renderTemplates();
}

$("#pdfFiles").addEventListener("change", event => { addFiles(event.target.files); event.target.value = ""; });
$("#pdfFolder").addEventListener("change", event => { addFiles(event.target.files); event.target.value = ""; });
$("#templateFile").addEventListener("change", event => { const [file] = event.target.files; if (file) importTemplates(file); event.target.value = ""; });
$("#exportTemplates").addEventListener("click", exportTemplates);
$("#previousPage").addEventListener("click", () => { if (state.selectedPageNumber > 1) selectPage(state.selectedPageNumber - 1); });
$("#nextPage").addEventListener("click", () => { const documentItem = selectedDocument(); if (documentItem && state.selectedPageNumber < documentItem.pageCount) selectPage(state.selectedPageNumber + 1); });
$("#zoomOut").addEventListener("click", () => { state.zoom = Math.max(.5, state.zoom - .1); renderCurrentPage(); });
$("#zoomIn").addEventListener("click", () => { state.zoom = Math.min(2.5, state.zoom + .1); renderCurrentPage(); });

loadStarterTemplates();
