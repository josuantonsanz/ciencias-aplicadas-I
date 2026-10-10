"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderarCapitulo, renderarEstilosImpresion } = require("../build.js");

const cap = { titulo: "Capítulo de prueba", materia: "ciencias" };
const render = md => renderarCapitulo(md, cap, "Ciencias Aplicadas I", 4);
const encabezados = html => Array.from(html.matchAll(/<h([2-6])><span class="heading__number">([^<]+)<\/span> ([\s\S]*?)<\/h\1>/g), m => ({ nivel: Number(m[1]), numero: m[2], titulo: m[3] }));

test("numera todos los niveles y reinicia cada contador al cambiar de apartado", () => {
  const html = render("## Principal\nTexto.\n### Apartado\nTexto.\n#### Detalle\nTexto.\n##### Más detalle\nTexto.\n###### Último nivel\nTexto.\n#### Otro detalle\nTexto.\n### Otro apartado\n#### Detalle nuevo\nTexto.\n## Otra sección\n### Apartado nuevo\nTexto.");
  assert.deepEqual(encabezados(html).map(h => [h.nivel, h.numero]), [
    [2, "1"], [3, "1.1"], [4, "1.1.1"], [5, "1.1.1.1"], [6, "1.1.1.1.1"],
    [4, "1.1.2"], [3, "1.2"], [4, "1.2.1"], [2, "2"], [3, "2.1"]
  ]);
  assert.match(html, /data-seccion-numero="2" data-numero="2.1" data-nivel="3"/);
  assert.equal(encabezados(render("## Otra prueba\nTexto."))[0].numero, "1");
});

test("conserva títulos vacíos y distingue secciones con el mismo nombre", () => {
  const html = render("## Repetido\n### Vacío\n### Con texto\nTexto.\n## Repetido\n### Con texto\nMás texto.\n## Solo título");
  assert.deepEqual(encabezados(html).map(h => h.numero), ["1", "1.1", "1.2", "2", "2.1", "3"]);
  assert.match(html, /data-seccion="Repetido" data-seccion-numero="1"/);
  assert.match(html, /data-seccion="Repetido" data-seccion-numero="2"/);
  assert.equal((html.match(/slide--seccion--titulo-necesario/g) || []).length, 2);
  assert.match(html, /<li><span class="heading__number">1.2<\/span> Con texto<\/li>/);
  const ids = Array.from(html.matchAll(/id="(seccion-\d+)"/g), m => m[1]);
  assert.equal(new Set(ids).size, 6);
});

test("no confunde títulos dentro de código con apartados", () => {
  const html = render("# Ignorado\n## Principal\n```markdown\n## Esto es código\n### También\n```\n### Apartado real\nTexto.");
  assert.deepEqual(encabezados(html).map(h => h.numero), ["1", "1.1"]);
  assert.match(html, /<code class="language-markdown">## Esto es código/);
  assert.doesNotMatch(html, /Ignorado/);
});

test("mantiene Markdown y LaTeX en títulos y números separados del contenido", () => {
  const html = render("## **Fórmulas** y $\\frac{a}{b}$\n### $\\sqrt{x}$\n#### El **detalle**\nTexto con $\\frac{m}{V}$.");
  assert.match(html, /<h2><span class="heading__number">1<\/span> <strong>Fórmulas<\/strong> y \$\\frac\{a\}\{b\}\$/);
  assert.match(html, /<h3><span class="heading__number">1.1<\/span> \$\\sqrt\{x\}\$/);
  assert.match(html, /<h4><span class="heading__number">1.1.1<\/span> El <strong>detalle<\/strong>/);
  assert.match(html, /\$\\frac\{m\}\{V\}\$/);
});

test("comparte numeración inferior entre fragmentos y cajas anidadas", () => {
  const html = render("## Principal\n### Apartado\n#### Antes\nTexto.\n::: nota\n#### Dentro\nTexto.\n::: ejemplo\n##### Más detalle\nTexto.\n:::\n:::\n#### Después\nTexto.");
  assert.deepEqual(encabezados(html).map(h => h.numero), ["1", "1.1", "1.1.1", "1.1.2", "1.1.2.1", "1.1.3"]);
});

test("no duplica números entre títulos de cajas y apartados posteriores", () => {
  const html = render("## Principal\n::: nota\n### Apartado dentro de la nota\nTexto.\n:::\n### Apartado siguiente\nTexto.");
  assert.deepEqual(encabezados(html).map(h => h.numero), ["1", "1.1", "1.2"]);
});

test("respeta el símbolo # en títulos y elimina solo los cierres Markdown", () => {
  const html = render("## Lenguaje C#\nTexto.\n### Apartado ###\nTexto.");
  assert.deepEqual(encabezados(html).map(h => h.titulo), ["Lenguaje C#", "Apartado"]);
});

test("actividades mantienen una numeración independiente y el reloj tiene duración imprimible", () => {
  const md = "## Principal\n::: actividades\n1. Resuelve.\n::: temporizador 3 min\nEn parejas.\n:::\n:::\n### Apartado\n::: actividades\n1. Comprueba.\n:::";
  const html = render(md);
  assert.deepEqual(Array.from(html.matchAll(/data-actividad="(\d+)"/g), m => m[1]), ["1", "2"]);
  assert.match(html, /data-timer-seconds="180" data-timer-duration="3:00"/);
  assert.deepEqual(encabezados(html).map(h => h.numero), ["1", "1.1"]);
  assert.match(render(md), /data-actividad="1"/);
});

test("cabeceras de impresión escapan cadenas CSS y cierres de style", () => {
  const styles = renderarEstilosImpresion({ titulo: 'Un "título" </style>' }, "Serie", 4);
  assert.match(styles, /@top-right \{ content: "Capítulo 4";/);
  assert.match(styles, /\\"título\\"/);
  assert.match(styles, /\\3c \/style>/);
  assert.equal((styles.match(/<\/style>/g) || []).length, 1);
});

test("los HTML publicados coinciden con el conversor y no pierden actividades", () => {
  const root = path.join(__dirname, "..");
  const lista = JSON.parse(fs.readFileSync(path.join(root, "capitulos/lista.json"), "utf8"));
  for (const [idx, chapter] of lista.capitulos.entries()) {
    const md = fs.readFileSync(path.join(root, chapter.archivo), "utf8");
    const generated = renderarCapitulo(md, chapter, lista.serie, idx + 1);
    const page = fs.readFileSync(path.join(root, chapter.archivo.replace(/\.md$/, ".html")), "utf8");
    assert.ok(page.includes(generated), chapter.archivo + ": ejecutar node build.js");
    assert.ok(page.includes(renderarEstilosImpresion(chapter, lista.serie, idx + 1)));
    assert.doesNotMatch(page, /\{\{[A-Z_]+\}\}/);
    const sourceActivities = (md.match(/^:::\s*actividad(?:es)?(?:\s|$)/gm) || []).length;
    const actualActivities = Array.from(generated.matchAll(/data-actividad="(\d+)"/g), m => Number(m[1]));
    assert.deepEqual(actualActivities, Array.from({length:sourceActivities}, (_, n) => n + 1));
    assert.equal(encabezados(generated).filter(h => h.nivel === 2).length, (md.match(/^##\s/gm) || []).length);
    assert.equal(encabezados(generated).filter(h => h.nivel === 3).length, (md.match(/^###\s/gm) || []).length);
  }
});
