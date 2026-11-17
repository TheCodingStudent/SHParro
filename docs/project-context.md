# Contexto técnico de SHParro

Referencia breve para continuar el desarrollo sin reconstruir el estado del proyecto.

## Proyecto

- Aplicación web estática en HTML, CSS y JavaScript vanilla.
- La shell principal está en [index.html](../index.html), con navegación, menús Archivo/Herramientas y carga de herramientas mediante iframe.
- El registro de herramientas está en [tools.json](../tools.json).
- Las herramientas independientes viven dentro de [Web/](../Web/).

## Herramientas actuales

| ID | Herramienta | Archivos principales |
|---|---|---|
| `armaps` | ArMAPS | `Web/ArMAPS/index.html`, `app.js`, `styles.css` |
| `utm-converter` | Conversor UTM | `Web/Utilities/index.html`, `app.js`, `styles.css` |
| `tran-all` | Transformación de coordenadas INEGI | `Web/TRAN-ALL/index.html`, `app.js`, `styles.css` |
| `cem-elevation` | Consulta de elevaciones CEM | `Web/CEM/index.html`, `styles.css` |

## Decisiones de interfaz móvil

- El breakpoint principal móvil es `max-width: 760px`; algunas tablas usan `max-width: 520px`.
- La vista de escritorio debe conservar su layout y dimensiones actuales.
- Los controles móviles deben ser táctiles, compactos y visualmente uniformes: botones aproximadamente de 36–40 px de alto y texto de 10–12 px según el contexto.
- No debe haber desbordamiento horizontal de la página; las tablas pueden tener desplazamiento horizontal interno.

### ArMAPS

- En móvil la sidebar desaparece completamente.
- La búsqueda de capas aparece en el dynamic island y las sugerencias se muestran solo durante una búsqueda.
- Las sugerencias tienen máximo tres opciones visibles, son desplazables y permiten activar/desactivar o descartar una capa.
- Los menús Archivo/Herramientas se cierran al hacer clic fuera, incluido el iframe.
- El mapa inicia centrado en México en móvil usando `MOBILE_MEXICO_CENTER`; escritorio conserva su centro original.
- La sidebar de capas está colapsada por defecto.

### Conversor UTM

- En móvil, las secciones de coordenadas individuales y hoja de coordenadas están dentro de una tarjeta con pestañas.
- El datum de origen aparece como tarjeta independiente antes del conversor.
- El recuadro de datum no tiene sombra.
- El título y subtítulo aparecen antes del datum en móvil.

### Transformación INEGI

- La sección antes llamada “Puntos originales” ahora se titula “Datos de entrada”.
- En móvil la tabla editable usa columnas fijas alineadas con entradas de máximo `12ch`.
- Las entradas no tienen `maxlength`; valores largos siguen siendo editables.
- El índice y la columna de eliminación son más estrechos.

## Estilo y mantenimiento

- La guía visual está en [docs/design-guide.md](design-guide.md).
- Usar `apply_patch` para editar archivos.
- Validar cambios responsivos en aproximadamente 390 px y escritorio en aproximadamente 1280 px.
- Ejecutar `git diff --check` después de editar.
- Antes de modificar código, preguntar al usuario lo necesario para confirmar alcance o decisiones ambiguas.
- No modificar el layout de escritorio cuando el requerimiento sea móvil.

## Validación rápida

- Abrir `index.html` y seleccionar cada herramienta mediante `#tool=<id>`.
- Las herramientas se prueban dentro del iframe de la shell y también pueden abrirse directamente desde sus rutas en `Web/`.
- Revisar especialmente overflow horizontal, alturas de botones, legibilidad y orden visual en móvil.
