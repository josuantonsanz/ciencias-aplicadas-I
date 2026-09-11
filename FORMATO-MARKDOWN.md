# Formato Markdown de los capítulos

Cada capítulo es un archivo `.md` dentro de la carpeta `capitulos/`.
Al ejecutar `node build.js` (o `construir.bat`), esos archivos se convierten
automáticamente en páginas HTML con el diseño, el índice, la impresión y las
diapositivas ya incluidos.

---

## 1. Estructura de un capítulo

- El **título** del capítulo y su **materia** se escriben en `capitulos/lista.json`
  (no en el `.md`).
- Dentro del `.md`, cada sección principal empieza con `## Título de la sección`.
- Cada `##` genera una **diapositiva de sección** con su título y la lista de sus subtítulos `###`. Cada `###` con contenido crea después su propia diapositiva y muestra solo el título de ese apartado.
- Usa `###` para dividir una sección larga en diapositivas más breves; el índice lateral las agrupa bajo su encabezado `##`, que enlaza a su diapositiva de sección. Para subapartados o actividades dentro de ellos, usa `####`.

> Un solo archivo Markdown puede contener todas las secciones de un capítulo. En `lista.json` debe haber **una sola entrada** para ese archivo; el campo opcional `secciones` permite mostrar su número en el índice general.

Ejemplo mínimo (`capitulos/06-ejemplo.md`):

```markdown
## Primer apartado

Texto introductorio del apartado.

### Subtítulo (opcional)

Más contenido...

## Segundo apartado

### Subapartado con contenido

Más contenido...
```

> Nota: puedes empezar el archivo con `# Título`, pero se ignora (el título
> real es el de `lista.json`).

---

## 2. Sintaxis básica de Markdown

| Elemento | Se escribe | Resultado |
|----------|-----------|-----------|
| Negrita | `**texto**` | **texto** |
| Cursiva | `*texto*` | *texto* |
| Lista sin orden | `- elemento` | • elemento |
| Lista numerada | `1. elemento` | 1. elemento |
| Enlace | `[texto](https://…)` | enlace |
| Cita | `> texto` | cita |
| Título de sección | `## Título` | sección principal |
| Subtítulo | `### Subtítulo` | apartado nuevo y diapositiva propia |

### Tablas

```markdown
| Columna 1 | Columna 2 |
|-----------|-----------|
| dato      | dato      |
```

| Columna 1 | Columna 2 |
|-----------|-----------|
| dato      | dato      |

---

## 3. Contenedores especiales `:::`

Para crear cajas de color (ejemplos, resúmenes, etc.) se usan bloques que
empiezan y terminan con `:::`:

```markdown
::: tipo Título opcional
contenido en markdown
:::
```

El **título opcional** se escribe en la misma línea que el tipo. Si no se
escribe, se usa un título por defecto.

### Tipos disponibles

| Tipo | Alias | Caja generada | Título por defecto |
|------|-------|---------------|--------------------|
| `ejemplo` | `example` | azul (ejemplo) | *Ejemplo* |
| `resumen` | `resum` | verde (resumen) | *Resumen* |
| `dato` | `sabias`, `importante` | naranja (dato) | *¿Sabías que…?* / *Importante* |
| `nota` | — | gris (nota) | *Nota* |
| `math` | — | fórmula en línea, sin título | — |
| `formula` | `ecuacion` | fórmula centrada, sin título | — |

### Ejemplos

**Ejemplo con título personalizado:**

```markdown
::: ejemplo Calcular el IVA
Un producto cuesta 80 € y el IVA es del 21 %.
80 × 21 / 100 = 16,80 €
:::
```

**Resumen con lista:**

```markdown
::: resumen
- Respeta la jerarquía de operaciones.
- Una fracción expresa una parte de la unidad.
:::
```

**Dato curioso:**

```markdown
::: dato
El cuerpo humano tiene unos 37 billones de células.
:::
```

**Fórmula centrada:**

```markdown
::: formula
v = d / t
:::
```

**Nota:**

```markdown
::: nota
Entrega las actividades con los pasos y las unidades.
:::
```

---

## 4. Fórmulas y fracciones (LaTeX)

El material incluye **KaTeX** de forma local, por lo que las fórmulas se ven
mejor y el capítulo sigue funcionando sin conexión a Internet. Usa sintaxis
LaTeX entre delimitadores:

- `$...$` para una expresión dentro de un párrafo: `$\sqrt{3} \approx 1{,}73$`.
- `$$...$$` para una fórmula centrada. Es especialmente adecuado dentro de
  `::: formula` o `::: math`.

**Fracción y potencia:**

```markdown
::: formula
$$\frac{3}{4} + \frac{1}{4} = 1$$
:::

El volumen se expresa en $\mathrm{m}^{3}$.
```

Otros comandos frecuentes son `\times` (multiplicar), `\div` (dividir),
`\sqrt{...}` (raíz), `\pi`, `\leq` y `\geq`. Para escribir texto o unidades
dentro de una fórmula, usa `\text{...}` o `\mathrm{...}`:

```markdown
$6 + 4 \times (2 + 3) - 10 = 16$

$$v = \frac{d}{t} \qquad 1\,\mathrm{L} = 1\,\mathrm{dm}^{3}$$
```

> Es importante abrir y cerrar siempre cada delimitador. Si KaTeX encuentra
> una fórmula no válida, deja el texto visible para que se pueda corregir.

El HTML directo continúa siendo compatible para casos sencillos:

```markdown
m<sup>2</sup> y H<sub>2</sub>O
```

---

## 5. Añadir un capítulo nuevo

1. Crea `capitulos/06-tema.md` (o el nombre que quieras) y escribe el contenido.
2. Añade su entrada en `capitulos/lista.json`:

```json
{
  "archivo": "capitulos/06-tema.md",
  "titulo": "Título del nuevo capítulo",
  "materia": "matematicas",
  "secciones": 2,
  "descripcion": "Breve descripción que aparece en el índice."
}
```

3. Ejecuta `node build.js` (o doble clic en `construir.bat`).

Materias disponibles en `lista.json`:

| Clave | Etiqueta | Color |
|-------|----------|-------|
| `ciencias` | Ciencias aplicadas | azul |
| `matematicas` | Matemáticas | azul |
| `biologia` | Biología | verde |
| `fisica` | Física | naranja |
| `quimica` | Química | morado |
| `actividades` | Repaso | rosa |

---

## 6. Trucos

- Para **imágenes**, usa la sintaxis Markdown y guarda el archivo junto al
  capítulo. Aparecerán centradas automáticamente:

  ```markdown
  ![Descripción de la imagen](imagen.jpg)
  ```

  También se admite HTML directo: `<img src="imagen.jpg" alt="...">`.
- Para un **salto de página** forzado al imprimir, usa:
  `<div style="break-before: page"></div>`.
- Los enlaces a una sección del mismo capítulo pueden usar su ancla, por ejemplo:
  `[Ir a una sección](#seccion-2)`.
