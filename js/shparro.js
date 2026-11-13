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

  const toolsMenuItems = document.querySelector("#toolsMenuItems");
  const toolSearch = document.querySelector("#toolSearch");
  const toolFrame = document.querySelector("#toolFrame");
  const homeView = document.querySelector("#homeView");
  const toolView = document.querySelector("#toolView");
  let tools = [];

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
    const visibleTools = tools.filter(tool => {
      const matchesQuery = !query || `${tool.name} ${tool.shortName || ""} ${tool.description} ${tool.category}`.toLocaleLowerCase("es").includes(query);
      return matchesQuery;
    });

    if (!visibleTools.length) {
      toolsMenuItems.innerHTML = '<div class="menu-empty">No se encontraron herramientas.</div>';
      return;
    }

    toolsMenuItems.innerHTML = visibleTools.map(tool => `
        <div class="tool-menu-row">
          <button class="tool-menu-item" data-tool-id="${escapeHtml(tool.id)}" type="button" role="menuitem">
            <span class="tool-menu-icon">${escapeHtml(tool.icon || tool.shortName?.slice(0, 1) || "T")}</span>
            <span><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.category)}</small></span>
          </button>
        </div>
    `).join("");

    toolsMenuItems.querySelectorAll(".tool-menu-item").forEach(button => {
      button.addEventListener("click", () => openTool(button.dataset.toolId));
    });
  }

  function openTool(id, updateHistory = true) {
    const tool = toolById(id);
    if (!tool) {
      showToast("La herramienta solicitada no está registrada.", "error");
      return;
    }

    closeMenus();
    homeView.classList.add("hidden");
    toolView.classList.remove("hidden");
    const resolved = resolveToolPath(tool.path);
    toolFrame.classList.remove("loaded");
    toolFrame.src = resolved;
    if (updateHistory) history.replaceState(null, "", `#tool=${encodeURIComponent(id)}`);
  }

  toolFrame.addEventListener("load", () => toolFrame.classList.add("loaded"));

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
  document.querySelector("#openToolsButton")?.addEventListener("click", event => {
    event.stopPropagation();
    const toolsMenu = document.querySelector('[data-menu="tools"]');
    toolsMenu?.classList.add("open");
    toolsMenu?.querySelector(".menu-trigger")?.setAttribute("aria-expanded", "true");
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
