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
```

Para matemáticas, usa `$...$` en línea o `$$...$$` como fórmula centrada;
por ejemplo, `$6 + 4 \\times 5 = 26$`. Todas las opciones (tipos de caja,
fórmulas, tablas, añadir capítulos…) están detalladas en
**`FORMATO-MARKDOWN.md`**.

## Personalizar colores

En la parte superior de `styles.css`, dentro de `:root`, están las variables
`--azul`, `--mat`, `--bio`, `--fis`, `--qui`, etc.
