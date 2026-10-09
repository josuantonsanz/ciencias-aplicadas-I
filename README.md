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
- **Imprimir / PDF:** botón **🖨️ Imprimir / PDF** o `Ctrl+P`. Salida A4, con
  portada y cada apartado en su propia página, sin la URL ni la fecha del navegador.
- **Diapositivas:** botón **▶ Diapositivas** dentro de cada capítulo.
  Navega con `←` `→` `Espacio` `Esc` o deslizando en pantalla táctil.

## Archivos

| Archivo / carpeta      | Qué es                                             |
|------------------------|----------------------------------------------------|
| `capitulos/*.md`       | **Contenido** de cada capítulo (Markdown). Se edita. |
| `capitulos/lista.json` | Títulos, materias y descripciones de los capítulos. |
| `plantilla.html`       | Plantilla que da forma a cada capítulo.            |
| `build.js`             | Conversor Markdown → HTML.                         |
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
3. Ejecuta `node build.js` o haz doble clic en **`construir.bat`**.
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

## Personalizar colores

En la parte superior de `styles.css`, dentro de `:root`, están las variables
`--azul`, `--mat`, `--bio`, `--fis`, `--qui`, etc.
