"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { urlArchivo, detectarNavegador, generarPDFs } = require("../pdf.js");

const css = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const impresion = css.slice(css.indexOf("@media print {"));
const regla = selector => {
  const inicio = impresion.indexOf(selector + " {");
  assert.notEqual(inicio, -1, "Falta la regla de impresión " + selector);
  return impresion.slice(inicio, impresion.indexOf("}", inicio) + 1);
};

test("urlArchivo codifica espacios y separadores para Chrome", () => {
  const url = urlArchivo("capitulos/02-combinar-la-materia.html");
  assert.match(url, /^file:\/\/\//);
  assert.doesNotMatch(url, /\\/);
  const conEspacios = urlArchivo("Carpeta con espacios/02 tema.html");
  assert.match(conEspacios, /Carpeta%20con%20espacios\/02%20tema\.html$/);
});

test("detectarNavegador devuelve una ruta existente o null", () => {
  const navegador = detectarNavegador();
  assert.ok(navegador === null || typeof navegador === "string");
});

test("la impresión amplía los márgenes laterales sin alterar los verticales", () => {
  assert.match(impresion, /margin: 22mm 24mm 21mm;/);
});

test("el título de capítulo y la cabecera de página no acumulan líneas", () => {
  assert.match(regla(".content > .cover"), /display: grid;/);
  assert.match(regla(".content > .cover"), /border: 0;/);
  assert.match(regla(".cover__number"), /display: block;/);
  assert.match(regla(".cover__subtitle .tag"), /border: 0;/);
  assert.doesNotMatch(regla("@top-left"), /border/);
  assert.doesNotMatch(regla("@top-right"), /border/);
  assert.match(regla(".content > .cover + .slide h2"), /border-top: 0;/);
  assert.match(css.slice(0, css.indexOf("@media print {")), /\.cover__number \{ display: none; \}/);
});

test("los títulos principales reservan continuación sin añadir hueco ni forzar cada sección", () => {
  assert.match(impresion, /--print-section-reserve: 51mm;/);
  const h2 = regla(".slide h2");
  assert.match(h2, /padding-bottom: var\(--print-section-reserve\);/);
  assert.match(h2, /margin: 17pt 0 calc\(9pt - var\(--print-section-reserve\)\);/);
  assert.match(impresion, /break-inside: avoid;/);
  assert.match(regla(".slide"), /break-before: auto;/);
  assert.doesNotMatch(impresion, /break-before:\s*(?:page|always)/);
});

const navegador = detectarNavegador();
test("Chrome desplaza un título principal tardío, pero no uno con espacio suficiente", {
  skip: !navegador && "No hay Chrome/Edge para la prueba de paginación",
  timeout: 180000
}, () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "ciencias-paginacion-"));
  const casos = [
    { nombre: "con-espacio", altura: 175, paginas: 1 },
    { nombre: "muy-abajo", altura: 203, paginas: 2 },
    { nombre: "control-sin-reserva", altura: 203, paginas: 1, sinReserva: true }
  ];
  try {
    const capitulos = casos.map(caso => {
      const archivo = path.join(carpeta, caso.nombre + ".md");
      const html = '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        + '<style>' + css + (caso.sinReserva ? '@media print { :root { --print-section-reserve: 0mm; } }' : '')
        + '</style></head><body><main class="content"><div style="height:' + caso.altura + 'mm"></div>'
        + '<section class="slide"><h2>Boundary heading</h2><p>Section text.</p></section>'
        + '</main></body></html>';
      fs.writeFileSync(archivo.replace(/\.md$/, ".html"), html);
      return { archivo };
    });
    generarPDFs(capitulos, navegador);
    casos.forEach(caso => {
      // Chrome emite los objetos de página sin comprimir. No se necesita
      // instalar un lector PDF: /Page se distingue de /Pages con el límite.
      const pdf = fs.readFileSync(path.join(carpeta, caso.nombre + ".pdf"), "latin1");
      assert.ok(pdf.startsWith("%PDF-"));
      assert.equal((pdf.match(/\/Type\s*\/Page\b/g) || []).length, caso.paginas, caso.nombre);
    });
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
});
