#!/usr/bin/env node
/* ============================================================
   build.js — Genera index.html y capitulos/*.html a partir de
   archivos Markdown (capitulos/*.md).

   Uso:  node build.js   (o doble clic en construir.bat)

   No requiere instalar nada: usa lib/marked.min.js (incluido).
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const marked = require("./lib/marked.min.js");

const RUTA_LISTA     = "capitulos/lista.json";
const RUTA_PLANTILLA = "plantilla.html";

/* Materias disponibles y su etiqueta de color */
const MATERIAS = {
  ciencias:     { label: "Ciencias aplicadas", cls: "tag--mat" },
  matematicas: { label: "Matemáticas", cls: "tag--mat" },
  biologia:    { label: "Biología",    cls: "tag--bio" },
  fisica:      { label: "Física",      cls: "tag--fis" },
  quimica:     { label: "Química",     cls: "tag--qui" },
  actividades: { label: "Repaso",      cls: "tag--act" },
};

/* Contenedores ::: admitidos.
   def = título por defecto (null => bloque sin título, render inline) */
const CONTENEDORES = {
  ejemplo:    { cls: "box box--example", def: "Ejemplo" },
  example:    { cls: "box box--example", def: "Ejemplo" },
  resumen:    { cls: "box box--resumen", def: "Resumen" },
  resum:      { cls: "box box--resumen", def: "Resumen" },
  dato:       { cls: "box box--dato",    def: "¿Sabías que…?" },
  importante: { cls: "box box--dato",    def: "Importante" },
  sabias:     { cls: "box box--dato",    def: "¿Sabías que…?" },
  nota:       { cls: "box",              def: "Nota" },
  math:       { cls: "math",             def: null },
  formula:    { cls: "math formula",     def: null },
  ecuacion:   { cls: "math formula",     def: null },
};

function escaparHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* marked interpreta algunas barras inversas de LaTeX como escapes de Markdown.
   Se protegen las fórmulas antes de convertir Markdown y se restauran en el
   HTML para que KaTeX las reciba sin alteraciones. */
/* ## → 1, ### → 1.1, #### → 1.1.1… Los niveles omitidos se
   completan con 1 y los contadores inferiores se reinician. */
function siguienteNumero(contadores, nivel) {
  const indice = nivel - 2;
  while (contadores.length < indice) contadores.push(1);
  contadores[indice] = (contadores[indice] || 0) + 1;
  contadores.length = indice + 1;
  return contadores.join(".");
}

function renderarEncabezado(textoHTML, nivel, numero) {
  return '<h' + nivel + '><span class="heading__number">' + numero
    + '</span> ' + textoHTML + '</h' + nivel + '>';
}

function renderarMarkdownConLatex(md, enLinea, numeracion) {
  const formulas = [];
  const protegido = String(md).replace(
    /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\n$]+\$/g,
    function (formula) {
      const id = formulas.length;
      formulas.push(formula);
      return "@@LATEX_" + id + "@@";
    }
  );
  const opciones = {};
  if (!enLinea && numeracion) {
    const renderer = new marked.Renderer();
    renderer.heading = function (texto, nivel) {
      if (nivel < 2) return '<h' + nivel + '>' + texto + '</h' + nivel + '>\n';
      return renderarEncabezado(texto, nivel, siguienteNumero(numeracion, nivel)) + "\n";
    };
    opciones.renderer = renderer;
  }
  const html = enLinea ? marked.parseInline(protegido) : marked.parse(protegido, opciones);
  return html.replace(/@@LATEX_(\d+)@@/g, function (_, id) {
    return formulas[Number(id)];
  });
}

/* Convierte un bloque ::: en el HTML correspondiente.
   match: resultado de /^:::\s*([^\s:]+)(?:\s+(.*))?\s*$/ */
/* Convierte duraciones sencillas a segundos: 5 min, 90 s o 1:30.
   Un número sin unidad se interpreta como minutos. */
function parsearDuracionTemporizador(texto) {
  const valor = String(texto || "").trim().toLowerCase();
  let match = valor.match(/^(\d+):(\d{1,2})$/);
  if (match && Number(match[2]) < 60) return Number(match[1]) * 60 + Number(match[2]);

  match = valor.match(/^(\d+)\s*(?:min(?:uto)?s?|m)?$/);
  if (match) return Number(match[1]) * 60;

  match = valor.match(/^(\d+)\s*(?:s|seg(?:undo)?s?)$/);
  if (match) return Number(match[1]);

  return 0;
}

function formatearDuracion(segundos) {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return minutos + ":" + String(resto).padStart(2, "0");
}

function renderarTemporizador(especificacion, inner) {
  const segundos = parsearDuracionTemporizador(especificacion);
  if (!segundos || segundos > 35999) {
    return '<div class="box"><p class="box__title">Temporizador</p>'
      + '<p>Indica una duración, por ejemplo: <code>::: temporizador 3 min</code>.</p></div>';
  }

  const etiqueta = inner.trim()
    ? renderarMarkdownConLatex(inner.trim(), true)
    : "Tiempo para la actividad";
  const duracion = formatearDuracion(segundos);
  return '<div class="timer" data-timer-seconds="' + segundos + '" data-timer-duration="' + duracion + '" role="group"'
    + ' aria-label="Temporizador de ' + escaparHTML(duracion) + '">\n'
    + '  <div class="timer__dial" aria-hidden="true"><span class="timer__display">' + duracion + '</span></div>\n'
    + '  <div class="timer__body">\n'
    + '    <p class="timer__eyebrow">Tiempo restante</p>\n'
    + '    <div class="timer__label">' + etiqueta + '</div>\n'
    + '    <div class="timer__controls">\n'
    + '      <button class="timer__button timer__button--start" type="button" data-timer-action="start">Iniciar</button>\n'
    + '      <button class="timer__button" type="button" data-timer-action="pause">Pausar</button>\n'
    + '      <button class="timer__button timer__button--reset" type="button" data-timer-action="reset">Reiniciar</button>\n'
    + '    </div>\n'
    + '    <output class="timer__announcement" aria-live="polite"></output>\n'
    + '  </div>\n'
    + '</div>';
}

/* Numeración automática de los entornos ::: actividades de cada capítulo. */
let numeroActividades = 0;

/* Entorno de actividades: caja propia, numerada y capaz de contener
   otros bloques ::: (por ejemplo, el temporizador). */
function renderarActividades(titulo, contenido) {
  numeroActividades += 1;
  const nombre = titulo || "Actividades";
  return '<div class="box box--actividades" data-actividad="' + numeroActividades + '"'
    + ' aria-label="Actividades ' + numeroActividades + '">\n'
    + '  <p class="box__title box__title--actividades">'
    + '<span class="box__numero" aria-hidden="true">' + numeroActividades + "</span>"
    + "<span>" + renderarMarkdownConLatex(nombre, true) + "</span></p>\n"
    + contenido + "\n</div>";
}

function renderarContenedor(match, inner, numeracion) {
  const tipo = match[1].toLowerCase();
  const titulo = match[2] ? match[2].trim() : null;
  if (tipo === "temporizador" || tipo === "timer") {
    return renderarTemporizador(titulo, inner);
  }
  if (tipo === "actividades" || tipo === "actividad") {
    return renderarActividades(titulo, renderarBloque(inner, numeracion));
  }
  const conf = CONTENEDORES[tipo];

  // Tipo desconocido → se convierte en una cita normal
  if (!conf) {
    return inner.trim().split("\n").map(function (l) { return "> " + l; }).join("\n");
  }

  let html = '<div class="' + conf.cls + '">\n';
  const t = titulo || conf.def;
  if (t) html += '<p class="box__title">' + escaparHTML(t) + "</p>\n";

  // Los bloques de tipo math/formula se renderizan en línea (sin <p>).
  // El resto admite a su vez bloques ::: anidados.
  html += conf.def === null
    ? renderarMarkdownConLatex(inner.trim(), true)
    : renderarBloque(inner, numeracion);
  html += "\n</div>";
  return html;
}

/* Renderiza un fragmento de Markdown que puede contener bloques :::.
   Se divide en trozos y cada trozo se pasa por marked por separado,
   para que los <div> de los contenedores no se "rompan". Admite bloques
   anidados (por ejemplo, un temporizador dentro de ::: actividades). */
function renderarBloque(md, numeracion) {
  const lineas = md.split("\n");
  const fragmentos = [];
  let buffer = [];
  const volcar = function () {
    if (buffer.join("").trim()) {
      fragmentos.push(renderarMarkdownConLatex(buffer.join("\n"), false, numeracion));
    }
    buffer = [];
  };

  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i];
    const abierto = linea.match(/^:::\s*([^\s:]+)(?:\s+(.*))?\s*$/);
    if (abierto) {
      volcar();
      const inner = [];
      let profundidad = 1;
      i++;
      while (i < lineas.length && profundidad > 0) {
        const actual = lineas[i];
        if (actual.trim() === ":::") {
          profundidad--;
          if (profundidad === 0) break;
          inner.push(actual);
          i++;
        } else if (/^:::\s*[^\s:]/.test(actual)) {
          profundidad++;
          inner.push(actual);
          i++;
        } else {
          inner.push(actual);
          i++;
        }
      }
      i++; // salta el cierre ":::"
      fragmentos.push(renderarContenedor(abierto, inner.join("\n"), numeracion));
    } else {
      buffer.push(linea);
      i++;
    }
  }
  volcar();
  return fragmentos.join("\n");
}

/* Cabeceras y pies propios, sin depender de la URL/fecha del navegador.
   Las cadenas CSS se escapan también frente a un cierre de </style>. */
function cadenaCSS(texto) {
  return JSON.stringify(String(texto)).replace(/</g, "\\3c ");
}

function renderarEstilosImpresion(cap, serie, num) {
  return '<style>\n@media print {\n  @page {\n'
    + '    @top-left { content: ' + cadenaCSS(serie) + '; }\n'
    + '    @top-right { content: ' + cadenaCSS("Capítulo " + num) + '; }\n'
    + '    @bottom-left { content: ' + cadenaCSS(cap.titulo) + '; }\n'
    + '  }\n}\n</style>';
}

/* Genera la portada de un capítulo */
function renderarPortada(cap, serie, num) {
  const mat = MATERIAS[cap.materia] || { label: cap.materia, cls: "tag--mat" };
  return [
    '<header class="cover" id="portada">',
    '  <p class="cover__kicker">' + escaparHTML(serie) + " · Capítulo " + num + "</p>",
    '  <h1 class="cover__title">' + escaparHTML(cap.titulo) + "</h1>",
    '  <p class="cover__subtitle"><span class="tag ' + mat.cls + '">' + mat.label + "</span></p>",
    '  <div class="cover__meta"><span>Curso 2026 – 2027</span><span>Formación Básica</span></div>',
    "</header>",
  ].join("\n");
}

/* Convierte el Markdown de un capítulo en las secciones .slide.
   Los encabezados ## marcan las secciones principales y los ### dividen
   también el contenido en diapositivas para que no resulten demasiado largas. */
function renderarCapitulo(md, cap, serie, num) {
  numeroActividades = 0;
  const lineas = md.split("\n");
  const secciones = [];
  const contadores = [];
  let actual = null;
  let principalActual = null;
  let intro = [];
  let cerca = null;
  let profundidadBloque = 0;

  const cerrarActual = function () {
    // También se conservan los títulos sin texto propio.
    if (actual) secciones.push(actual);
  };

  lineas.forEach(function (linea) {
    const marca = linea.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    const dentroCodigo = Boolean(cerca);
    if (marca) {
      if (!cerca) cerca = marca[1];
      else if (marca[1][0] === cerca[0] && marca[1].length >= cerca.length && !marca[2].trim()) cerca = null;
    }
    const esTitulo = !dentroCodigo && !marca && profundidadBloque === 0;
    const encabezado = esTitulo && linea.match(/^(#{2,3})\s+(.*)$/);

    if (encabezado) {
      cerrarActual();
      const nivel = encabezado[1].length;
      const titulo = encabezado[2].replace(/[ \t]+#+[ \t]*$/, "").trim();
      if (nivel === 2) principalActual = { titulo: titulo, subtitulos: [] };
      actual = { titulo: titulo, principal: principalActual, nivel: nivel, cuerpo: [] };
      if (nivel === 3 && principalActual) principalActual.subtitulos.push(actual);
    } else if (!(esTitulo && /^#\s+/.test(linea))) {
      (actual ? actual.cuerpo : intro).push(linea);
    }

    if (!dentroCodigo && !marca) {
      if (/^:::\s*[^\s:]/.test(linea)) profundidadBloque++;
      else if (linea.trim() === ":::" && profundidadBloque) profundidadBloque--;
    }
  });
  cerrarActual();

  // La introducción precede al primer apartado con contenido, no a su resumen.
  if (intro.join("").trim() && secciones.length) {
    const primera = secciones.find(function (sec) { return sec.cuerpo.join("").trim(); }) || secciones[0];
    primera.cuerpo = intro.concat(primera.cuerpo);
  }

  // Numerar en orden de lectura incluye también los títulos dentro de cajas.
  // Primero se renderiza el cuerpo; después, los resúmenes pueden reutilizar
  // los números definitivos de sus subtítulos sin consumir otros contadores.
  secciones.forEach(function (sec) {
    sec.numero = siguienteNumero(contadores, sec.nivel);
    if (sec.nivel === 2) sec.principal.numero = sec.numero;
    sec.cuerpoHTML = renderarBloque(sec.cuerpo.join("\n"), contadores);
  });

  return secciones.map(function (sec, indice) {
    const principal = sec.principal;
    const esResumen = sec.nivel === 2 && !sec.cuerpo.join("").trim()
      && principal && principal.subtitulos.length;
    const clase = "slide" + (esResumen ? " slide--seccion slide--seccion--titulo-necesario" : "");
    let html = '<section class="' + clase + '" id="seccion-' + (indice + 1)
      + '" data-materia="' + escaparHTML(cap.materia)
      + '" data-seccion="' + escaparHTML(principal ? principal.titulo : sec.titulo)
      + '" data-seccion-numero="' + (principal ? principal.numero : sec.numero.split(".")[0])
      + '" data-numero="' + sec.numero + '" data-nivel="' + sec.nivel + '">\n';
    html += "  " + renderarEncabezado(renderarMarkdownConLatex(sec.titulo, true), sec.nivel, sec.numero) + "\n";
    if (esResumen) {
      html += '  <ul class="slide__indice-seccion">\n' + principal.subtitulos.map(function (sub) {
        return '    <li><span class="heading__number">' + sub.numero + '</span> '
          + renderarMarkdownConLatex(sub.titulo, true) + '</li>';
      }).join("\n") + '\n  </ul>\n';
    } else {
      html += sec.cuerpoHTML;
    }
    return html + "\n</section>\n";
  }).join("");
}

/* Genera la página índice general */
function renderarIndex(lista) {
  const totalCapitulos = lista.capitulos.length;
  const totalSecciones = lista.capitulos.reduce(function (total, cap) {
    return total + (Number(cap.secciones) || 0);
  }, 0);
  const estructura = totalCapitulos + " " + (totalCapitulos === 1 ? "capítulo" : "capítulos")
    + (totalSecciones ? " · " + totalSecciones + " " + (totalSecciones === 1 ? "sección" : "secciones") : "");
  const tarjetas = lista.capitulos.map(function (cap, idx) {
    const mat = MATERIAS[cap.materia] || { label: cap.materia, cls: "tag--mat" };
    const href = cap.archivo.replace(/\.md$/, ".html");
    return [
      '<a class="chapter-card" href="' + href + '">',
      '  <span class="tag ' + mat.cls + '">' + mat.label + "</span>",
      '  <h2><span class="heading__number">' + (idx + 1) + '</span> ' + escaparHTML(cap.titulo) + '</h2>',
      "  <p>" + escaparHTML(cap.descripcion || "") + "</p>",
      "</a>",
    ].join("\n");
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escaparHTML(lista.serie)} · Índice</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="pagina-indice">
  <header class="topbar">
    <div class="topbar__title">
      <span class="topbar__brand">${escaparHTML(lista.serie)}</span>
    </div>
    <div class="topbar__actions">
      <button class="btn btn--outline" id="btn-print" title="Imprimir o guardar como PDF">🖨️ <span class="btn__label">Imprimir / PDF</span></button>
      <!-- Solo se activa al servir la web con editor-local.js en 127.0.0.1. -->
      <a class="btn btn--outline" id="btn-editor" href="/editor" hidden title="Editar el Markdown en este ordenador">✎ <span class="btn__label">Editar Markdown</span></a>
    </div>
  </header>

  <main class="indice">
    <header class="cover indice__portada">
      <p class="cover__kicker">Formación Básica</p>
      <h1 class="cover__title">${escaparHTML(lista.serie)}</h1>
      <p class="cover__subtitle">${escaparHTML(lista.subtitulo || "")}</p>
      <div class="cover__meta"><span>${escaparHTML(lista.curso || "")}</span><span>${estructura}</span></div>
    </header>

    <nav class="chapter-grid" aria-label="Capítulos">
${tarjetas}
    </nav>
  </main>

  <script>
    document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
    if (window.__EDITOR_LOCAL__) document.getElementById("btn-editor").hidden = false;
  </script>
</body>
</html>`;
}

/* ============================ MAIN ============================ */

function main() {
  const lista = JSON.parse(fs.readFileSync(RUTA_LISTA, "utf8"));
  const plantilla = fs.readFileSync(RUTA_PLANTILLA, "utf8");

  lista.capitulos.forEach(function (cap, idx) {
    const md = fs.readFileSync(cap.archivo, "utf8");
    const contenido = renderarCapitulo(md, cap, lista.serie, idx + 1);

    const html = plantilla
      .split("{{SERIE}}").join(lista.serie)
      .split("{{TITULO}}").join(cap.titulo)
      .split("{{ESTILOS_IMPRESION}}").join(renderarEstilosImpresion(cap, lista.serie, idx + 1))
      .split("{{PORTADA}}").join(renderarPortada(cap, lista.serie, idx + 1))
      .split("{{CONTENIDO}}").join(contenido)
      .split("{{VOLVER}}").join("../index.html");

    const salida = cap.archivo.replace(/\.md$/, ".html");
    fs.writeFileSync(salida, html);
    console.log("✓ " + salida);
  });

  fs.writeFileSync("index.html", renderarIndex(lista));
  console.log("✓ index.html");
  console.log("\nListo. Abre index.html para ver el índice de capítulos.");
}

/* Permite que el editor local reutilice exactamente el mismo renderizado
   (incluidos los bloques :::) sin generar archivos ni ejecutar main(). */
module.exports = {
  renderarCapitulo: renderarCapitulo,
  renderarPortada: renderarPortada,
  renderarEstilosImpresion: renderarEstilosImpresion
};

if (require.main === module) main();
