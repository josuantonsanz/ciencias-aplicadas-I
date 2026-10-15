#!/usr/bin/env node
/* ============================================================
   pdf.js — Genera los PDF de los capítulos con Chrome/Edge en
   modo headless, para que el resultado no dependa del diálogo
   de impresión ni de los encabezados propios del navegador.

   No requiere instalar nada: reutiliza el Chrome o el Edge que
   ya tengas. Si no se encuentra ninguno, build.js continúa y
   solo genera el HTML.
   ============================================================ */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

/* Rutas habituales del navegador según el sistema operativo. */
const CANDIDATOS = {
  win32: [
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["LOCALAPPDATA"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft/Edge/Application/msedge.exe"),
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
  ],
};

/* Devuelve la ruta de Chrome/Edge disponible, o null si no hay ninguno.
   Se puede forzar con la variable de entorno CHROME_PATH. */
function detectarNavegador() {
  const explicito = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicito && fs.existsSync(explicito)) return explicito;
  const rutas = CANDIDATOS[process.platform] || [];
  return rutas.find(function (ruta) { return ruta && fs.existsSync(ruta); }) || null;
}

/* Convierte una ruta local en una URL file:// válida para Chrome. */
function urlArchivo(ruta) {
  const absoluta = path.resolve(ruta).replace(/\\/g, "/");
  return encodeURI("file:///" + absoluta.replace(/^\/+/, ""));
}

/* Genera un PDF a partir de un HTML ya construido.
   El navegador no añade su propio encabezado ni su pie: los del
   material vienen de las cajas @page de styles.css. */
function generarPDF(html, salida, navegador, perfil) {
  const destino = path.resolve(salida);
  if (fs.existsSync(destino)) fs.unlinkSync(destino);

  const argumentos = [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--disable-extensions",
    "--disable-sync",
    "--no-pdf-header-footer",
    "--virtual-time-budget=6000",
    "--user-data-dir=" + perfil,
    "--print-to-pdf=" + destino,
    urlArchivo(html),
  ];

  try {
    execFileSync(navegador, argumentos, { stdio: "ignore", timeout: 120000 });
  } catch (error) {
    throw new Error("El navegador no pudo generar " + path.basename(salida) + ": " + error.message);
  }

  if (!fs.existsSync(destino) || fs.statSync(destino).size === 0) {
    throw new Error("No se generó " + salida);
  }
  return destino;
}

/* Genera un PDF por capítulo a partir de su HTML.
   capitulos: [{ archivo: "capitulos/xx.md", ... }] */
function generarPDFs(capitulos, navegador) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "ciencias-pdf-"));
  const generados = [];
  try {
    capitulos.forEach(function (cap) {
      const html = cap.archivo.replace(/\.md$/, ".html");
      if (!fs.existsSync(html)) return;
      const pdf = cap.archivo.replace(/\.md$/, ".pdf");
      generarPDF(html, pdf, navegador, perfil);
      generados.push(pdf);
      console.log("✓ " + pdf);
    });
  } finally {
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (error) { /* perfil temporal */ }
  }
  return generados;
}

module.exports = {
  detectarNavegador: detectarNavegador,
  generarPDF: generarPDF,
  generarPDFs: generarPDFs,
  urlArchivo: urlArchivo,
};

if (require.main === module) {
  const navegador = detectarNavegador();
  if (!navegador) {
    console.error("No se encontró Chrome ni Edge. Define CHROME_PATH o ejecuta node build.js --sin-pdf.");
    process.exit(1);
  }
  const lista = JSON.parse(fs.readFileSync("capitulos/lista.json", "utf8"));
  generarPDFs(lista.capitulos, navegador);
}
