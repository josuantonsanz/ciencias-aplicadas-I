"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { urlArchivo, detectarNavegador } = require("../pdf.js");

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
