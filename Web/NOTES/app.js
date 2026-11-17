(() => {
  "use strict";

  const categories = ["Reporte", "Inspección", "Evidencia", "Hallazgo", "Otro"];
  const state = {
    notes: [],
    projects: [],
    activeProjectId: null,
    draft: createDraft(),
    editingNoteId: null,
    projectDialogMode: "create",
    confirmAction: null,
    storageReady: false,
    location: { status: "unknown", position: null, watchId: null },
    locationDecision: null
  };

  const DB_NAME = "SHParroFieldNotes";
  const DB_VERSION = 1;
  let database = null;

  const $ = selector => document.querySelector(selector);
  const draftImages = $("#draftImages");
  const savedNotes = $("#savedNotes");
  const formMessage = $("#formMessage");

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB no está disponible en este navegador."));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("notes")) {
          const notes = db.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("projectId", "projectId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
    });
  }

  function storeRequest(storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveProject(project) {
    await storeRequest("projects", "readwrite", store => store.put(project));
  }

  async function saveNoteRecord(note) {
    await storeRequest("notes", "readwrite", store => store.put(note));
  }

  async function deleteNoteRecord(id) {
    await storeRequest("notes", "readwrite", store => store.delete(id));
  }

  async function deleteProjectRecords(projectId) {
    const notes = await storeRequest("notes", "readonly", store => store.index("projectId").getAll(projectId));
    await Promise.all(notes.map(note => deleteNoteRecord(note.id)));
    await storeRequest("projects", "readwrite", store => store.delete(projectId));
  }

  async function getProjects() {
    return storeRequest("projects", "readonly", store => store.getAll());
  }

  async function getProjectNotes(projectId) {
    return storeRequest("notes", "readonly", store => store.index("projectId").getAll(projectId));
  }

  function setStorageStatus(message, error = false) {
    const status = $("#storageStatus");
    status.textContent = message;
    status.classList.toggle("error", error);
    $("#persistenceBadge").classList.toggle("warning", error);
  }

  function projectNameIsValid(name) {
    return name && name.trim().length >= 2 && name.trim().length <= 80;
  }

  function createDraft() {
    return { title: "", description: "", category: categories[0], images: [] };
  }

  function createId(prefix) {
    if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatCoordinate(value) {
    return Number(value).toFixed(6);
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value ?? "";
    return element.innerHTML;
  }

  function updateLocationStatus() {
    const status = $("#locationSessionStatus");
    status.className = "location-session-status";
    if (state.location.status === "ready") {
      status.classList.add("ready");
      status.textContent = "Ubicación activa para esta sesión; se asignará a las nuevas imágenes.";
    } else if (state.location.status === "denied") {
      status.classList.add("warning");
      status.textContent = "Sesión sin ubicación; las nuevas imágenes se guardarán sin coordenadas.";
    } else if (state.location.status === "requesting") {
      status.textContent = "Solicitando ubicación del dispositivo…";
    } else {
      status.textContent = "Ubicación: aún no solicitada";
    }
  }

  function requestLocationOnce() {
    if (state.location.status === "ready") return Promise.resolve(state.location.position);
    if (state.location.status === "denied") return Promise.resolve(null);
    if (state.location.status === "requesting") return new Promise(resolve => { state.location.resolve = resolve; });
    if (!navigator.geolocation) {
      state.location.status = "denied";
      updateLocationStatus();
      return Promise.resolve(null);
    }

    state.location.status = "requesting";
    updateLocationStatus();
    return new Promise(resolve => {
      state.location.resolve = resolve;
      navigator.geolocation.getCurrentPosition(
        position => {
          state.location.status = "ready";
          state.location.position = position;
          updateLocationStatus();
          state.location.resolve?.(position);
          state.location.resolve = null;
        },
        () => {
          state.location.status = "denied";
          updateLocationStatus();
          state.location.resolve?.(null);
          state.location.resolve = null;
          openLocationModal();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  }

  function openLocationModal() {
    $("#locationModal").classList.remove("hidden");
    $("#continueWithoutLocation").focus();
  }

  function closeLocationModal(decision) {
    state.locationDecision = decision;
    $("#locationModal").classList.add("hidden");
    if (decision === "continue") {
      state.location.status = "denied";
      updateLocationStatus();
      processPendingFiles();
    } else {
      pendingFiles = [];
    }
  }

  let pendingFiles = [];

  async function handleImageSelection(event) {
    const files = [...event.target.files].filter(file => file.type.startsWith("image/"));
    event.target.value = "";
    if (!files.length) return;
    pendingFiles = files;
    const position = await requestLocationOnce();
    if (!position && state.location.status === "denied" && state.locationDecision !== "continue") {
      openLocationModal();
      return;
    }
    if (position || state.location.status === "ready" || state.location.status === "denied") processPendingFiles(position);
  }

  function processPendingFiles(position = state.location.position) {
    if (!pendingFiles.length) return;
    if (state.location.status === "requesting") return;
    if (state.location.status === "denied" && state.locationDecision !== "continue") return;
    const files = pendingFiles;
    pendingFiles = [];
    files.forEach(file => {
      state.draft.images.push({
        id: createId("image"),
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        location: position ? {
          latitude: formatCoordinate(position.coords.latitude),
          longitude: formatCoordinate(position.coords.longitude),
          accuracy: Math.round(position.coords.accuracy)
        } : null
      });
    });
    state.locationDecision = null;
    renderDraftImages();
    showMessage(`${files.length} imagen${files.length === 1 ? "" : "es"} añadida${files.length === 1 ? "" : "s"}.`);
  }

  function renderDraftImages() {
    if (!state.draft.images.length) {
      draftImages.innerHTML = '<div class="empty-images">Añade una o varias imágenes para comenzar.</div>';
      return;
    }
    draftImages.innerHTML = state.draft.images.map((image, index) => {
      const locationText = image.location
        ? `${image.location.latitude}, ${image.location.longitude}<br>Precisión ±${image.location.accuracy} m`
        : "Esta imagen no tiene coordenadas";
      return `
        <article class="image-item" draggable="true" data-image-id="${escapeHtml(image.id)}">
          <img class="image-preview" src="${image.previewUrl}" alt="Vista previa de ${escapeHtml(image.name)}">
          <div>
            <div class="image-name" title="${escapeHtml(image.name)}">${escapeHtml(image.name)}</div>
            <div class="image-location">${locationText}</div>
            <span class="location-tag ${image.location ? "" : "no-location"}">${image.location ? "Con ubicación" : "Sin ubicación"}</span>
          </div>
          <div class="image-actions" aria-label="Acciones para imagen ${index + 1}">
            <button class="image-action" type="button" data-action="up" data-image-id="${escapeHtml(image.id)}" aria-label="Subir imagen" ${index === 0 ? "disabled" : ""}>↑</button>
            <button class="image-action" type="button" data-action="down" data-image-id="${escapeHtml(image.id)}" aria-label="Bajar imagen" ${index === state.draft.images.length - 1 ? "disabled" : ""}>↓</button>
            <button class="image-action remove" type="button" data-action="remove" data-image-id="${escapeHtml(image.id)}" aria-label="Eliminar imagen">×</button>
          </div>
        </article>`;
    }).join("");
    bindImageActions();
  }

  function bindImageActions() {
    draftImages.querySelectorAll("button[data-action]").forEach(button => button.addEventListener("click", () => {
      const index = state.draft.images.findIndex(image => image.id === button.dataset.imageId);
      if (index < 0) return;
      const action = button.dataset.action;
      if (action === "remove") {
        const [removed] = state.draft.images.splice(index, 1);
        if (removed.previewUrl && !state.notes.some(note => note.images.some(image => image.id === removed.id))) URL.revokeObjectURL(removed.previewUrl);
      } else if (action === "up" && index > 0) {
        [state.draft.images[index - 1], state.draft.images[index]] = [state.draft.images[index], state.draft.images[index - 1]];
      } else if (action === "down" && index < state.draft.images.length - 1) {
        [state.draft.images[index + 1], state.draft.images[index]] = [state.draft.images[index], state.draft.images[index + 1]];
      }
      renderDraftImages();
    }));

    draftImages.querySelectorAll(".image-item").forEach(item => {
      item.addEventListener("dragstart", () => item.classList.add("dragging"));
      item.addEventListener("dragend", () => item.classList.remove("dragging"));
      item.addEventListener("dragover", event => event.preventDefault());
      item.addEventListener("drop", event => {
        event.preventDefault();
        const dragging = draftImages.querySelector(".dragging");
        if (!dragging || dragging === item) return;
        const from = state.draft.images.findIndex(image => image.id === dragging.dataset.imageId);
        const to = state.draft.images.findIndex(image => image.id === item.dataset.imageId);
        const [moved] = state.draft.images.splice(from, 1);
        state.draft.images.splice(to, 0, moved);
        renderDraftImages();
      });
    });
  }

  function readDraftFields() {
    state.draft.title = $("#noteTitle").value.trim();
    state.draft.description = $("#noteDescription").value.trim();
    state.draft.category = $("#noteCategory").value;
  }

  function serializeNote(note) {
    return {
      id: note.id,
      projectId: note.projectId,
      title: note.title,
      description: note.description,
      category: note.category,
      createdAt: note.createdAt,
      images: note.images.map(image => ({
        id: image.id,
        name: image.name,
        blob: image.blob || image.file,
        location: image.location || null
      }))
    };
  }

  function hydrateNote(note) {
    return {
      ...note,
      images: note.images.map(image => ({
        ...image,
        file: image.blob,
        previewUrl: URL.createObjectURL(image.blob)
      }))
    };
  }

  async function saveNote() {
    readDraftFields();
    if (!state.draft.title) return showMessage("Agrega un título para guardar la nota.", true);
    if (!state.draft.images.length) return showMessage("Añade al menos una imagen para guardar la nota.", true);
    const note = {
      id: state.editingNoteId || createId("note"),
      projectId: state.activeProjectId,
      title: state.draft.title,
      description: state.draft.description,
      category: state.draft.category,
      images: state.draft.images.map(image => ({ ...image })),
      createdAt: state.editingNoteId ? (state.notes.find(noteItem => noteItem.id === state.editingNoteId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    const existingIndex = state.notes.findIndex(noteItem => noteItem.id === note.id);
    const previousNote = existingIndex >= 0 ? state.notes[existingIndex] : null;
    if (existingIndex >= 0) state.notes.splice(existingIndex, 1, note);
    else state.notes.unshift(note);
    if (state.storageReady) {
      try {
        await saveNoteRecord(serializeNote(note));
      } catch (error) {
        if (existingIndex >= 0) state.notes.splice(existingIndex, 1, previousNote);
        else state.notes.shift();
        return showMessage("No se pudo guardar la nota localmente.", true);
      }
    }
    showMessage(state.editingNoteId ? "Nota actualizada." : "Nota guardada.");
    resetEditor();
    renderSavedNotes();
  }

  function resetEditor() {
    state.draft = createDraft();
    state.editingNoteId = null;
    $("#noteTitle").value = "";
    $("#noteDescription").value = "";
    $("#noteCategory").value = categories[0];
    $("#editorTitle").textContent = "Crear nota";
    $("#editorMode").textContent = "Nueva nota";
    $("#cancelEdit").classList.add("hidden");
    renderDraftImages();
  }

  function editNote(id) {
    const note = state.notes.find(noteItem => noteItem.id === id);
    if (!note) return;
    state.editingNoteId = id;
    state.draft = { title: note.title, description: note.description, category: note.category, images: note.images.map(image => ({ ...image })) };
    $("#noteTitle").value = note.title;
    $("#noteDescription").value = note.description;
    $("#noteCategory").value = note.category;
    $("#editorTitle").textContent = "Editar nota";
    $("#editorMode").textContent = "Edición";
    $("#cancelEdit").classList.remove("hidden");
    renderDraftImages();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteNote(id) {
    const note = state.notes.find(noteItem => noteItem.id === id);
    if (!note) return;
    openConfirm("¿Eliminar esta nota del proyecto?", () => deleteNoteConfirmed(id));
  }

  async function deleteNoteConfirmed(id) {
    const note = state.notes.find(noteItem => noteItem.id === id);
    if (!note) return;
    try {
      if (state.storageReady) await deleteNoteRecord(id);
      note.images.forEach(image => URL.revokeObjectURL(image.previewUrl));
      state.notes = state.notes.filter(noteItem => noteItem.id !== id);
    } catch {
      showMessage("No se pudo eliminar la nota localmente.", true);
      return;
    }
    if (state.editingNoteId === id) resetEditor();
    renderSavedNotes();
  }

  function renderProjectSelect() {
    const select = $("#projectSelect");
    select.innerHTML = state.projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    select.value = state.activeProjectId || "";
  }

  async function loadActiveProject() {
    const notes = await getProjectNotes(state.activeProjectId);
    state.notes = notes.map(hydrateNote).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    resetEditor();
    renderSavedNotes();
    renderProjectSelect();
  }

  async function selectProject(projectId) {
    if (!state.projects.some(project => project.id === projectId)) return;
    state.activeProjectId = projectId;
    localStorage.setItem("shparro.activeFieldProject", projectId);
    await loadActiveProject();
    setStorageStatus("Los cambios se guardan automáticamente en este dispositivo.");
  }

  async function createProject() {
    if (!state.storageReady) return showMessage("Los proyectos requieren almacenamiento local disponible.", true);
    openProjectModal("create");
  }

  async function renameProject() {
    if (!state.storageReady) return showMessage("Los proyectos requieren almacenamiento local disponible.", true);
    const project = state.projects.find(item => item.id === state.activeProjectId);
    if (!project) return;
    openProjectModal("rename", project.name);
  }

  function openProjectModal(mode, value = "") {
    state.projectDialogMode = mode;
    $("#projectModalTitle").textContent = mode === "rename" ? "Renombrar proyecto" : "Nuevo proyecto";
    $("#confirmProject").textContent = mode === "rename" ? "Guardar nombre" : "Guardar proyecto";
    $("#projectNameInput").value = value;
    $("#projectModalError").textContent = "";
    $("#projectModal").classList.remove("hidden");
    $("#projectNameInput").focus();
  }

  function closeProjectModal() {
    $("#projectModal").classList.add("hidden");
  }

  async function confirmProjectAction() {
    const input = $("#projectNameInput");
    const name = input.value.trim();
    if (!projectNameIsValid(name)) {
      $("#projectModalError").textContent = "Usa un nombre de entre 2 y 80 caracteres.";
      input.focus();
      return;
    }
    if (state.projectDialogMode === "rename") {
      const project = state.projects.find(item => item.id === state.activeProjectId);
      if (!project) return closeProjectModal();
      project.name = name;
      project.updatedAt = new Date().toISOString();
      await saveProject(project);
      renderProjectSelect();
      setStorageStatus("Proyecto renombrado y guardado localmente.");
    } else {
      const project = { id: createId("project"), name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await saveProject(project);
      state.projects.push(project);
      await selectProject(project.id);
    }
    closeProjectModal();
  }

  async function deleteProject() {
    if (!state.storageReady) return showMessage("Los proyectos requieren almacenamiento local disponible.", true);
    const project = state.projects.find(item => item.id === state.activeProjectId);
    if (!project) return;
    openConfirm(`¿Eliminar el proyecto “${project.name}” y todas sus notas?`, deleteActiveProject);
  }

  async function deleteActiveProject() {
    const project = state.projects.find(item => item.id === state.activeProjectId);
    if (!project) return;
    await deleteProjectRecords(project.id);
    state.projects = state.projects.filter(item => item.id !== project.id);
    if (!state.projects.length) {
      const defaultProject = { id: createId("project"), name: "Proyecto de campo", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await saveProject(defaultProject);
      state.projects.push(defaultProject);
    }
    await selectProject(state.projects[0].id);
  }

  function openConfirm(message, action) {
    state.confirmAction = action;
    $("#confirmModalText").textContent = message;
    $("#confirmModal").classList.remove("hidden");
    $("#acceptConfirm").focus();
  }

  function closeConfirm() {
    state.confirmAction = null;
    $("#confirmModal").classList.add("hidden");
  }

  async function acceptConfirm() {
    const action = state.confirmAction;
    closeConfirm();
    if (action) await action();
  }

  async function initializeStorage() {
    try {
      database = await openDatabase();
      state.projects = await getProjects();
      if (!state.projects.length) {
        const project = { id: createId("project"), name: "Proyecto de campo", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await saveProject(project);
        state.projects = [project];
      }
      const storedActiveId = localStorage.getItem("shparro.activeFieldProject");
      state.activeProjectId = state.projects.some(project => project.id === storedActiveId) ? storedActiveId : state.projects[0].id;
      state.storageReady = true;
      await loadActiveProject();
      setStorageStatus("Los cambios se guardan automáticamente en este dispositivo.");
    } catch (error) {
      state.storageReady = false;
      state.projects = [{ id: "session-project", name: "Proyecto de sesión", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
      state.activeProjectId = state.projects[0].id;
      renderProjectSelect();
      renderSavedNotes();
      setStorageStatus("El almacenamiento local no está disponible; se usará solo esta sesión.", true);
      console.warn(error);
    }
  }

  function renderSavedNotes() {
    $("#notesCount").textContent = state.notes.length;
    if (!state.notes.length) {
      savedNotes.innerHTML = '<div class="empty-notes">Todavía no hay notas guardadas.</div>';
      return;
    }
    savedNotes.innerHTML = state.notes.map(note => `
      <article class="saved-note">
        <div class="saved-note-header"><h3 title="${escapeHtml(note.title)}">${escapeHtml(note.title)}</h3><span class="saved-note-category">${escapeHtml(note.category)}</span></div>
        ${note.description ? `<p>${escapeHtml(note.description)}</p>` : ""}
        <div class="saved-note-meta">${note.images.length} imagen${note.images.length === 1 ? "" : "es"} · ${note.images.filter(image => image.location).length} con ubicación</div>
        <div class="saved-note-actions"><button type="button" data-note-action="edit" data-note-id="${escapeHtml(note.id)}">Editar</button><button type="button" data-note-action="delete" data-note-id="${escapeHtml(note.id)}">Eliminar</button></div>
      </article>`).join("");
    savedNotes.querySelectorAll("[data-note-action]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.noteAction === "edit") editNote(button.dataset.noteId);
      else deleteNote(button.dataset.noteId);
    }));
  }

  function showMessage(message, error = false) {
    formMessage.textContent = message;
    formMessage.style.color = error ? "#9a4d39" : "var(--muted)";
  }

  $("#imageInput").addEventListener("change", handleImageSelection);
  $("#saveNote").addEventListener("click", saveNote);
  $("#clearDraft").addEventListener("click", () => { resetEditor(); showMessage("Borrador limpiado."); });
  $("#cancelEdit").addEventListener("click", () => { resetEditor(); showMessage("Edición cancelada."); });
  $("#continueWithoutLocation").addEventListener("click", () => closeLocationModal("continue"));
  $("#cancelLocation").addEventListener("click", () => closeLocationModal("cancel"));
  $("#locationModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeLocationModal("cancel"); });
  $("#projectSelect").addEventListener("change", event => selectProject(event.target.value));
  $("#newProject").addEventListener("click", createProject);
  $("#renameProject").addEventListener("click", renameProject);
  $("#deleteProject").addEventListener("click", deleteProject);
  $("#confirmProject").addEventListener("click", confirmProjectAction);
  $("#cancelProject").addEventListener("click", closeProjectModal);
  $("#projectModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeProjectModal(); });
  $("#projectNameInput").addEventListener("keydown", event => { if (event.key === "Enter") confirmProjectAction(); });
  $("#acceptConfirm").addEventListener("click", acceptConfirm);
  $("#cancelConfirm").addEventListener("click", closeConfirm);
  $("#confirmModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeConfirm(); });

  updateLocationStatus();
  renderDraftImages();
  renderProjectSelect();
  initializeStorage();
})();
