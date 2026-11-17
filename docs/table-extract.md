# Especificación funcional — Herramienta general para extracción de tablas desde PDF

## 1. Propósito

Construir una aplicación web general para cargar reportes en PDF, visualizar sus páginas, asignar plantillas y extraer información tabular o campos individuales hacia archivos Excel.

La aplicación debe permitir incorporar nuevos formatos sin crear un script Python por página o por tipo de informe. La lógica común debe vivir en el motor de la aplicación y las diferencias entre formatos deben almacenarse como plantillas JSON.

El objetivo principal es transformar un proceso actualmente manual —selección de páginas, creación de bounding boxes, nombrado de atributos y generación de Excel— en un flujo reutilizable y guiado.

## 2. Alcance tecnológico

- Aplicación ejecutada en el navegador.
- Tecnologías principales: HTML, CSS y JavaScript.
- Sin Python.
- Sin Node.js.
- Sin servidor backend para la primera versión.
- Procesamiento local en el navegador siempre que sea posible.
- Los archivos PDF no deben enviarse a un servicio externo.

### Librerías compatibles con este enfoque

- **PDF.js:** visualización de PDF, navegación de páginas y extracción de texto de PDFs digitales.
- **Tesseract.js:** OCR ejecutado en el navegador como mecanismo de respaldo para páginas que no tengan texto extraíble o para futuras versiones con PDFs escaneados.
- **SheetJS:** creación y descarga de archivos `.xlsx` directamente desde el navegador.

PDF.js expone una capa de visualización y una API para trabajar con documentos PDF en el navegador. Tesseract.js puede ejecutarse mediante scripts o módulos en el navegador. SheetJS permite construir libros de Excel y descargar archivos desde una aplicación web. Referencias: [PDF.js](https://mozilla.github.io/pdf.js/getting_started/), [Tesseract.js](https://github.com/naptha/tesseract.js) y [SheetJS](https://docs.sheetjs.com/docs/).

## 3. Conceptos principales

### Documento

Cada archivo PDF cargado por el usuario.

### Página

Una página individual de un documento PDF. Una página puede tener una plantilla asignada o quedar sin procesar.

### Plantilla

Archivo JSON que describe cómo interpretar una página o un conjunto de páginas con el mismo formato.

Una plantilla contiene:

- nombre y descripción;
- criterios opcionales para identificar el formato;
- bounding boxes de campos individuales;
- tablas y sus divisiones;
- nombres de atributos;
- tipos de dato;
- relación entre atributos y celdas de Excel;
- buffer de tolerancia para cada región;
- configuración de las hojas de salida.

### Campo

Una región de la página que representa un valor individual, por ejemplo `obra`, `fecha_entrega`, `cliente` o `ubicacion`.

### Tabla

Una región rectangular que contiene filas y columnas. Cada celda de la tabla se conserva como una región independiente para poder aplicar OCR y generar atributos automáticamente.

## 4. Flujo general de usuario

### 4.1 Cargar una carpeta de PDFs

La aplicación debe permitir seleccionar una carpeta que contenga múltiples archivos PDF.

La aplicación debe:

- listar todos los PDFs encontrados;
- mostrar el nombre del archivo;
- mostrar el número de páginas;
- permitir abrir cada documento;
- conservar los archivos en memoria del navegador o mediante almacenamiento local, sin subirlos a internet.

La carga debe soportar también la selección de un PDF individual para facilitar pruebas y revisiones.

### 4.2 Visualizar y asignar plantillas

La aplicación debe mostrar:

- lista de documentos cargados;
- lista de páginas de cada documento;
- vista previa de la página seleccionada;
- plantilla asignada actualmente;
- estado de procesamiento.

El usuario debe poder asignar una plantilla individualmente a cada página.

Una página puede tener los siguientes estados:

- `sin plantilla`;
- `plantilla asignada`;
- `lista para procesar`;
- `procesada`;
- `requiere revisión`;
- `error`.

Las páginas sin plantilla no deben procesarse.

### 4.3 Crear una plantilla desde un PDF cargado

El usuario debe poder seleccionar una página de cualquiera de los PDFs cargados y utilizarla como ejemplo base para crear una plantilla.

El editor de plantillas debe permitir:

- visualizar la página con zoom;
- desplazarse por la imagen o vista PDF;
- dibujar bounding boxes con el mouse;
- mover y redimensionar bounding boxes existentes;
- eliminar y duplicar bounding boxes;
- añadir un nombre a cada bounding box;
- configurar un buffer de tolerancia alrededor de cada bounding box;
- guardar la plantilla como archivo JSON;
- editar una plantilla existente;
- duplicar una plantilla para crear una variante;
- eliminar una plantilla;
- asignar la plantilla a páginas del documento.

## 5. Campos individuales

Al crear un campo individual, la aplicación debe solicitar al menos:

- nombre del atributo;
- tipo de dato esperado;
- celda o rango de celdas de destino en Excel;
- buffer de tolerancia.

El valor detectado debe inferir su tipo automáticamente:

- números como números;
- porcentajes como números o porcentajes según la configuración;
- fechas como fechas cuando puedan identificarse;
- cualquier otro valor como texto.

La aplicación debe conservar tanto el valor original detectado como el valor normalizado, para permitir auditoría y corrección posterior.

Ejemplo de campo:

```json
{
  "id": "campo_obra",
  "nombre": "obra",
  "tipo": "auto",
  "bbox": {
    "x": 120,
    "y": 240,
    "width": 380,
    "height": 42
  },
  "buffer": {
    "x": 8,
    "y": 5
  },
  "destino_excel": {
    "hoja": "Pagina 1",
    "rango": "B2"
  }
}
```

## 6. Creación visual de tablas

La creación de tablas debe ser una función independiente dentro del editor de plantillas.

### 6.1 Definición del área total

El usuario debe:

1. Seleccionar la herramienta **Crear tabla**.
2. Dibujar un bounding box que represente el área total de la tabla.
3. Indicar el nombre de la tabla, por ejemplo `Tabla01`.
4. Indicar el número de filas.
5. Indicar el número de columnas.

### 6.2 Definición de divisiones

Después de indicar filas y columnas, la aplicación debe mostrar el área de la tabla y permitir:

- indicar con el mouse las divisiones verticales de columnas;
- indicar con el mouse las divisiones horizontales de filas;
- mover cada división antes de confirmar;
- agregar, eliminar o reajustar divisiones;
- validar que las divisiones estén dentro del área total;
- mostrar una previsualización de las celdas resultantes.

El sistema debe calcular y guardar el bounding box de cada celda.

### 6.3 Nombrado automático de atributos

Por defecto, las celdas deben nombrarse automáticamente usando el nombre de la tabla:

```text
Tabla01_Fila01_Columna01
Tabla01_Fila01_Columna02
Tabla01_Fila01_Columna03
Tabla01_Fila02_Columna01
...
```

La primera fila no debe tratarse automáticamente como encabezado. Todas las filas deben conservarse como datos, salvo que en una versión posterior se agregue una opción explícita para definir encabezados.

Cada celda debe guardar:

- nombre del atributo;
- índice de fila;
- índice de columna;
- bounding box absoluto o normalizado;
- buffer;
- tipo de dato automático;
- destino de Excel.

Ejemplo:

```json
{
  "id": "tabla_01",
  "nombre": "Tabla01",
  "bbox": {
    "x": 90,
    "y": 410,
    "width": 980,
    "height": 560
  },
  "filas": 4,
  "columnas": 3,
  "divisiones": {
    "verticales": [320, 640],
    "horizontales": [140, 280, 420]
  },
  "celdas": [
    {
      "nombre": "Tabla01_Fila01_Columna01",
      "fila": 1,
      "columna": 1,
      "bbox": { "x": 90, "y": 410, "width": 230, "height": 140 },
      "tipo": "auto"
    }
  ]
}
```

## 7. Diseño del layout de Excel

Durante la creación de la plantilla debe existir una sección de diseño de salida que permita construir el layout de Excel.

La sección debe mostrar una cuadrícula editable en la que el usuario pueda:

- seleccionar una o varias celdas;
- asignar un campo individual a una celda o rango;
- asignar una tabla a un rango;
- escribir títulos y etiquetas fijas;
- combinar celdas;
- definir el nombre de la hoja;
- ordenar las hojas de salida;
- indicar si una tabla debe ocupar una hoja completa;
- previsualizar el layout antes de guardar la plantilla.

Un atributo puede asignarse a una celda o a varias celdas. Cuando se asigne a varias celdas, el sistema debe definir si:

- combina las celdas;
- repite el valor;
- coloca el valor solamente en la primera celda.

La opción debe quedar explícita en la configuración JSON.

Ejemplo:

```json
{
  "layout_excel": {
    "hojas": [
      {
        "nombre": "Pagina 1",
        "elementos": [
          {
            "tipo": "campo",
            "atributo": "obra",
            "rango": "B2:D2",
            "comportamiento": "combinar"
          },
          {
            "tipo": "tabla",
            "tabla": "Tabla01",
            "rango": "A8:C12"
          }
        ]
      }
    ]
  }
}
```

## 8. Procesamiento de documentos

El procesamiento debe poder ejecutarse de dos maneras:

- sobre toda la carpeta cargada;
- sobre un PDF individual.

Para cada página con plantilla asignada, el sistema debe:

1. abrir la página;
2. obtener el texto digital mediante PDF.js;
3. localizar los campos y celdas configurados;
4. usar el bounding box con buffer;
5. normalizar los valores detectados;
6. clasificar automáticamente texto, números y fechas;
7. construir las hojas de Excel;
8. registrar advertencias y campos con baja confianza.

Como los PDFs iniciales serán digitales, la extracción de texto del PDF debe ser el método principal. Tesseract.js debe quedar preparado como respaldo para páginas que no tengan una capa de texto utilizable o para una futura extensión a PDFs escaneados.

## 9. Confianza, desplazamientos y revisión

Cada resultado debe conservar:

- valor detectado;
- confianza de detección cuando esté disponible;
- página de origen;
- campo o celda de origen;
- bounding box utilizado;
- método de extracción;
- advertencias.

Los bounding boxes deben admitir un buffer configurable para tolerar pequeños desplazamientos del contenido entre reportes.

Los campos con baja confianza deben resaltarse visualmente en la interfaz.

Si una página no puede procesarse correctamente, no debe detener todo el lote. Debe generarse un estado `requiere revisión` con información suficiente para corregirlo posteriormente.

La revisión debe incluir, como mínimo:

- PDF;
- número de página;
- plantilla utilizada;
- campo o tabla problemática;
- valor detectado;
- motivo de la advertencia.

La validación manual completa de todos los resultados no es obligatoria para la primera versión.

## 10. Salida Excel

El resultado final debe ser un archivo Excel por cada PDF procesado.

Reglas:

- el nombre del Excel debe ser el mismo que el del PDF, reemplazando `.pdf` por `.xlsx`;
- si el PDF tiene varias páginas procesadas, el Excel debe tener el mismo número de hojas correspondientes;
- cada página procesada debe generar una hoja propia;
- cada tabla debe ocupar una hoja propia dentro de la salida correspondiente;
- si una página tiene varias tablas, cada tabla debe ir a su propia hoja;
- las hojas deben conservar la información extraída y respetar el layout definido en la plantilla;
- las páginas sin plantilla no deben aparecer en el Excel;
- si una página requiere revisión, su hoja debe generarse con las advertencias correspondientes o quedar marcada según la configuración de procesamiento.

Cuando exista una página con campos individuales y tablas, la plantilla debe poder definir si los campos individuales van a una hoja de resumen y las tablas a hojas independientes.

## 11. Biblioteca de plantillas

La aplicación debe tener una biblioteca de plantillas con las siguientes funciones:

- crear;
- guardar;
- abrir;
- editar;
- duplicar;
- renombrar;
- eliminar;
- exportar JSON;
- importar JSON;
- asignar a páginas.

Las plantillas deben almacenarse localmente, utilizando el almacenamiento disponible en el navegador o permitiendo exportarlas como archivos JSON.

## 12. Estructura mínima de una plantilla

```json
{
  "version": "1.0",
  "id": "plantilla_contenido_agua",
  "nombre": "Contenido de agua",
  "descripcion": "Plantilla para informes de contenido de agua",
  "pagina_base": {
    "ancho": 2480,
    "alto": 3508
  },
  "campos": [],
  "tablas": [],
  "layout_excel": {
    "hojas": []
  },
  "opciones": {
    "usar_buffer": true,
    "buffer_default": {
      "x": 8,
      "y": 5
    },
    "usar_ocr_como_respaldo": true
  }
}
```

Las coordenadas deben mantenerse en un sistema estable, preferiblemente relativo al tamaño de la página, para que la plantilla sea tolerante a cambios de resolución o escala.

## 13. Interfaz propuesta

### Pantalla de carga

- seleccionar carpeta;
- seleccionar PDF individual;
- listar documentos encontrados;
- mostrar errores de lectura.

### Pantalla de clasificación

- documento seleccionado;
- miniaturas de páginas;
- plantilla seleccionada por página;
- estado de cada página;
- filtro por páginas sin plantilla o con revisión pendiente.

### Editor de plantillas

- visor de página;
- zoom y desplazamiento;
- herramienta de campo;
- herramienta de tabla;
- lista de campos y tablas;
- propiedades del elemento seleccionado;
- configuración de buffer;
- botón para guardar plantilla.

### Diseñador Excel

- cuadrícula editable;
- asignación de atributos;
- creación de hojas;
- combinación de celdas;
- previsualización del resultado.

### Procesamiento

- procesar PDF;
- procesar carpeta;
- barra de progreso;
- resumen de páginas procesadas;
- resumen de páginas omitidas;
- resumen de advertencias;
- descarga de archivos Excel.

### Revisión

- lista de problemas;
- página de origen;
- bounding box resaltado;
- texto detectado;
- valor corregido;
- exportación del resultado corregido.

## 14. Requisitos funcionales

- RF-01: cargar una carpeta con múltiples PDFs.
- RF-02: cargar un PDF individual.
- RF-03: visualizar documentos y páginas.
- RF-04: asignar una plantilla individual a cada página.
- RF-05: impedir el procesamiento de páginas sin plantilla.
- RF-06: crear plantillas desde páginas de PDFs cargados.
- RF-07: crear, editar, mover y eliminar bounding boxes.
- RF-08: nombrar campos individuales.
- RF-09: configurar buffer por bounding box.
- RF-10: crear tablas mediante área total, filas, columnas y divisiones visuales.
- RF-11: generar nombres automáticos de celdas de tabla.
- RF-12: conservar las coordenadas de cada celda.
- RF-13: diseñar el layout del Excel mediante una cuadrícula.
- RF-14: exportar e importar plantillas JSON.
- RF-15: procesar un PDF individual.
- RF-16: procesar toda una carpeta.
- RF-17: generar un Excel por PDF.
- RF-18: generar hojas por página y por tabla según la configuración.
- RF-19: inferir automáticamente tipos de datos.
- RF-20: resaltar resultados con baja confianza.
- RF-21: generar revisión para páginas o campos problemáticos.
- RF-22: mantener la ejecución local en el navegador.

## 15. Requisitos no funcionales

- La interfaz debe funcionar en navegadores modernos basados en Chromium y Firefox.
- El procesamiento debe mostrar progreso y no bloquear innecesariamente la interfaz.
- Las operaciones pesadas deben ejecutarse mediante Web Workers cuando sea necesario.
- Los archivos originales no deben modificarse.
- Las plantillas deben poder respaldarse como archivos JSON.
- El sistema debe conservar información suficiente para reproducir una extracción.
- Los errores de una página no deben cancelar el procesamiento del resto del lote.
- El sistema debe permitir agregar nuevos tipos de formato sin modificar el motor principal.

## 16. Decisiones ya tomadas

- La aplicación será general y no estará atada a páginas específicas.
- No se utilizará Python.
- No se utilizará Node.js.
- La interfaz será HTML, CSS y JavaScript.
- Las plantillas se asignarán individualmente por página.
- Las páginas sin plantilla no se procesarán.
- Las plantillas se guardarán como JSON.
- Las tablas tendrán nombre definido por el usuario y atributos automáticos.
- No se usarán encabezados de tabla automáticamente en la primera versión.
- Se generará un Excel por PDF.
- Las páginas procesadas podrán generar hojas independientes.
- Cada tabla podrá generarse en una hoja propia.
- Se soportará procesamiento individual y por carpeta.
- Los bounding boxes tendrán buffer.
- Los resultados con problemas generarán una revisión.
- El soporte inicial se enfocará en PDFs digitales.

## 17. Fases recomendadas

### Fase 1 — Base de la aplicación

- visor PDF;
- carga de carpeta y PDF individual;
- listado de páginas;
- biblioteca básica de plantillas;
- asignación manual de plantilla por página.

### Fase 2 — Editor de campos

- creación y edición de bounding boxes;
- nombres de atributos;
- buffers;
- guardado y carga de JSON;
- extracción de texto digital.

### Fase 3 — Editor de tablas

- selección de área total;
- filas y columnas;
- divisiones con mouse;
- celdas automáticas;
- nombres `TablaXX_FilaXX_ColumnaXX`.

### Fase 4 — Diseñador Excel

- cuadrícula de salida;
- asignación de campos a celdas;
- configuración de hojas;
- exportación a XLSX.

### Fase 5 — Procesamiento y revisión

- procesamiento por PDF y carpeta;
- tipos automáticos;
- confianza;
- detección de advertencias;
- pantalla de revisión.

### Fase 6 — Mejoras futuras

- OCR para PDFs escaneados;
- detección automática de tablas;
- sugerencia automática de plantillas;
- detección de campos por etiquetas;
- encabezados configurables;
- reglas de validación por formato.

## 18. Criterio de éxito

La primera versión será exitosa cuando un usuario pueda:

1. cargar una carpeta de PDFs;
2. seleccionar una página como ejemplo;
3. crear una plantilla sin escribir código;
4. crear campos individuales y tablas visualmente;
5. diseñar el layout de salida en Excel;
6. asignar esa plantilla a páginas individuales;
7. procesar un PDF o toda la carpeta;
8. descargar un Excel por PDF;
9. obtener una revisión clara de cualquier página o campo que no pueda procesarse.

