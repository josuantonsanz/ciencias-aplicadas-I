# Ciencias Aplicadas I · Material de aula

Plantilla **HTML + CSS + JS** para la asignatura *Ciencias Aplicadas I*
(Formación Básica): Matemáticas, Biología, Física y Química.

El contenido se escribe en **Markdown** (carpeta `capitulos/`) y un comando lo
convierte en páginas HTML con diseño, índice lateral, impresión en PDF y modo
diapositivas.

## Cómo funciona

```
escribes Markdown  →  node build.js  →  HTML estático listo para usar
(capitulos/*.md)      (o construir.bat)   (index.html + capitulos/*.html)
```

- **Leer online:** abre `index.html` y entra en cada capítulo.
- **PDF listo para fotocopiar:** botón **Descargar PDF** en cada capítulo.
  Al construir, `build.js` genera `capitulos/*.pdf` con Chrome o Edge en segundo
  plano, **sin** el encabezado ni el pie del navegador. La cabecera muestra
  `Ciencias Aplicadas I - 1º FPB` a la izquierda y `Colegio San Gabriel` a la
  derecha (se configuran con `serie`, `nivel` y `centro` en
  `capitulos/lista.json`); el pie, por ejemplo,
  `Cap 2. Combinar la materia - 3/18`. Si no hay Chrome ni Edge, usa
  `node build.js --sin-pdf` o define la variable `CHROME_PATH`.
- **Imprimir desde el navegador:** `Ctrl+P`. Diseño de libro
  de texto en A4: texto serif, títulos de distinto tamaño, cajas en gris e
  ilustraciones en escala de grises. El capítulo abre con su número grande a
  la izquierda del título, sin marcos ni líneas alrededor; debajo aparecen la
  materia, el curso y el nivel de `capitulos/lista.json`. No hay portada aparte.
  Los títulos principales (`##`) reservan unos 51 mm de continuación: si quedan
  demasiado abajo (aproximadamente en el último 20 % de la zona útil), pasan a
  la página siguiente. Esa reserva no añade un hueco debajo del título ni obliga
  a abrir página en cada sección. Las cajas y tablas largas pueden continuar en
  la siguiente página para reducir huecos. Los márgenes se repiten en todas las
  páginas (22 mm arriba, **24 mm a los lados** y 21 mm abajo). La cabecera con la
  asignatura y el centro no lleva líneas. Para ver la cabecera y el pie propios al imprimir, usa
  **Chrome o Edge** y desactiva **Encabezados y pies de página** del navegador
  (Firefox no admite esas cajas de margen y mostraría los suyos). Usa **A4**,
  **escala 100 %**, **márgenes predeterminados** y **Gráficos de fondo**
  activados.
- **Diapositivas:** botón **▶ Diapositivas** dentro de cada capítulo.
  Navega con `←` `→` `Espacio` `Esc` o deslizando en pantalla táctil.
- **Numeración de títulos:** se genera al construir, igual en HTML, índice
  lateral, diapositivas y PDF: `##` → `1`, `###` → `1.1`, `####` → `1.1.1`,
  hasta `######`. Reinicia en cada capítulo; no escribas esos números a mano.
  Las actividades conservan su propia numeración independiente.

## Archivos

| Archivo / carpeta      | Qué es                                             |
|------------------------|----------------------------------------------------|
| `capitulos/*.md`       | **Contenido** de cada capítulo (Markdown). Se edita. |
| `capitulos/lista.json` | Datos generales (`serie`, `nivel`, `centro`, `curso`) y títulos, materias y descripciones de los capítulos. |
| `plantilla.html`       | Plantilla que da forma a cada capítulo.            |
| `build.js`             | Conversor Markdown → HTML y generación de los PDF. |
| `pdf.js`               | Exporta los PDF con Chrome/Edge en modo headless.  |
| `construir.bat`        | Ejecuta el build con doble clic (Windows).         |
| `editar-local.bat`     | Abre el editor visual de Markdown solo en este equipo. |
| `editor-local.js`      | Servidor local del editor (se enlaza a `127.0.0.1`). |
| `subir-github.bat`     | Construye, crea un commit y sube los cambios a GitHub. |
| `lib/marked.min.js`    | Conversor de Markdown (ya incluido, no requiere instalar nada). |
| `lib/katex/`           | Renderizador local de fórmulas LaTeX y sus fuentes (funciona sin conexión). |
| `styles.css` / `script.js` | Diseño y comportamiento (índice, diapositivas, impresión). |
| `FORMATO-MARKDOWN.md`  | **Guía con todas las opciones de Markdown y `:::`.** |

## Uso

1. Edita el archivo `.md` del capítulo en `capitulos/`. Usa `##` para sus secciones.
2. Mantén una entrada en `capitulos/lista.json` por cada capítulo (título, materia, número de secciones y descripción).
3. Ejecuta `node build.js` o haz doble clic en **`construir.bat`**. Además del
   HTML, se regeneran los PDF de `capitulos/` (usa `node build.js --sin-pdf`
   para saltar este paso).
4. Abre `index.html`.

### Editor visual local

Para editar sin abrir los `.md` directamente, haz doble clic en
**`editar-local.bat`**. Se abrirá `http://127.0.0.1:8765/editor`; deja abierta
la ventana de consola mientras trabajas. También puedes ejecutarlo desde una
terminal con `node editor-local.js`.

El editor permite elegir capítulo, navegar por sus `##`, `###` y bloques
`:::`, insertar plantillas de los bloques disponibles y guardar con
**Ctrl+S**. La vista previa se actualiza automáticamente mientras escribes,
sin guardar nada todavía. Al guardar actualiza el `.md` y ejecuta
automáticamente `build.js`. En las páginas de capítulo servidas por ese editor
aparece además el botón **Editar Markdown**.

**Seguridad y GitHub:** el editor no forma parte de GitHub Pages. El servidor
solo escucha en `127.0.0.1` (no en la red), usa una sesión temporal y solo
acepta guardar los Markdown declarados en `capitulos/lista.json`. Los botones
permanecen ocultos en los HTML publicados y GitHub no puede ejecutar Node ni
escribir en tus archivos. El archivo `editor-local.js` puede estar en el
repositorio como código fuente, pero no ofrece una URL de edición en la web
publicada.

Para publicar los cambios, haz doble clic en **`subir-github.bat`**. Primero
construye las páginas, te pide el mensaje del *commit* y después las sube a la
rama `main` del repositorio de GitHub.

No hace falta conexión a internet para usar el resultado: todo es HTML estático
que puedes abrir con doble clic o subir a **GitHub Pages** (o cualquier hosting)
tal cual, porque los capítulos ya están convertidos.

## Sintaxis rápida

```markdown
## Título de la sección         → sección principal
### Título del apartado         → diapositiva propia

**negrita**, *cursiva*, listas y tablas como en cualquier Markdown.

::: ejemplo Título opcional     → caja de ejemplo
contenido...
:::

::: resumen                     → caja de resumen
- idea clave
:::

::: formula                     → fórmula centrada con LaTeX
$$v = \\frac{d}{t}$$
:::

::: actividades                → caja de actividades numerada automáticamente
1. Resuelve los ejercicios 1 y 2.
2. Compara el resultado con tu compañero.

::: temporizador 3 min        → cuenta atrás visual con aviso sonoro final
Resuelve la actividad por parejas.
:::
:::
```

Para matemáticas, usa `$...$` en línea o `$$...$$` como fórmula centrada;
por ejemplo, `$6 + 4 \\times 5 = 26$`. Todas las opciones (tipos de caja,
fórmulas, tablas, añadir capítulos…) están detalladas en
**`FORMATO-MARKDOWN.md`**.

## Comprobar el conversor

Después de reconstruir, ejecuta `node --test tests/build.test.js tests/pdf.test.js`
para comprobar la numeración, la jerarquía de títulos, los bloques anidados,
LaTeX, las cabeceras de impresión y que los HTML publicados coinciden con el
Markdown. Si hay Chrome/Edge, también genera tres PDF temporales para comprobar
que los títulos principales demasiado bajos saltan de página; sin navegador,
solo se omite esa prueba. No necesita instalar dependencias.

## Personalizar colores

En la parte superior de `styles.css`, dentro de `:root`, están las variables
`--azul`, `--mat`, `--bio`, `--fis`, `--qui`, etc.
