# Guía de diseño visual e interacción de SHParro

Esta guía define la filosofía visual y de interacción vigente de SHParro. Es la referencia para la shell principal y para las herramientas integradas dentro de [Web/](../Web/).

## 1. Filosofía de producto

SHParro debe sentirse como una herramienta geoespacial técnica, clara y tranquila: precisa sin parecer industrial, visualmente ligera y directa en cada tarea.

Cada interacción debe favorecer al menos una de estas cualidades:

- **Comprensión:** el usuario sabe qué está viendo, qué está activo y qué ocurrirá después.
- **Continuidad:** la navegación conserva el contexto y evita recargas o saltos innecesarios.
- **Eficiencia:** las acciones frecuentes están cerca, tienen nombres claros y requieren pocos pasos.
- **Confianza:** los estados, errores, resultados y límites se comunican sin depender sólo del color.
- **Calma:** el movimiento, el blur y la profundidad ayudan a entender la interfaz; no son decoración.

## 2. Arquitectura de la experiencia

La shell principal en [index.html](../index.html) proporciona:

- Inicio y búsqueda de herramientas.
- Menús Archivo y Herramientas.
- Estado de conexión.
- Carga integrada mediante iframe.
- Rutas profundas con `#tool=<id>`.
- Regreso a la herramienta anterior sin perder contexto cuando sea posible.

Las herramientas se registran en [tools.json](../tools.json) y viven en [Web/](../Web/). Cada herramienta puede tener su propio layout, pero debe respetar esta guía en responsive, legibilidad, foco y tratamiento de acciones.

Los menús de la shell deben cerrarse al seleccionar cualquier zona externa, incluido el contenido del iframe. `Escape` debe cerrar primero la superficie activa.

## 3. Lenguaje visual vigente

### Tono

La interfaz actual es clara, material y contenida. Combina superficies blancas translúcidas, fondos gris muy claro, bordes sutiles, blur y sombras moderadas. El resultado debe sentirse cercano a una herramienta nativa moderna, no a un dashboard saturado.

### Paleta base

| Token | Uso | Valor de referencia |
|---|---|---|
| `--canvas` / `--bg` | Fondo general | `#ebe5dc` |
| `--surface` / `--panel` | Tarjetas y superficies | `rgba(255,255,255,.82–.84)` |
| `--surface-raised` / `--raised` | Controles elevados | `#f5f1eb` |
| `--ink` / `--text` | Texto principal | `#2d2d2d` |
| `--muted` | Texto secundario | `#6f6f6f` |
| `--line` | Bordes y separadores | `rgba(45,45,45,.16)` |
| `--accent` | Acción y foco | `#414b99` |
| `--info` / `--cyan` | Información técnica | `#9a9a9a` |
| `--warning` | Alerta o estado crítico | `#ff4b48` |

El azul identifica acciones, selección y foco. No debe convertirse en una superficie dominante. Los mensajes de advertencia o error deben incluir texto y no depender sólo del color.

### Tipografía

- Interfaz: `Segoe UI Variable`, `Segoe UI`, sans-serif.
- Coordenadas, códigos y valores técnicos: `Consolas`, monospace.
- Títulos: peso medio, tamaño contenido y poco tracking.
- Texto auxiliar: breve, con contraste suficiente y `line-height` cómodo.
- Mayúsculas completas: sólo para etiquetas pequeñas, categorías o metadatos.

## 4. Materiales y profundidad

- **Canvas:** fondo claro sólido o con un gradiente radial muy sutil.
- **Tarjetas:** fondo blanco translúcido, borde tenue, radio generoso y sombra corta.
- **Toolbar y menús:** superficie translúcida con blur para separar el contenido posterior.
- **Dynamic island:** superficie compacta, clara y táctil para controles móviles persistentes.
- **Contenido de herramienta:** puede usar su propio sistema de tarjetas, pero debe conservar contraste y jerarquía.

Usar `backdrop-filter` sólo cuando ayude a separar capas. El blur no sustituye el contraste. No apilar varias superficies translúcidas sin una diferencia clara de profundidad.

Las sombras deben ser moderadas. El recuadro de datum del conversor UTM es una excepción intencional: no tiene sombra para mantener una apariencia más ligera.

## 5. Componentes

### Tarjetas

Estados mínimos:

- `default`: superficie clara, borde sutil y sombra discreta.
- `hover`: cambio ligero de borde o fondo; no depender de hover en móvil.
- `pressed`: respuesta breve mediante escala o cambio de fondo.
- `focused`: anillo visible de teclado.
- `disabled/error`: menor contraste, pero texto todavía legible.

### Botones y controles

- Acción primaria: azul sólido y texto blanco.
- Acción secundaria: superficie elevada y borde tenue.
- Iconos: sólo cuando el significado sea evidente o exista `aria-label`.
- En móvil: aproximadamente `36–40px` de alto, según el contexto; deben seguir siendo cómodos para tocar sin ocupar espacio excesivo.
- Texto de controles móviles: normalmente `10–12px`.
- Inputs y selects móviles: aproximadamente `36px` de alto, con padding reducido y foco visible.
- No usar `maxlength` sólo para resolver problemas visuales; reducir el ancho visual sin impedir valores válidos.

### Búsqueda

La búsqueda de herramientas debe estar disponible en escritorio y responder a `Ctrl/Cmd + K`. En móvil puede ocultarse cuando la herramienta está activa para ceder espacio al contenido.

En ArMAPS, la búsqueda de capas vive en el dynamic island móvil. Las sugerencias sólo son visibles mientras existe una búsqueda activa, muestran como máximo tres opciones y permiten activar/desactivar o descartar una capa.

### Menús

Los menús Archivo y Herramientas deben tener blur suficiente para distinguirse del fondo. Se cierran al hacer clic o tocar fuera de ellos, incluido el iframe, y también con `Escape`.

## 6. Patrones específicos de herramientas

### ArMAPS

- La sidebar de capas está colapsada por defecto en escritorio.
- En móvil la sidebar y su botón lateral desaparecen por completo.
- El dynamic island concentra búsqueda de lugares, zoom, basemap y ubicación.
- La vista inicial móvil queda centrada en México; escritorio conserva su encuadre independiente.
- El selector de basemap se cierra al seleccionar cualquier zona externa.
- Las capas deben tener palabras clave útiles para fuente, tipo de servicio y temática, por ejemplo INEGI, WMS, vialidad o carretera.

### Conversor UTM

- En escritorio se conservan las secciones de coordenadas individuales y hoja de coordenadas como tarjetas independientes.
- En móvil ambas viven en una tarjeta con pestañas: “Coordenadas individuales” y “Hoja de coordenadas”.
- El orden móvil es: título y subtítulo, datum de origen, tipo de conversión y contenido del conversor.
- El datum de origen usa el lenguaje material de ArMAPS, pero sin sombra.
- Las pestañas y botones deben conservar una escala compacta y táctil.

### Transformación INEGI

- La sección de puntos originales se titula “Datos de entrada”.
- La tabla móvil conserva formato tabular y usa desplazamiento horizontal interno, nunca overflow de la página.
- Las columnas `ID`, `Este`, `Norte` y `Z` se alinean con entradas de máximo `12ch` visuales.
- Los valores largos siguen siendo editables; el ancho visual no implica límite de caracteres.

### CEM

- Sus pestañas, formularios, tarjetas y acciones usan la misma escala móvil compacta.
- Los resultados deben mantener una jerarquía clara entre consulta, estado, elevación y descargas.

## 7. Responsive

### Escritorio

- Barra superior ligera y persistente.
- Grillas fluidas y tarjetas con espacio suficiente.
- La herramienta activa ocupa el área disponible dentro de la shell.
- El contenido secundario conserva contraste bajo, pero legible.

### Móvil

- Una columna y prioridad visual clara.
- Acciones principales al alcance del pulgar.
- No depender de hover.
- Reducir padding, tipografía y altura de controles sin volverlos difíciles de tocar.
- Evitar overflow horizontal del documento.
- Las tablas pueden desplazarse horizontalmente dentro de su propio recuadro.
- Ocultar o colapsar elementos secundarios cuando compitan con la tarea principal.
- Validar especialmente en aproximadamente `390px` de ancho.

El breakpoint común es `max-width: 760px`; algunas tablas usan ajustes adicionales alrededor de `520px`.

## 8. Movimiento y accesibilidad

- La respuesta visual debe comenzar lo antes posible; la shell prioriza `pointerdown` para cerrar superficies y responder a gestos.
- Las herramientas pueden usar `click` para acciones simples, siempre que la respuesta sea inmediata y accesible.
- Usar `transform` y `opacity` para movimiento principal.
- No crear transiciones que impidan cerrar o revertir una interacción.
- Mantener `prefers-reduced-motion`: reducir escalas, desplazamientos y rebotes; conservar estados, foco y funcionalidad.
- Todos los controles deben tener nombre accesible.
- El foco debe permanecer visible y seguir el contenido activo.
- Usar `aria-live` para resultados, estados y errores relevantes.
- No activar una herramienta por un arrastre accidental.

## 9. Convenciones de implementación

- Mantener las rutas `#tool=<id>` y sincronizarlas con navegación del navegador.
- Mantener los iframes montados cuando sea posible para evitar recargas innecesarias.
- Preferir `transform: translate3d()` y `opacity` durante movimiento.
- Usar `will-change` sólo durante movimiento activo.
- Centralizar estados de navegación en la shell.
- Mantener los estilos responsive dentro de los archivos de cada herramienta.
- Usar `apply_patch` para editar archivos.
- Antes de cambios ambiguos, confirmar el alcance y la decisión de diseño.

## 10. Criterios de aceptación

Una interacción está lista cuando:

- La jerarquía visual es clara en móvil y escritorio.
- Los botones y textos tienen escala adecuada para el viewport.
- No hay overflow horizontal accidental.
- La acción responde de forma perceptible y puede revertirse.
- El foco de teclado es visible.
- Los estados importantes tienen texto o semántica accesible.
- `prefers-reduced-motion` sigue siendo funcional.
- El layout de escritorio no cambia cuando el requerimiento es móvil.
- La interfaz se siente precisa y física, pero nunca teatral.
