#!/usr/bin/env node
/* ============================================================
   editor-local.js — Editor Markdown exclusivo para este equipo.

   Se enlaza únicamente a 127.0.0.1 y nunca se publica mediante
   GitHub Pages. No utiliza dependencias ni envía contenido a Internet.
   ============================================================ */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { renderarCapitulo, renderarPortada, renderarEstilosImpresion } = require("./build.js");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8765);
const SESSION = crypto.randomBytes(32).toString("hex");
const CSRF = crypto.randomBytes(32).toString("hex");
const MAX_BODY = 5 * 1024 * 1024;

function enviar(res, estado, cuerpo, tipo, cabeceras) {
  res.writeHead(estado, Object.assign({
    "Content-Type": tipo || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"
  }, cabeceras || {}));
  res.end(cuerpo);
}

function json(res, estado, datos) {
  enviar(res, estado, JSON.stringify(datos), "application/json; charset=utf-8");
}

function listaCapitulos() {
  const lista = JSON.parse(fs.readFileSync(path.join(ROOT, "capitulos/lista.json"), "utf8"));
  return Array.isArray(lista.capitulos) ? lista.capitulos : [];
}

function archivoPermitido(archivo) {
  const pedido = String(archivo || "").replace(/\\/g, "/");
  return listaCapitulos().find(function (capitulo) {
    return capitulo.archivo.replace(/\\/g, "/") === pedido;
  }) || null;
}

function esClienteLocal(req) {
  const ip = req.socket.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function cookies(req) {
  return String(req.headers.cookie || "").split(";").reduce(function (resultado, parte) {
    const posicion = parte.indexOf("=");
    if (posicion > -1) resultado[parte.slice(0, posicion).trim()] = parte.slice(posicion + 1).trim();
    return resultado;
  }, {});
}

function accesoEditorValido(req) {
  const origen = String(req.headers.origin || "");
  const origenValido = !origen || origen === "http://127.0.0.1:" + PORT || origen === "http://localhost:" + PORT || origen === "http://[::1]:" + PORT;
  return esClienteLocal(req)
    && origenValido
    && cookies(req).editor_session === SESSION
    && req.headers["x-editor-csrf"] === CSRF;
}

function leerJSON(req) {
  return new Promise(function (resolve, reject) {
    let cuerpo = "";
    req.setEncoding("utf8");
    req.on("data", function (trozo) {
      cuerpo += trozo;
      if (Buffer.byteLength(cuerpo, "utf8") > MAX_BODY) {
        reject(new Error("El archivo es demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", function () {
      try { resolve(JSON.parse(cuerpo)); } catch (error) { reject(new Error("La petición no contiene JSON válido.")); }
    });
    req.on("error", reject);
  });
}

function escaparHTML(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Devuelve una página aislada para la previsualización en vivo. Usa las mismas
   funciones de build.js que generan el HTML definitivo, pero no escribe nada. */
function paginaPrevisualizacion(markdown, capitulo) {
  const lista = JSON.parse(fs.readFileSync(path.join(ROOT, "capitulos/lista.json"), "utf8"));
  const numero = lista.capitulos.findIndex(function (item) { return item.archivo === capitulo.archivo; }) + 1;
  const contenido = renderarCapitulo(markdown, capitulo, lista.serie, numero);
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    + '<base href="/">'
    + '<link rel="stylesheet" href="styles.css">'
    + '<link rel="stylesheet" href="lib/katex/katex.min.css">'
    + renderarEstilosImpresion(capitulo, lista.serie, numero)
    + '<style>@media screen{body{overflow:auto}.content{max-width:1100px;margin:0 auto;padding:1rem}}.page-footer{display:none}</style>'
    + '</head><body><main class="content">'
    + renderarPortada(capitulo, lista.serie, numero) + contenido
    + '</main><script src="lib/katex/katex.min.js"></script>'
    + '<script src="lib/katex/auto-render.min.js"></script>'
    + '<script>renderMathInElement(document.querySelector(".content"),{delimiters:[{left:"$$",right:"$$",display:true},{left:"\\\\[",right:"\\\\]",display:true},{left:"$",right:"$",display:false},{left:"\\\\(",right:"\\\\)",display:false}],throwOnError:false,strict:"warn"});</script>'
    + '</body></html>';
}

function paginaEditor(archivoInicial) {
  const capitulos = listaCapitulos().map(function (cap) {
    return { archivo: cap.archivo, titulo: cap.titulo };
  });
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Editor local · Ciencias Aplicadas I</title>
<style>
:root { color-scheme: light; --azul:#1769aa; --tinta:#17212b; --suave:#f4f7fa; --linea:#d5dfe8; --verde:#16784c; --rojo:#b3261e; }
* { box-sizing:border-box; } body { margin:0; color:var(--tinta); font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif; background:var(--suave); }
header { min-height:64px; display:flex; gap:12px; align-items:center; padding:10px 18px; color:white; background:#123a59; } header strong { margin-right:auto; font-size:1.05rem; } button, select { font:inherit; } button { border:1px solid transparent; border-radius:6px; padding:.52em .8em; cursor:pointer; background:white; color:#123a59; font-weight:650; } button:hover { filter:brightness(.96); } button:focus-visible, select:focus-visible, textarea:focus-visible { outline:3px solid #ffbf47; outline-offset:2px; } #guardar { background:#6ee7b7; } #estado { font-size:.88rem; min-height:1.3em; } #estado.error { color:#ffd1cc; }
#principal { display:grid; grid-template-columns:250px minmax(320px,1fr) minmax(320px,1fr); height:calc(100vh - 64px); } aside { overflow:auto; padding:18px; border-right:1px solid var(--linea); background:white; } aside h2 { margin:0 0 .8rem; font-size:1rem; } #capitulos { width:100%; margin-bottom:18px; padding:.45em; } #bloques { list-style:none; margin:0; padding:0; } #bloques button { width:100%; margin:2px 0; text-align:left; border:0; border-radius:4px; padding:.38em .45em; color:var(--tinta); background:transparent; font-weight:400; } #bloques button:hover { background:#e8f1f8; } .nivel-3 { padding-left:1.3em !important; } .tipo { color:#5c6873; font-family:ui-monospace,monospace; font-size:.84em; }
#edicion { min-width:0; display:flex; flex-direction:column; padding:14px; gap:9px; } #ayudas { display:flex; flex-wrap:wrap; gap:6px; } #ayudas button { border-color:var(--linea); padding:.35em .55em; font-size:.86rem; } textarea { flex:1; width:100%; resize:none; border:1px solid #9fadb9; border-radius:7px; padding:16px; color:#18222b; background:#fff; font:15px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace; tab-size:2; } #vista { min-width:0; border-left:1px solid var(--linea); background:#fff; display:flex; flex-direction:column; } #vista p { margin:12px 14px; font-size:.9rem; color:#52606c; } iframe { flex:1; width:100%; border:0; background:#fff; }
.aviso { padding:9px 14px; margin:0; background:#fff8d9; border-bottom:1px solid #ead789; font-size:.88rem; } @media (max-width:1000px) { #principal { grid-template-columns:210px 1fr; } #vista { grid-column:1 / -1; min-height:55vh; border-left:0; border-top:1px solid var(--linea); } } @media (max-width:640px) { header { align-items:flex-start; flex-wrap:wrap; } #principal { display:block; height:auto; } aside { border-right:0; border-bottom:1px solid var(--linea); } #bloques { max-height:180px; overflow:auto; } #edicion { height:70vh; } #vista { height:70vh; } }
</style></head><body>
<header><strong>✎ Editor local de Markdown</strong><span id="estado" aria-live="polite">Cargando…</span><button id="ver" type="button">Actualizar vista</button><button id="guardar" type="button">Guardar y reconstruir</button></header>
<div class="aviso">Este editor solo está disponible en <b>este ordenador</b> (127.0.0.1). Guardar modifica el archivo <code>.md</code> y reconstruye las páginas HTML; después puedes revisarlas y subirlas con el proceso habitual.</div>
<main id="principal"><aside><h2>Capítulo</h2><select id="capitulos" aria-label="Capítulo"></select><h2>Estructura y bloques</h2><ul id="bloques" aria-label="Bloques del Markdown"></ul></aside>
<section id="edicion" aria-label="Edición"><div id="ayudas"><button data-inserta="## Nueva sección\n\n">+ Sección</button><button data-inserta="### Nuevo apartado\n\n">+ Apartado</button><button data-inserta="::: ejemplo Título\nExplicación.\n:::\n\n">+ Ejemplo</button><button data-inserta="::: resumen\n- Idea clave\n:::\n\n">+ Resumen</button><button data-inserta="::: dato\nTexto.\n:::\n\n">+ Dato</button><button data-inserta="::: formula\n$$\\frac{a}{b}$$\n:::\n\n">+ Fórmula</button><button data-inserta="::: actividades\n1. Actividad.\n:::\n\n">+ Actividades</button><button data-inserta="::: temporizador 3 min\nInstrucción.\n:::\n\n">+ Temporizador</button></div><textarea id="markdown" spellcheck="true" aria-label="Markdown del capítulo"></textarea></section>
<section id="vista"><p>Vista previa instantánea: no guarda cambios hasta pulsar <b>Guardar y reconstruir</b>.</p><iframe id="preview" sandbox="allow-scripts" title="Vista previa del capítulo"></iframe></section></main>
<script>
(function () {
  "use strict";
  var TOKEN = ${JSON.stringify(CSRF)};
  var INICIAL = ${JSON.stringify(archivoInicial || "")};
  var selector = document.getElementById("capitulos"), area = document.getElementById("markdown"), bloques = document.getElementById("bloques"), estado = document.getElementById("estado"), vista = document.getElementById("preview");
  var actual = "", esperaVista = null, versionVista = 0;
  function api(ruta, opciones) { opciones = opciones || {}; opciones.headers = Object.assign({"X-Editor-CSRF": TOKEN}, opciones.headers || {}); return fetch(ruta, opciones).then(function (r) { return r.json().then(function (datos) { if (!r.ok) throw new Error(datos.error || "Error inesperado."); return datos; }); }); }
  function mensaje(texto, error) { estado.textContent = texto; estado.className = error ? "error" : ""; }
  function documentoVista(contenido) { return contenido; }
  function actualizarVista() { if (!actual) return; var version = ++versionVista; api("/api/preview", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({archivo:actual, markdown:area.value}) }).then(function (datos) { if (version === versionVista) vista.srcdoc = documentoVista(datos.html); }).catch(function (error) { if (version === versionVista) mensaje("No se pudo generar la vista: " + error.message, true); }); }
  function programarVista() { clearTimeout(esperaVista); esperaVista = setTimeout(actualizarVista, 350); }
  function irALinea(linea) { var lineas = area.value.split("\\n"), inicio = 0; for (var i=0; i < linea; i++) inicio += lineas[i].length + 1; area.focus(); area.setSelectionRange(inicio, inicio + (lineas[linea] || "").length); area.scrollTop = Math.max(0, (linea - 3) * 24); }
  function estructura() { bloques.innerHTML = ""; area.value.split("\\n").forEach(function (texto, linea) { var match = texto.match(/^(##|###)\\s+(.+)$/) || texto.match(/^:::\\s*([^\\s:]+)(?:\\s+(.*))?\\s*$/); if (!match) return; var boton = document.createElement("button"), esTitulo = match[1] === "##" || match[1] === "###"; boton.type = "button"; boton.className = esTitulo ? "nivel-" + match[1].length : "bloque"; boton.innerHTML = esTitulo ? escapar(match[1] + " " + match[2]) : '<span class="tipo">::: ' + escapar(match[1]) + '</span>' + (match[2] ? " " + escapar(match[2]) : ""); boton.addEventListener("click", function () { irALinea(linea); }); var li = document.createElement("li"); li.appendChild(boton); bloques.appendChild(li); }); }
  function escapar(valor) { var nodo = document.createElement("span"); nodo.textContent = valor; return nodo.innerHTML; }
  function cargar(archivo) { if (!archivo) return; mensaje("Cargando…"); api("/api/chapter?archivo=" + encodeURIComponent(archivo)).then(function (datos) { actual = datos.archivo; selector.value = actual; area.value = datos.markdown; estructura(); actualizarVista(); mensaje("Editando " + datos.titulo); }).catch(function (error) { mensaje(error.message, true); }); }
  api("/api/chapters").then(function (datos) { datos.capitulos.forEach(function (cap) { var opcion = document.createElement("option"); opcion.value = cap.archivo; opcion.textContent = cap.titulo; selector.appendChild(opcion); }); cargar(datos.capitulos.some(function (cap) { return cap.archivo === INICIAL; }) ? INICIAL : datos.capitulos[0].archivo); }).catch(function (error) { mensaje(error.message, true); });
  selector.addEventListener("change", function () { cargar(selector.value); }); area.addEventListener("input", function () { estructura(); programarVista(); });
  document.querySelectorAll("[data-inserta]").forEach(function (boton) { boton.addEventListener("click", function () { var texto = boton.getAttribute("data-inserta"), desde = area.selectionStart, hasta = area.selectionEnd; area.setRangeText(texto, desde, hasta, "end"); area.focus(); estructura(); programarVista(); }); });
  document.getElementById("ver").addEventListener("click", actualizarVista);
  function guardar() { if (!actual) return; mensaje("Guardando y reconstruyendo…"); api("/api/chapter", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({archivo:actual, markdown:area.value}) }).then(function () { mensaje("Guardado y reconstruido correctamente."); actualizarVista(); }).catch(function (error) { mensaje(error.message, true); }); }
  document.getElementById("guardar").addEventListener("click", guardar); document.addEventListener("keydown", function (evento) { if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "s") { evento.preventDefault(); guardar(); } });
})();
</script></body></html>`;
}

function tipoContenido(archivo) {
  const ext = path.extname(archivo).toLowerCase();
  return ({ ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".woff2":"font/woff2", ".md":"text/plain; charset=utf-8" })[ext] || "application/octet-stream";
}

function servirEstatico(req, res, ruta) {
  let relativa;
  try { relativa = decodeURIComponent(ruta === "/" ? "/index.html" : ruta); } catch (_) { enviar(res, 400, "Ruta no válida."); return; }
  if (relativa.includes("\\") || relativa.split("/").includes(".git")) { enviar(res, 403, "No permitido."); return; }
  const archivo = path.resolve(ROOT, "." + relativa);
  if (!(archivo === ROOT || archivo.startsWith(ROOT + path.sep)) || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) { enviar(res, 404, "No encontrado."); return; }
  const tipo = tipoContenido(archivo);
  if (tipo.startsWith("text/html")) {
    const marca = "<script>window.__EDITOR_LOCAL__=true;</script>";
    const html = fs.readFileSync(archivo, "utf8").replace(/<\/head>/i, marca + "</head>");
    enviar(res, 200, html, tipo);
  } else {
    enviar(res, 200, fs.readFileSync(archivo), tipo);
  }
}

const servidor = http.createServer(function (req, res) {
  if (!esClienteLocal(req)) { enviar(res, 403, "Este servicio solo acepta conexiones locales."); return; }
  const url = new URL(req.url, "http://127.0.0.1:" + PORT);
  if (req.method === "GET" && url.pathname === "/editor") {
    const capitulo = archivoPermitido(url.searchParams.get("archivo"));
    enviar(res, 200, paginaEditor(capitulo && capitulo.archivo), "text/html; charset=utf-8", { "Set-Cookie": "editor_session=" + SESSION + "; HttpOnly; SameSite=Strict; Path=/" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/chapters") {
    if (!accesoEditorValido(req)) { json(res, 403, { error:"Acceso al editor no autorizado." }); return; }
    json(res, 200, { capitulos: listaCapitulos().map(function (cap) { return { archivo:cap.archivo, titulo:cap.titulo }; }) });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/chapter") {
    if (!accesoEditorValido(req)) { json(res, 403, { error:"Acceso al editor no autorizado." }); return; }
    const capitulo = archivoPermitido(url.searchParams.get("archivo"));
    if (!capitulo) { json(res, 404, { error:"Capítulo no encontrado." }); return; }
    json(res, 200, { archivo:capitulo.archivo, titulo:capitulo.titulo, markdown:fs.readFileSync(path.join(ROOT, capitulo.archivo), "utf8") });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/preview") {
    if (!accesoEditorValido(req)) { json(res, 403, { error:"Acceso al editor no autorizado." }); return; }
    leerJSON(req).then(function (datos) {
      const capitulo = archivoPermitido(datos.archivo);
      if (!capitulo || typeof datos.markdown !== "string") throw new Error("Capítulo o Markdown no válido.");
      if (Buffer.byteLength(datos.markdown, "utf8") > MAX_BODY) throw new Error("El archivo es demasiado grande.");
      json(res, 200, { html:paginaPrevisualizacion(datos.markdown, capitulo) });
    }).catch(function (error) { json(res, 400, { error:error.message || "No se pudo generar la vista previa." }); });
    return;
  }
  if (req.method === "PUT" && url.pathname === "/api/chapter") {
    if (!accesoEditorValido(req)) { json(res, 403, { error:"Acceso al editor no autorizado." }); return; }
    leerJSON(req).then(function (datos) {
      const capitulo = archivoPermitido(datos.archivo);
      if (!capitulo || typeof datos.markdown !== "string") throw new Error("Solo se pueden guardar los capítulos Markdown incluidos en lista.json.");
      if (Buffer.byteLength(datos.markdown, "utf8") > MAX_BODY) throw new Error("El archivo es demasiado grande.");
      const destino = path.join(ROOT, capitulo.archivo);
      const temporal = destino + ".tmp-" + process.pid;
      fs.writeFileSync(temporal, datos.markdown, "utf8");
      fs.renameSync(temporal, destino);
      const resultado = spawnSync(process.execPath, [path.join(ROOT, "build.js")], { cwd:ROOT, encoding:"utf8", timeout:30000 });
      if (resultado.error || resultado.status !== 0) throw new Error("El Markdown se ha guardado, pero no se pudo reconstruir: " + (resultado.stderr || (resultado.error && resultado.error.message) || "error desconocido"));
      json(res, 200, { ok:true, salida:resultado.stdout });
    }).catch(function (error) { json(res, 400, { error:error.message || "No se pudo guardar." }); });
    return;
  }
  if (req.method === "GET") servirEstatico(req, res, url.pathname);
  else enviar(res, 405, "Método no permitido.");
});

servidor.listen(PORT, "127.0.0.1", function () {
  console.log("Editor local disponible en http://127.0.0.1:" + PORT + "/editor");
  console.log("Solo escucha en 127.0.0.1: no se puede abrir desde GitHub ni desde otros equipos.");
});
