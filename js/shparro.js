(() => {
  "use strict";

  const FALLBACK_TOOLS = [
    {
      id: "tran-all",
      name: "Transformador geodésico INEGI",
      shortName: "TRAN-ALL",
      description: "Transforma coordenadas entre NAD27, ITRF92 y ITRF2008 mediante los servicios de INEGI.",
      category: "Geodesia y coordenadas",
      path: "./Web/TRAN-ALL/index.html",
      status: "available",
      offline: false,
      icon: "◎"
    }
  ];

  const FAVORITES_KEY = "shparro:favorites";
  const toolsMenuItems = document.querySelector("#toolsMenuItems");
  const toolSearch = document.querySelector("#toolSearch");
  const toolFrame = document.querySelector("#toolFrame");
  const homeView = document.querySelector("#homeView");
  const toolView = document.querySelector("#toolView");
  let tools = [];
  let activeView = "home";

  const favorites = () => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); }
    catch (_) { return []; }
  };

  const setFavorites = ids => localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));

  function resolveToolPath(path) {
    return new URL(path.replace("./", ""), document.baseURI).href;
  }

  function toolById(id) {
    return tools.find(tool => tool.id === id);
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.querySelector("#toastRegion").append(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  function renderToolsMenu() {
    const query = toolSearch.value.trim().toLocaleLowerCase("es");
    let visibleTools = tools.filter(tool => {
      const matchesQuery = !query || `${tool.name} ${tool.shortName || ""} ${tool.description} ${tool.category}`.toLocaleLowerCase("es").includes(query);
      const matchesView = activeView !== "favorites" || favorites().includes(tool.id);
      return matchesQuery && matchesView;
    });

    if (!visibleTools.length) {
      toolsMenuItems.innerHTML = '<div class="menu-empty">No se encontraron herramientas.</div>';
      return;
    }

    toolsMenuItems.innerHTML = visibleTools.map(tool => `
      <div class="tool-menu-group">
        <div class="tool-menu-row">
          <button class="tool-menu-item" data-tool-id="${escapeHtml(tool.id)}" type="button" role="menuitem">
          <span class="tool-menu-icon">${escapeHtml(tool.icon || tool.shortName?.slice(0, 1) || "T")}</span>
          <span><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.category)}</small></span>
          </button>
          <button class="menu-favorite ${favorites().includes(tool.id) ? "active" : ""}" data-tool-id="${escapeHtml(tool.id)}" type="button" aria-label="${favorites().includes(tool.id) ? "Quitar de favoritos" : "Agregar a favoritos"}">${favorites().includes(tool.id) ? "★" : "☆"}</button>
        </div>
      </div>
    `).join("");

    toolsMenuItems.querySelectorAll(".tool-menu-item").forEach(button => {
      button.addEventListener("click", event => {
        if (!event.target.closest(".menu-favorite")) openTool(button.dataset.toolId);
      });
    });
    toolsMenuItems.querySelectorAll(".menu-favorite").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        toggleFavorite(button.dataset.toolId);
      });
    });
  }

  function toggleFavorite(id) {
    const current = favorites();
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    setFavorites(next);
    renderToolsMenu();
    if (toolView.classList.contains("hidden") === false) updateActiveFavorite(id);
    showToast(next.includes(id) ? "Herramienta agregada a favoritos." : "Herramienta quitada de favoritos.", "success");
  }

  function openTool(id, updateHistory = true) {
    const tool = toolById(id);
    if (!tool) {
      showToast("La herramienta solicitada no está registrada.", "error");
      return;
    }

    homeView.classList.add("hidden");
    toolView.classList.remove("hidden");
    const activeToolName = document.querySelector("#activeToolName");
    const activeToolCategory = document.querySelector("#activeToolCategory");
    if (activeToolName) activeToolName.textContent = tool.name;
    if (activeToolCategory) activeToolCategory.textContent = tool.category;
    const resolved = resolveToolPath(tool.path);
    toolFrame.classList.remove("loaded");
    toolFrame.src = resolved;
    const openToolDirect = document.querySelector("#openToolDirect");
    if (openToolDirect) openToolDirect.href = resolved;
    updateActiveFavorite(id);
    if (updateHistory) history.replaceState(null, "", `#tool=${encodeURIComponent(id)}`);
  }

  toolFrame.addEventListener("load", () => toolFrame.classList.add("loaded"));

  function updateActiveFavorite(id) {
    const button = document.querySelector("#favoriteActive");
    if (!button) return;
    const favorite = favorites().includes(id);
    button.textContent = favorite ? "★" : "☆";
    button.classList.toggle("active", favorite);
    button.onclick = () => toggleFavorite(id);
  }

  function closeTool() {
    toolFrame.src = "about:blank";
    toolView.classList.add("hidden");
    homeView.classList.remove("hidden");
    history.replaceState(null, "", document.location.pathname);
  }

  async function loadTools() {
    try {
      const response = await fetch("./tools.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      tools = await response.json();
    } catch (error) {
      tools = FALLBACK_TOOLS;
      showToast("No se pudo cargar tools.json; se usó el registro local de respaldo.", "error");
      console.warn(error);
    }
    renderToolsMenu();

    const match = location.hash.match(/^#tool=([^&]+)/);
    if (match) openTool(decodeURIComponent(match[1]), false);
  }

  function updateConnection() {
    const online = navigator.onLine;
    const connectionPill = document.querySelector("#connectionPill");
    connectionPill?.classList.toggle("offline", !online);
    if (connectionPill) connectionPill.innerHTML = `<span></span> ${online ? "Online" : "Offline"}`;
  }

  toolSearch.addEventListener("input", () => {
    renderToolsMenu();
    document.querySelector('[data-menu="tools"]')?.classList.add("open");
  });
  document.querySelector("#closeTool")?.addEventListener("click", closeTool);
  document.querySelector("#reloadTools").addEventListener("click", () => {
    loadTools();
    showToast("Registro de herramientas actualizado.");
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
      activeView = button.dataset.view;
      closeTool();
      renderToolsMenu();
    });
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toolSearch.focus();
    }
    if (event.key === "Escape") closeMenus();
  });
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);

  function closeMenus() {
    document.querySelectorAll(".menu.open").forEach(menu => {
      menu.classList.remove("open");
      menu.querySelector(".menu-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  document.querySelectorAll(".menu-trigger").forEach(trigger => {
    trigger.addEventListener("click", event => {
      const menu = event.currentTarget.closest(".menu");
      const willOpen = !menu.classList.contains("open");
      closeMenus();
      if (willOpen) {
        menu.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".menu")) closeMenus();
  });

  updateConnection();
  loadTools();
})();
