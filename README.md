# SHParro

SHParro es un portal personal estático para reunir herramientas HTML y JavaScript en una interfaz común inspirada en VS Code y el tema Sublime Monokai.

## Ejecución local

Desde la raíz del proyecto:

```powershell
python -m http.server 8080
```

Después abre <http://localhost:8080/>.

## Publicación en GitHub Pages

El repositorio está preparado para publicar desde la raíz de la rama `main`:

```text
https://thecodingstudent.github.io/SHParro/
```

En GitHub:

1. Abre **Settings**.
2. Entra en **Pages**.
3. Selecciona **Deploy from a branch**.
4. Elige `main` y carpeta `/ (root)`.
5. Guarda los cambios.

## Estructura

```text
SHParro/
├── index.html
├── tools.json
├── css/
│   └── shparro.css
├── js/
│   └── shparro.js
├── docs/
│   └── integration.html
└── Web/
    └── TRAN-ALL/
```

## Herramienta inicial

El prototipo incluye **Transformador geodésico INEGI (TRAN-ALL)**. Se carga dentro de un iframe, conserva su URL independiente y puede abrirse en otra pestaña desde la barra superior.

## Registro de herramientas

Todas las herramientas visibles se configuran en `tools.json`. La guía completa está disponible en [docs/integration.html](docs/integration.html).

## Funciones incluidas

- Barra lateral estilo VS Code.
- Búsqueda con `Ctrl+K`.
- Agrupación por categoría.
- Estados de conexión online/offline.
- Apertura integrada mediante iframe.
- Apertura independiente.
- Enlaces profundos con `#tool=<id>`.
- Mensajes de éxito, información y error.
- Diseño responsive para escritorio y móvil.
