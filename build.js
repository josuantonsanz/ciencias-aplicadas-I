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
    .replace(/>/g, "&gt;");
}

/* marked interpreta algunas barras inversas de LaTeX como escapes de Markdown.
   Se protegen las fórmulas antes de convertir Markdown y se restauran en el
   HTML para que KaTeX las reciba sin alteraciones. */
function renderarMarkdownConLatex(md, enLinea) {
  const formulas = [];
  const protegido = String(md).replace(
    /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\n$]+\$/g,
    function (formula) {
      const id = formulas.length;
      formulas.push(formula);
      return "@@LATEX_" + id + "@@";
    }
  );
  const html = enLinea ? marked.parseInline(protegido) : marked.parse(protegido);
  return html.replace(/@@LATEX_(\d+)@@/g, function (_, id) {
    return formulas[Number(id)];
  });
}

/* Convierte un bloque ::: en el HTML correspondiente.
   match: resultado de /^:::\s*([^\s:]+)(?:\s+(.*))?\s*$/ */
function renderarContenedor(match, inner) {
  const tipo = match[1].toLowerCase();
  const titulo = match[2] ? match[2].trim() : null;
  const conf = CONTENEDORES[tipo];

  // Tipo desconocido → se convierte en una cita normal
  if (!conf) {
    return inner.trim().split("\n").map(function (l) { return "> " + l; }).join("\n");
  }

  let html = '<div class="' + conf.cls + '">\n';
  const t = titulo || conf.def;
  if (t) html += '<p class="box__title">' + escaparHTML(t) + "</p>\n";

  // Los bloques de tipo math/formula se renderizan en línea (sin <p>)
  html += renderarMarkdownConLatex(inner.trim(), conf.def === null);
  html += "\n</div>";
  return html;
}

/* Renderiza un fragmento de Markdown que puede contener bloques :::.
   Se divide en trozos y cada trozo se pasa por marked por separado,
   para que los <div> de los contenedores no se "rompan". */
function renderarBloque(md) {
  const lineas = md.split("\n");
  const fragmentos = [];
  let buffer = [];
  const volcar = function () {
    if (buffer.join("").trim()) {
      fragmentos.push(renderarMarkdownConLatex(buffer.join("\n"), false));
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
      i++;
      while (i < lineas.length && lineas[i].trim() !== ":::") {
        inner.push(lineas[i]);
        i++;
      }
      i++; // salta el cierre ":::"
      fragmentos.push(renderarContenedor(abierto, inner.join("\n")));
    } else {
      buffer.push(linea);
      i++;
    }
  }
  volcar();
  return fragmentos.join("\n");
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
  const lineas = md.split("\n");
  const secciones = [];
  const principales = [];
  let actual = null;
  let seccionPrincipal = "";
  let principalActual = null;
  let intro = [];

  const cerrarActual = function () {
    if (actual && actual.cuerpo.join("").trim()) secciones.push(actual);
  };

  lineas.forEach(function (linea) {
    const h2 = linea.match(/^##\s+(.*)$/);
    const h3 = linea.match(/^###\s+(.*)$/);
    const h1 = linea.match(/^#\s+(.*)$/);

    if (h2) {
      cerrarActual();
      seccionPrincipal = h2[1].trim();
      principalActual = { titulo: seccionPrincipal, subtitulos: [] };
      principales.push(principalActual);
      actual = {
        titulo: seccionPrincipal,
        seccion: seccionPrincipal,
        nivel: 2,
        cuerpo: []
      };
    } else if (h3) {
      cerrarActual();
      const subtitulo = h3[1].trim();
      if (principalActual) principalActual.subtitulos.push(subtitulo);
      actual = {
        titulo: subtitulo,
        seccion: seccionPrincipal,
        nivel: 3,
        cuerpo: []
      };
    } else if (h1) {
      // El título del capítulo ya viene de lista.json: se ignora
    } else if (actual) {
      actual.cuerpo.push(linea);
    } else {
      intro.push(linea);
    }
  });
  cerrarActual();

  // El texto anterior al primer encabezado se antepone a la primera diapositiva.
  if (intro.join("").trim() && secciones.length) {
    secciones[0].cuerpo = intro.concat(secciones[0].cuerpo);
  }

  const portadaSeccion = function (principal) {
    const listaSubtitulos = principal.subtitulos.map(function (subtitulo) {
      return "    <li>" + renderarMarkdownConLatex(subtitulo, true) + "</li>";
    }).join("\n");
    const tieneContenidoPropio = secciones.some(function (sec) {
      return sec.nivel === 2 && sec.seccion === principal.titulo;
    });
    const clasePortada = "slide slide--seccion"
      + (tieneContenidoPropio ? "" : " slide--seccion--titulo-necesario");

    return '<section class="' + clasePortada + '" data-materia="' + escaparHTML(cap.materia)
      + '" data-seccion="' + escaparHTML(principal.titulo) + '" data-nivel="2">\n'
      + "  <h2>" + renderarMarkdownConLatex(principal.titulo, true) + "</h2>\n"
      + "  <ul class=\"slide__indice-seccion\">\n" + listaSubtitulos + "\n  </ul>\n"
      + "</section>\n";
  };

  let html = "";
  let seccionRenderizada = "";

  secciones.forEach(function (sec) {
    if (sec.nivel === 3 && sec.seccion !== seccionRenderizada) {
      const principal = principales.find(function (item) { return item.titulo === sec.seccion; });
      if (principal) html += portadaSeccion(principal);
    }
    seccionRenderizada = sec.seccion;

    html += '<section class="slide" data-materia="' + escaparHTML(cap.materia)
      + '" data-seccion="' + escaparHTML(sec.seccion || sec.titulo)
      + '" data-nivel="' + sec.nivel + '">\n';
    html += "  <h2>" + renderarMarkdownConLatex(sec.titulo, true) + "</h2>\n";
    html += renderarBloque(sec.cuerpo.join("\n"));
    html += "\n</section>\n";
  });

  return html;
}

/* Genera la página índice general */
function renderarIndex(lista) {
  const totalCapitulos = lista.capitulos.length;
  const totalSecciones = lista.capitulos.reduce(function (total, cap) {
    return total + (Number(cap.secciones) || 0);
  }, 0);
  const estructura = totalCapitulos + " " + (totalCapitulos === 1 ? "capítulo" : "capítulos")
    + (totalSecciones ? " · " + totalSecciones + " " + (totalSecciones === 1 ? "sección" : "secciones") : "");
  const tarjetas = lista.capitulos.map(function (cap) {
    const mat = MATERIAS[cap.materia] || { label: cap.materia, cls: "tag--mat" };
    const href = cap.archivo.replace(/\.md$/, ".html");
    return [
      '<a class="chapter-card" href="' + href + '">',
      '  <span class="tag ' + mat.cls + '">' + mat.label + "</span>",
      "  <h2>" + escaparHTML(cap.titulo) + "</h2>",
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

main();
