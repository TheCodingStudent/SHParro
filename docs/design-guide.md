# Guía de diseño visual e interacción de SHParro

## Propósito

Esta guía define el lenguaje visual y de interacción para transformar SHParro en una plataforma geoespacial directa, calmada y física. La referencia es la filosofía de las interfaces fluidas de Apple, adaptada a web Vanilla: claridad, respuesta inmediata, continuidad espacial, materiales ligeros y animaciones interrumpibles.

La guía aplica a la shell principal descrita en [`index.html`](../index.html), su lógica de navegación en [`js/shparro.js`](../js/shparro.js) y las herramientas integradas dentro de [`Web/`](../Web/).

## 1. Principios de producto

Cada interacción debe servir al menos una de estas necesidades:

- **Seguridad:** el usuario siempre sabe qué está activo, qué puede deshacer y dónde volver.
- **Comprensión:** la interfaz explica relaciones entre herramientas, datos y resultados.
- **Logro:** el usuario llega al resultado con pocos pasos y conserva su contexto.
- **Disfrute:** el sistema responde con precisión, suavidad y pequeños detalles útiles.

Reglas base:

1. Responder en `pointerdown`, no sólo en `click`.
2. Mantener la manipulación 1:1 cuando exista arrastre.
3. Iniciar cada animación desde el valor visual actual.
4. Entregar la velocidad del gesto al resorte al soltar.
5. Usar transformación y opacidad para movimiento.
6. Mantener las rutas de entrada y salida espacialmente coherentes.
7. Ofrecer una alternativa equivalente con movimiento reducido.

## 2. Arquitectura de la experiencia

### Inicio

El inicio es un espacio de trabajo, no un dashboard recargado. Debe mostrar:

- Nombre y propósito de SHParro.
- Búsqueda como acción primaria.
- Herramientas agrupadas por intención: coordenadas, cartografía, relieve y utilidades.
- Favoritos como acceso rápido.
- Estado de conectividad sin convertirlo en una alerta dominante.

### Herramienta activa

Al abrir una herramienta, la shell debe conservar el contexto de origen:

- La herramienta aparece visualmente desde la tarjeta seleccionada.
- Existe un botón volver siempre visible.
- Se conserva el estado de la herramienta al regresar, cuando sea posible.
- El nombre y la categoría quedan disponibles en una barra contextual.
- El iframe o aplicación interna no debe bloquear la transición de la shell.

### Menú móvil

El menú móvil es una hoja lateral anclada a su botón de origen. Debe poder abrirse, cerrarse y revertirse mediante arrastre. El scrim acompaña el desplazamiento de la hoja.

## 3. Lenguaje visual

### Tono

SHParro debe sentirse técnico pero no industrial: oscuro, preciso, silencioso y con acentos de color reservados para acciones y estados.

### Paleta inicial

| Token | Uso | Valor de referencia |
|---|---|---|
| `--canvas` | Fondo general | `#090909` |
| `--surface` | Panel y tarjeta | `#151518` |
| `--surface-raised` | Elemento elevado | `#1d1d22` |
| `--ink` | Texto principal | `#f7f7f4` |
| `--muted` | Texto secundario | `rgba(247,247,244,.68)` |
| `--quiet` | Metadatos | `rgba(247,247,244,.48)` |
| `--accent` | Acción primaria | `#ff5d78` |
| `--success` | Operación completa | `#9bcf63` |
| `--info` | Información técnica | `#77d9df` |
| `--warning` | Conectividad o advertencia | `#d8c66d` |

El acento rosa identifica acción y foco, no decoración general. No usarlo en todos los textos ni en grandes superficies.

### Tipografía

- Interfaz: `Segoe UI Variable`, `Segoe UI`, sans-serif.
- Datos técnicos y coordenadas: `Consolas`, monospace.
- Títulos: peso medio, tamaño contenido y poco tracking.
- Texto auxiliar: corto, con alto contraste y `line-height` generoso.

No usar mayúsculas completas para párrafos. Reservarlas para etiquetas pequeñas como categorías o pasos.

## 4. Materiales y profundidad

### Superficies

- **Canvas:** superficie sólida oscura.
- **Tarjetas:** superficie elevada, borde de baja opacidad y sombra corta.
- **Toolbar contextual:** material translúcido oscuro con blur medio.
- **Drawer:** material translúcido oscuro, sombra profunda y scrim.
- **Contenido de herramienta:** superficie sólida; no aplicar glassmorphism al iframe.

Ejemplo de toolbar:

```css
background: rgba(14, 14, 16, .72);
backdrop-filter: blur(18px) saturate(130%);
-webkit-backdrop-filter: blur(18px) saturate(130%);
```

No apilar dos superficies claras translúcidas. El blur debe separar niveles, no sustituir el contraste.

### Scrim

Usar scrim sólo cuando el usuario deba concentrarse en una superficie superior:

```css
background: rgba(0, 0, 0, .48);
```

El scrim debe perder opacidad mientras el drawer se aleja y recuperar opacidad mientras vuelve.

## 5. Componentes

### Tarjeta de herramienta

Estados mínimos:

- `default`: borde sutil, fondo elevado.
- `hover`: elevación ligera y borde acentuado.
- `pressed`: `scale(.985)`, fondo más profundo y respuesta inmediata.
- `focused`: anillo visible de teclado.
- `disabled/error`: menor contraste, pero texto todavía legible.

La tarjeta debe ser accionable como una unidad. El botón de favorito debe ser un control independiente y no abrir la herramienta.

### Botones

- Acción primaria: fondo de acento y texto claro.
- Acción secundaria: superficie elevada y borde tenue.
- Icono: sólo cuando el significado sea obvio o tenga `aria-label`.
- Área táctil mínima: `44px`.
- Feedback de pulsación en el mismo frame del contacto.

### Búsqueda

La búsqueda debe estar siempre disponible en escritorio y ser el primer foco con `Ctrl/Cmd + K`. En móvil puede ocupar una fila completa. El filtrado debe ser instantáneo y no producir saltos bruscos de layout.

### Toast

Usar toasts para confirmaciones breves, no para errores que requieran decisión. Deben entrar con una transición corta, tener `aria-live` y desaparecer sin desplazar el contenido principal.

## 6. Movimiento e interacción

### Apertura de herramienta

1. `pointerdown`: activar estado `pressed`.
2. Mantener una tolerancia de `10px` para distinguir tap de arrastre.
3. `pointerup` sin desplazamiento significativo: abrir.
4. Animar `transform` y `opacity` desde la posición actual.
5. Mostrar el contenido cuando la shell ya esté estable.
6. En el cierre, recorrer el mismo camino en sentido inverso.

### Arrastre de hoja

- Usar `Pointer Events` y `setPointerCapture`.
- Respetar el offset exacto donde el usuario tomó la hoja.
- Permitir invertir el gesto en cualquier instante.
- Menos de `80px` proyectados: regresar.
- Más de `80px` o con velocidad suficiente: cerrar.
- Aplicar rubber-band en los límites.

### Parámetros de referencia

| Movimiento | Damping | Response | Bounce |
|---|---:|---:|---:|
| Entrada/salida de vista | `1.0` | `0.4s` | `0` |
| Drawer/hoja | `0.8` | `0.3s` | Sólo con momentum claro |
| Rotación | `0.8` | `0.4s` | Moderado |

En Vanilla, implementar el resorte con `requestAnimationFrame` y el estado `{ position, velocity, target }`. No reiniciar desde el valor lógico inicial mientras exista una animación activa.

No usar `@keyframes` ni transiciones fijas para gestos arrastrables.

### Reduced motion

Con `prefers-reduced-motion: reduce`:

- Eliminar desplazamiento, escala y rebote.
- Usar cambio instantáneo o crossfade de `120–160ms`.
- Mantener estados de foco, color y progreso.
- Conservar la posibilidad funcional de cerrar y revertir.

## 7. Layout responsive

### Escritorio

- Barra superior ligera y persistente.
- Grilla de tarjetas con columnas fluidas.
- Herramienta activa a pantalla completa dentro de la shell.
- Metadatos secundarios con contraste bajo.

### Tablet

- Reducir padding horizontal.
- Mantener búsqueda y navegación en una sola fila cuando quepan.
- Convertir grupos muy densos en secciones plegables.

### Móvil

- Una columna.
- Menú como drawer.
- Herramienta como hoja completa.
- Toolbar contextual con altura mínima de `52px`.
- Acciones importantes en el alcance del pulgar.
- No depender de hover para comunicar estados.

## 8. Accesibilidad y seguridad de uso

- Todos los controles deben tener nombre accesible.
- El foco debe permanecer visible y seguir al contenido activo.
- `Escape` cierra menú, drawer o modal en ese orden.
- El botón volver debe existir aunque el gesto esté disponible.
- No comunicar estados sólo por color.
- Anunciar resultados y errores mediante `aria-live`.
- Evitar que un arrastre accidental active una herramienta.
- Mantener contraste suficiente en tarjetas y textos técnicos.

## 9. Convenciones de implementación

- Preferir `transform: translate3d()` y `opacity`.
- Usar `will-change` sólo durante movimiento activo.
- Mantener el iframe montado durante una salida para evitar recargas innecesarias.
- Centralizar estados de navegación en una pequeña máquina de estados.
- Eliminar referencias obsoletas de [`js/shparro.js`](../js/shparro.js) antes de añadir nuevas animaciones.
- Sustituir `display: none` como mecanismo único de transición.
- Mantener URLs profundas `#tool=<id>` y sincronizarlas con `popstate`.

## 10. Criterios de aceptación visual

Una interacción está lista cuando:

- Responde visualmente en `pointerdown`.
- Puede interrumpirse y revertirse sin salto.
- Continúa con la velocidad del gesto.
- Usa sólo transformaciones y opacidad para el movimiento principal.
- Mantiene el origen y el destino espacialmente relacionados.
- Funciona con teclado y lector de pantalla.
- Tiene una variante de movimiento reducido.
- No bloquea la shell mientras carga una herramienta externa.

La interfaz debe sentirse física, pero nunca teatral: la animación debe explicar la relación entre estados y desaparecer cuando ya no aporta información.
