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
  const toolsGroups = document.querySelector("#toolGroups");
  const toolSearch = document.querySelector("#toolSearch");
  const toolFrame = document.querySelector("#toolFrame");
  const homeView = document.querySelector("#homeView");
  const toolView = document.querySelector("#toolView");
  let tools = [];
  let activeCategory = "all";
  let activeView = "home";

  const favorites = () => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); }
    catch (_) { return []; }
  };

  const setFavorites = ids => localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  const statusLabel = { available: "Disponible", requires: "Requiere conexión", development: "En desarrollo", error: "Fuera de servicio" };

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

  function renderCategoryNav() {
    const categories = [...new Set(tools.map(tool => tool.category))];
    const categoryNav = document.querySelector("#categoryNav");
    if (!categoryNav) return;
    categoryNav.innerHTML = [
      '<button class="category-button active" data-category="all">Todas las herramientas</button>',
      ...categories.map(category => `<button class="category-button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    ].join("");

    document.querySelectorAll(".category-button").forEach(button => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.category;
        document.querySelectorAll(".category-button").forEach(item => item.classList.toggle("active", item === button));
        renderTools();
        closeMobileMenu();
      });
    });
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  function renderTools() {
    const query = toolSearch.value.trim().toLocaleLowerCase("es");
    let visibleTools = tools.filter(tool => {
      const matchesCategory = activeCategory === "all" || tool.category === activeCategory;
      const matchesQuery = !query || `${tool.name} ${tool.shortName || ""} ${tool.description} ${tool.category}`.toLocaleLowerCase("es").includes(query);
      const matchesView = activeView !== "favorites" || favorites().includes(tool.id);
      return matchesCategory && matchesQuery && matchesView;
    });

    const grouped = visibleTools.reduce((groups, tool) => {
      (groups[tool.category] ||= []).push(tool);
      return groups;
    }, {});

    if (!visibleTools.length) {
      toolsGroups.innerHTML = '<div class="empty-state">No se encontraron herramientas.</div>';
      document.querySelector("#toolsSummary").textContent = "0 herramientas mostradas.";
      return;
    }

    toolsGroups.innerHTML = Object.entries(grouped).map(([category, categoryTools]) => `
      <section class="tool-section">
        <div class="tool-section-header">
          <h2>${escapeHtml(category)}</h2>
          <span class="tool-count">${categoryTools.length}</span>
        </div>
        <div class="tool-grid">
          ${categoryTools.map(toolCard).join("")}
        </div>
      </section>
    `).join("");

    document.querySelector("#toolsSummary").textContent =
      `${visibleTools.length} herramienta${visibleTools.length === 1 ? "" : "s"} mostrada${visibleTools.length === 1 ? "" : "s"}.`;

    document.querySelectorAll(".tool-card").forEach(card => {
      card.addEventListener("click", event => {
        if (!event.target.closest(".favorite-button")) openTool(card.dataset.toolId);
      });
    });

    document.querySelectorAll(".favorite-button").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        toggleFavorite(button.dataset.toolId);
      });
    });
  }

  function toolCard(tool) {
    const favorite = favorites().includes(tool.id);
    const statusClass = tool.status === "available" ? "" : tool.status === "requires" ? " requires" : tool.status === "development" ? " development" : " error";
    return `
      <article class="tool-card" data-tool-id="${escapeHtml(tool.id)}">
        <div class="tool-card-top">
          <div class="tool-icon">${escapeHtml(tool.icon || tool.shortName?.slice(0, 1) || "T")}</div>
          <button class="favorite-button ${favorite ? "active" : ""}" data-tool-id="${escapeHtml(tool.id)}" type="button" aria-label="${favorite ? "Quitar de favoritos" : "Agregar a favoritos"}">${favorite ? "★" : "☆"}</button>
        </div>
        <h3>${escapeHtml(tool.name)}</h3>
        <p>${escapeHtml(tool.description)}</p>
        <div class="tool-meta${statusClass}"><span></span>${escapeHtml(statusLabel[tool.status] || tool.status)}</div>
      </article>
    `;
  }

  function toggleFavorite(id) {
    const current = favorites();
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    setFavorites(next);
    renderTools();
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
    renderCategoryNav();
    renderTools();

    const match = location.hash.match(/^#tool=([^&]+)/);
    if (match) openTool(decodeURIComponent(match[1]), false);
  }

  function updateConnection() {
    const online = navigator.onLine;
    const connectionPill = document.querySelector("#connectionPill");
    connectionPill?.classList.toggle("offline", !online);
    if (connectionPill) connectionPill.innerHTML = `<span></span> ${online ? "Online" : "Offline"}`;
  }

  function openMobileMenu() {
    document.querySelector("#sidebar")?.classList.add("open");
    document.querySelector("#sidebarBackdrop")?.classList.add("open");
  }

  function closeMobileMenu() {
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#sidebarBackdrop")?.classList.remove("open");
  }

  toolSearch.addEventListener("input", renderTools);
  document.querySelector("#closeTool")?.addEventListener("click", closeTool);
  document.querySelector("#mobileMenu")?.addEventListener("click", openMobileMenu);
  document.querySelector("#sidebarBackdrop")?.addEventListener("click", closeMobileMenu);
  document.querySelector("#reloadTools").addEventListener("click", () => {
    loadTools();
    showToast("Registro de herramientas actualizado.");
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
      activeView = button.dataset.view;
      closeTool();
      renderTools();
      closeMobileMenu();
    });
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toolSearch.focus();
    }
    if (event.key === "Escape") closeMobileMenu();
  });
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);

  updateConnection();
  loadTools();
})();
