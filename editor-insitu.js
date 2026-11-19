/* ============================================================
   editor-insitu.js — Editor Markdown dentro de la propia página.

   Solo se carga cuando editor-local.js sirve un capítulo desde
   127.0.0.1 (inyecta __EDITOR_INSITU__, __EDITOR_ARCHIVO__ y
   __EDITOR_CSRF__). En GitHub Pages no hay sesión ni servidor con
   permiso de escritura, así que este archivo no hace nada.

   Permite editar el capítulo tal y como se ve: los párrafos, títulos,
   listas y citas se editan en su sitio; las tablas, fórmulas, bloques
   ::: y código se editan como Markdown en su hueco. El .md se guarda
   continuamente y la reconstrucción de HTML y PDF se hace a petición.
   ============================================================ */
(function () {
  "use strict";

  if (!window.__EDITOR_INSITU__ || !window.__EDITOR_ARCHIVO__ || !window.__EDITOR_CSRF__) return;

  var ARCHIVO = window.__EDITOR_ARCHIVO__;
  var CSRF = window.__EDITOR_CSRF__;

  var OPCIONES_KATEX = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false,
    strict: "warn"
  };

  var TIPOS_RICOS = { paragraph: true, encabezado: true, list: true, blockquote: true };

  var estado = {
    activo: false,
    lineas: [],
    mdGuardado: "",
    sucio: false,
    pendiente: false,
    guardando: false,
    programado: null,
    bloques: [],
    titulos: [],
    editando: null,
    fuente: null
  };

  var content = document.getElementById("content");
  var barra = null;
  var salidaEstado = null;
  var avisoPendiente = null;

  /* ----------------------------------------------------------
     Utilidades
     ---------------------------------------------------------- */
  function api(ruta, opciones) {
    opciones = opciones || {};
    opciones.headers = Object.assign({ "X-Editor-CSRF": CSRF }, opciones.headers || {});
    return fetch(ruta, opciones).then(function (respuesta) {
      return respuesta.json().then(function (datos) {
        if (!respuesta.ok) throw new Error(datos.error || "Error inesperado.");
        return datos;
      });
    });
  }

  function mensaje(texto, error) {
    if (!salidaEstado) return;
    salidaEstado.textContent = texto;
    salidaEstado.className = "editor-insitu__estado" + (error ? " is-error" : "");
  }

  function hora() {
    var ahora = new Date();
    return String(ahora.getHours()).padStart(2, "0") + ":" + String(ahora.getMinutes()).padStart(2, "0");
  }

  function escapar(texto) {
    var nodo = document.createElement("span");
    nodo.textContent = String(texto == null ? "" : texto);
    return nodo.innerHTML;
  }

  function renderMath(raiz) {
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(raiz || content, OPCIONES_KATEX);
  }

  function buscarBloque(nodo) {
    var actual = nodo;
    while (actual && actual !== content) {
      if (actual._bloque) return actual;
      actual = actual.parentNode;
    }
    return null;
  }

  /* ----------------------------------------------------------
     Conversión de HTML editado a Markdown
     ---------------------------------------------------------- */
  function texDeKatex(nodo) {
    var anotacion = nodo.querySelector('annotation[encoding="application/x-tex"]');
    return anotacion ? anotacion.textContent : nodo.textContent;
  }

  function desmontarKatex(raiz) {
    Array.prototype.slice.call(raiz.querySelectorAll(".katex-display")).forEach(function (nodo) {
      nodo.parentNode.replaceChild(document.createTextNode("$$" + texDeKatex(nodo) + "$$"), nodo);
    });
    Array.prototype.slice.call(raiz.querySelectorAll(".katex")).forEach(function (nodo) {
      nodo.parentNode.replaceChild(document.createTextNode("$" + texDeKatex(nodo) + "$"), nodo);
    });
  }

  function inlineNodo(nodo) {
    if (nodo.nodeType === 3) return nodo.nodeValue;
    if (nodo.nodeType !== 1) return "";

    var el = nodo;
    if (el.classList.contains("heading__number")) return "";
    if (el.classList.contains("katex-display")) return "$$" + texDeKatex(el) + "$$";
    if (el.classList.contains("katex")) return "$" + texDeKatex(el) + "$";

    var hijos = Array.prototype.slice.call(el.childNodes).map(inlineNodo).join("");

    switch (el.tagName) {
      case "STRONG":
      case "B": return hijos.trim() ? "**" + hijos + "**" : hijos;
      case "EM":
      case "I": return hijos.trim() ? "*" + hijos + "*" : hijos;
      case "DEL":
      case "S":
      case "STRIKE": return "~~" + hijos + "~~";
      case "CODE":
        return (hijos.indexOf("`") === -1 ? "`" : "``") + hijos + (hijos.indexOf("`") === -1 ? "`" : "``");
      case "A":
        // Si el enlace tiene atributos propios (target, rel…), se conserva el
        // HTML original para no perderlos al editar el bloque.
        if (Array.prototype.slice.call(el.attributes).some(function (atributo) { return atributo.name !== "href"; })) {
          return el.outerHTML;
        }
        return "[" + hijos + "](" + (el.getAttribute("href") || "") + ")";
      case "IMG": return "![" + (el.getAttribute("alt") || "") + "](" + (el.getAttribute("src") || "") + ")";
      case "BR": return "  \n";
      case "SUP": return "<sup>" + hijos + "</sup>";
      case "SUB": return "<sub>" + hijos + "</sub>";
      default: return hijos;
    }
  }

  function inlineMD(raiz) {
    return Array.prototype.slice.call(raiz.childNodes)
      .map(inlineNodo)
      .join("")
      .replace(/\u00a0/g, " ");
  }

  function listaAMarkdown(lista, sangria) {
    var ordenada = lista.tagName === "OL";
    var numero = Number(lista.getAttribute("start") || 1);
    var lineas = [];

    Array.prototype.slice.call(lista.children).forEach(function (li) {
      if (li.tagName !== "LI") return;
      var marcador = ordenada ? (numero++) + "." : "-";
      var prefijo = new Array(sangria + 1).join(" ") + marcador + " ";
      var anidados = [];
      var parrafos = [];
      var suelto = "";

      Array.prototype.slice.call(li.childNodes).forEach(function (nodo) {
        if (nodo.nodeType === 1 && (nodo.tagName === "UL" || nodo.tagName === "OL")) {
          anidados.push(nodo);
          return;
        }
        if (nodo.nodeType === 1 && nodo.tagName === "P") {
          if (suelto) { parrafos.push(suelto); suelto = ""; }
          parrafos.push(inlineMD(nodo));
          return;
        }
        suelto += inlineNodo(nodo);
      });
      if (suelto) parrafos.push(suelto);

      var texto = parrafos.join(" ").replace(/\s+/g, " ").trim();
      lineas.push(prefijo + texto);
      anidados.forEach(function (sub) {
        lineas.push(listaAMarkdown(sub, sangria + marcador.length + 1));
      });
    });

    return lineas.join("\n");
  }

  function citaAMarkdown(cita) {
    var partes = [];
    Array.prototype.slice.call(cita.childNodes).forEach(function (nodo) {
      if (nodo.nodeType !== 1) {
        if (nodo.nodeValue.trim()) partes.push(nodo.nodeValue.trim());
        return;
      }
      if (nodo.tagName === "UL" || nodo.tagName === "OL") partes.push(listaAMarkdown(nodo, 0));
      else if (nodo.tagName === "P") partes.push(inlineMD(nodo).trim());
      else partes.push(inlineMD(nodo).trim());
    });
    return partes.join("\n>\n").split("\n").map(function (linea) { return "> " + linea; }).join("\n");
  }

  function markdownDeBloque(el) {
    if (/^H[1-6]$/.test(el.tagName)) {
      var nivel = Number(el.tagName.charAt(1));
      return new Array(nivel + 1).join("#") + " " + inlineMD(el).trim();
    }
    if (el.tagName === "UL" || el.tagName === "OL") return listaAMarkdown(el, 0);
    if (el.tagName === "BLOCKQUOTE") return citaAMarkdown(el);
    return inlineMD(el).trim();
  }

  /* ----------------------------------------------------------
     Rangos de líneas
     ---------------------------------------------------------- */
  function todosLosBloques() {
    return estado.bloques.concat(estado.titulos);
  }

  function reemplazarRango(bloque, nuevasLineas) {
    var inicio = bloque.inicio;
    var fin = bloque.fin;
    var delta = nuevasLineas.length - (fin - inicio);
    estado.lineas.splice.apply(estado.lineas, [inicio, fin - inicio].concat(nuevasLineas));
    todosLosBloques().forEach(function (otro) {
      if (otro === bloque) return;
      if (otro.inicio >= fin) { otro.inicio += delta; otro.fin += delta; }
    });
    bloque.fin = inicio + nuevasLineas.length;
  }

  function insertarLineasEn(posicion, lineas) {
    estado.lineas.splice.apply(estado.lineas, [posicion, 0].concat(lineas));
    todosLosBloques().forEach(function (otro) {
      if (otro.inicio >= posicion) { otro.inicio += lineas.length; otro.fin += lineas.length; }
    });
  }

  function eliminarBloque(bloque) {
    var total = bloque.fin - bloque.inicio;
    estado.lineas.splice(bloque.inicio, total);
    todosLosBloques().forEach(function (otro) {
      if (otro === bloque) return;
      if (otro.inicio >= bloque.fin) { otro.inicio -= total; otro.fin -= total; }
    });
    estado.bloques = estado.bloques.filter(function (b) { return b !== bloque; });
    if (bloque.el) bloque.el.remove();
  }

  function lineasDeBloque(bloque) {
    return estado.lineas.slice(bloque.inicio, bloque.fin).join("\n").trim();
  }

  /* ----------------------------------------------------------
     Guardado continuo
     ---------------------------------------------------------- */
  function marcarSucio() {
    estado.sucio = true;
    programarGuardado();
  }

  function programarGuardado() {
    clearTimeout(estado.programado);
    estado.programado = setTimeout(function () { guardar(false); }, 1500);
  }

  function volcarEdicionActual(programar) {
    var edicion = estado.editando;
    if (!edicion) return;
    var md = markdownDeBloque(edicion.el).trim();
    if (!md || md === lineasDeBloque(edicion.bloque)) return;
    reemplazarRango(edicion.bloque, md.split("\n"));
    estado.sucio = true;
    if (programar !== false) programarGuardado();
  }

  function guardar(reconstruir) {
    volcarEdicionActual(false);
    var md = estado.lineas.join("\n");

    if (!reconstruir && md === estado.mdGuardado) {
      estado.sucio = false;
      mensaje("Sin cambios pendientes · " + hora());
      return Promise.resolve();
    }
    if (estado.guardando) {
      estado.reintentar = reconstruir;
      return Promise.resolve();
    }

    estado.guardando = true;
    mensaje(reconstruir ? "Guardando y reconstruyendo…" : "Guardando…");

    return api("/api/chapter", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivo: ARCHIVO, markdown: md, reconstruir: Boolean(reconstruir) })
    }).then(function () {
      estado.mdGuardado = md;
      estado.sucio = false;
      estado.guardando = false;
      if (reconstruir) {
        estado.pendiente = false;
        mensaje("Guardado y reconstruido · " + hora());
      } else {
        estado.pendiente = true;
        mensaje("Guardado · " + hora());
      }
      actualizarAvisoPendiente();
      if (estado.reintentar !== undefined) {
        var repetir = estado.reintentar;
        estado.reintentar = undefined;
        if (repetir) guardar(true);
      }
    }).catch(function (error) {
      estado.guardando = false;
      mensaje("No se pudo guardar: " + error.message, true);
    });
  }

  function actualizarAvisoPendiente() {
    if (!avisoPendiente) return;
    avisoPendiente.hidden = !estado.pendiente;
  }

  /* ----------------------------------------------------------
     Renderizado y alineación de bloques
     ---------------------------------------------------------- */
  function etiquetaEsperada(bloque) {
    switch (bloque.tipo) {
      case "paragraph": return "P";
      case "encabezado": return "H" + (bloque.nivel || 4);
      case "blockquote": return "BLOCKQUOTE";
      case "table": return "TABLE";
      case "code": return "PRE";
      case "titulo": return "H" + (bloque.nivel || 2);
      case "contenedor": return null;
      default: return null;
    }
  }

  function cuerpoDeSeccion(seccion) {
    var hijos = Array.prototype.slice.call(seccion.children);
    var titulo = null;
    if (hijos[0] && /^H[23]$/.test(hijos[0].tagName)) {
      titulo = hijos.shift();
    }
    var cuerpo = hijos.filter(function (nodo) {
      return !nodo.classList.contains("slide__indice-seccion");
    });
    return { titulo: titulo, cuerpo: cuerpo };
  }

  function alinearSecciones(datos) {
    var nodos = Array.prototype.slice.call(content.querySelectorAll(":scope > section.slide"));
    estado.bloques = [];
    estado.titulos = [];
    var aviso = false;

    datos.forEach(function (seccion, indice) {
      var nodo = nodos[indice];
      if (!nodo) return;
      var partes = cuerpoDeSeccion(nodo);

      if (partes.cuerpo.length !== seccion.bloques.length) {
        nodo._bloqueado = true;
        aviso = true;
        console.warn("[editor] La sección «" + seccion.titulo + "» no coincide con el Markdown y se deja sin editar.");
        return;
      }

      var bloqueTitulo = {
        tipo: "titulo", nivel: seccion.nivel, inicio: seccion.tituloInicio,
        fin: seccion.tituloFin, el: partes.titulo, seccion: indice
      };
      if (partes.titulo) partes.titulo._bloque = bloqueTitulo;
      estado.titulos.push(bloqueTitulo);

      seccion.bloques.forEach(function (bloque, k) {
        var el = partes.cuerpo[k];
        var esperada = etiquetaEsperada(bloque);
        if (esperada && el.tagName !== esperada) {
          nodo._bloqueado = true;
          aviso = true;
          return;
        }
        bloque.el = el;
        bloque.seccion = indice;
        el._bloque = bloque;
        prepararElemento(el, bloque);
        estado.bloques.push(bloque);
      });
    });

    return !aviso;
  }

  function prepararElemento(el, bloque) {
    if (TIPOS_RICOS[bloque.tipo]) el.classList.add("md-rico");
    else el.classList.add("md-fuente-activable");
  }

  function renderizarSecciones(datos) {
    if (!content) return;
    var posicion = window.scrollY;
    Array.prototype.slice.call(content.querySelectorAll(":scope > section.slide")).forEach(function (nodo) {
      nodo.remove();
    });

    var contenedor = document.createElement("div");
    contenedor.innerHTML = datos.map(function (seccion) { return seccion.html; }).join("");
    var nodos = Array.prototype.slice.call(contenedor.children);
    var pie = content.querySelector(".page-footer");
    nodos.forEach(function (nodo) { content.insertBefore(nodo, pie); });

    var correcto = alinearSecciones(datos);
    renderMath();
    if (typeof window.__reconstruirIndice === "function") window.__reconstruirIndice();
    window.scrollTo(0, posicion);
    if (!correcto) mensaje("Alguna sección no se puede editar en la página; usa el editor clásico.", true);
  }

  function resincronizar() {
    if (!estado.activo || estado.resincronizando) return Promise.resolve();
    estado.resincronizando = true;
    return api("/api/in-situ", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivo: ARCHIVO, markdown: estado.lineas.join("\n") })
    }).then(function (datos) {
      estado.resincronizando = false;
      if (!estado.activo) return;
      estado.lineas = datos.markdown.split("\n");
      renderizarSecciones(datos.secciones);
    }).catch(function (error) {
      estado.resincronizando = false;
      mensaje("No se pudo actualizar la vista: " + error.message, true);
    });
  }

  /* Comprueba que la sección sigue teniendo tantos elementos como bloques.
     Si el navegador ha dejado nodos sueltos al editar, se vuelve a renderizar
     para no perder la correspondencia con el Markdown. */
  function verificarSeccion(indice) {
    var nodo = content.querySelectorAll(":scope > section.slide")[indice];
    if (!nodo || nodo._bloqueado) return;
    var partes = cuerpoDeSeccion(nodo);
    var esperados = estado.bloques.filter(function (b) { return b.seccion === indice; }).length;
    if (partes.cuerpo.length !== esperados) resincronizar();
  }

  /* ----------------------------------------------------------
     Edición enriquecida
     ---------------------------------------------------------- */
  function colocarCursor(el, evento) {
    var seleccion = window.getSelection();
    if (!seleccion) return;
    var rango = null;
    if (evento && document.caretRangeFromPoint) {
      rango = document.caretRangeFromPoint(evento.clientX, evento.clientY);
      if (rango && !el.contains(rango.startContainer)) rango = null;
    }
    seleccion.removeAllRanges();
    if (rango) {
      seleccion.addRange(rango);
      return;
    }
    rango = document.createRange();
    rango.selectNodeContents(el);
    rango.collapse(false);
    seleccion.addRange(rango);
  }

  function marcarNumeroNoEditable(el) {
    Array.prototype.slice.call(el.querySelectorAll(".heading__number")).forEach(function (numero) {
      numero.setAttribute("contenteditable", "false");
    });
  }

  function liberarNumero(el) {
    Array.prototype.slice.call(el.querySelectorAll(".heading__number")).forEach(function (numero) {
      numero.removeAttribute("contenteditable");
    });
  }

  function activarRico(el, bloque, evento) {
    if (estado.editando) return;
    var edicion = {
      el: el,
      bloque: bloque,
      tipo: "rico",
      htmlOriginal: el.innerHTML,
      lineasOriginales: estado.lineas.slice(bloque.inicio, bloque.fin),
      estructura: false
    };
    desmontarKatex(el);
    if (/^H[2-6]$/.test(el.tagName)) marcarNumeroNoEditable(el);
    el.classList.add("is-editando");
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "true");
    estado.editando = edicion;
    el.focus();
    colocarCursor(el, evento);
  }

  function cancelarEdicion() {
    var edicion = estado.editando;
    if (!edicion) return;
    estado.editando = null;
    var el = edicion.el;
    el.removeAttribute("contenteditable");
    el.classList.remove("is-editando");
    liberarNumero(el);
    el.innerHTML = edicion.htmlOriginal;
    reemplazarRango(edicion.bloque, edicion.lineasOriginales);
    renderMath(el);
    estado.sucio = estado.lineas.join("\n") !== estado.mdGuardado;
    mensaje("Edición cancelada.");
  }

  function confirmarEdicion() {
    var edicion = estado.editando;
    if (!edicion) return;
    estado.editando = null;
    var el = edicion.el;
    el.removeAttribute("contenteditable");
    el.classList.remove("is-editando");
    liberarNumero(el);

    var md = markdownDeBloque(el).trim();
    if (md && md !== lineasDeBloque(edicion.bloque)) {
      reemplazarRango(edicion.bloque, md.split("\n"));
      marcarSucio();
      if (edicion.bloque.tipo === "titulo") actualizarTituloIndice(edicion.bloque);
    }
    renderMath(el);
    verificarSeccion(edicion.bloque.seccion);
  }

  function actualizarTituloIndice(bloque) {
    var el = bloque.el;
    if (!el) return;
    var seccion = el.closest("section.slide");
    if (!seccion) return;
    var numero = seccion.getAttribute("data-seccion-numero") || "";
    var texto = el.textContent.trim();
    var enlaces = document.querySelectorAll('#toc a[href="#' + seccion.id + '"]');
    Array.prototype.slice.call(enlaces).forEach(function (enlace) {
      enlace.textContent = el.tagName === "H2" && numero ? numero + " " + texto : texto;
    });
  }

  function caretAlPrincipio(el) {
    var seleccion = window.getSelection();
    if (!seleccion || !seleccion.rangeCount || !seleccion.isCollapsed) return false;
    var rango = seleccion.getRangeAt(0);
    var previo = rango.cloneRange();
    previo.selectNodeContents(el);
    previo.setEnd(rango.startContainer, rango.startOffset);
    return previo.toString().length === 0;
  }

  function dividirEnCaret(el) {
    var seleccion = window.getSelection();
    if (!seleccion || !seleccion.rangeCount) return null;
    var rango = seleccion.getRangeAt(0);
    var resto = document.createRange();
    try {
      resto.setStart(rango.endContainer, rango.endOffset);
      resto.setEnd(el, el.childNodes.length);
    } catch (error) {
      return null;
    }
    var nuevo = document.createElement("p");
    if (!resto.collapsed) nuevo.appendChild(resto.extractContents());
    el.parentNode.insertBefore(nuevo, el.nextSibling);
    return nuevo;
  }

  function crearBloqueDespues(el, bloque) {
    var nuevo = dividirEnCaret(el);
    if (!nuevo) return;

    var mdActual = markdownDeBloque(el).trim();
    estado.editando = null;
    el.removeAttribute("contenteditable");
    el.classList.remove("is-editando");
    liberarNumero(el);
    renderMath(el);

    reemplazarRango(bloque, mdActual ? [mdActual] : [""]);
    insertarLineasEn(bloque.fin, [""]);

    var nuevoBloque = {
      tipo: "paragraph",
      inicio: bloque.fin,
      fin: bloque.fin + 1,
      el: nuevo,
      seccion: bloque.seccion
    };
    nuevo._bloque = nuevoBloque;
    nuevo.classList.add("md-rico");
    estado.bloques.push(nuevoBloque);
    marcarSucio();
    activarRico(nuevo, nuevoBloque, null);
  }

  function borrarBloqueVacio(el, bloque) {
    var previo = null;
    estado.bloques.forEach(function (b) {
      if (b.seccion !== bloque.seccion || b === bloque) return;
      if (b.fin <= bloque.inicio && (!previo || b.inicio > previo.inicio)) previo = b;
    });
    eliminarBloque(bloque);
    estado.editando = null;
    marcarSucio();
    if (previo && previo.el) {
      activarRico(previo.el, previo, null);
      colocarCursor(previo.el, null);
    }
  }

  /* ----------------------------------------------------------
     Edición como Markdown (tablas, fórmulas, cajas y código)
     ---------------------------------------------------------- */
  function etiquetaTipo(bloque) {
    if (bloque.tipo === "contenedor") return ":::" + bloque.subtipo;
    if (bloque.tipo === "table") return "tabla";
    if (bloque.tipo === "code") return "código";
    return bloque.tipo;
  }

  function activarFuente(el, bloque) {
    if (estado.fuente) return;
    el.hidden = true;

    var caja = document.createElement("div");
    caja.className = "md-fuente";
    caja.innerHTML = '<div class="md-fuente__barra"><span>Markdown del bloque <code>'
      + escapar(etiquetaTipo(bloque)) + '</code></span><span class="md-fuente__botones">'
      + '<button type="button" data-accion="aplicar">Aplicar</button>'
      + '<button type="button" data-accion="cancelar">Cancelar</button></span></div>';
    var area = document.createElement("textarea");
    area.spellcheck = false;
    area.value = estado.lineas.slice(bloque.inicio, bloque.fin).join("\n");
    caja.appendChild(area);
    var ayuda = document.createElement("p");
    ayuda.className = "md-fuente__ayuda";
    ayuda.textContent = "Markdown y bloques ::: · Ctrl+Intro para aplicar · Esc para cancelar";
    caja.appendChild(ayuda);
    el.parentNode.insertBefore(caja, el);

    estado.fuente = { el: el, bloque: bloque, caja: caja, area: area };
    ajustarAlturaFuente(area);
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);

    caja.addEventListener("click", function (evento) {
      var boton = evento.target.closest("[data-accion]");
      if (!boton) return;
      if (boton.getAttribute("data-accion") === "aplicar") confirmarFuente();
      else cerrarFuente();
    });
    area.addEventListener("input", function () { ajustarAlturaFuente(area); });
  }

  function ajustarAlturaFuente(area) {
    var filas = area.value.split("\n").length;
    area.rows = Math.max(4, Math.min(30, filas + 1));
  }

  function cerrarFuente() {
    var fuente = estado.fuente;
    if (!fuente) return;
    estado.fuente = null;
    fuente.caja.remove();
    fuente.el.hidden = false;
  }

  function confirmarFuente() {
    var fuente = estado.fuente;
    if (!fuente) return;
    var texto = fuente.area.value.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
    estado.fuente = null;
    fuente.caja.remove();
    fuente.el.hidden = false;
    if (texto !== lineasDeBloque(fuente.bloque)) {
      reemplazarRango(fuente.bloque, texto.split("\n"));
      marcarSucio();
    }
    resincronizar();
  }

  /* ----------------------------------------------------------
     Eventos
     ---------------------------------------------------------- */
  function alPulsarTecla(evento) {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "s") {
      evento.preventDefault();
      guardar(true);
      return;
    }
    if (evento.key === "Escape") {
      if (estado.fuente) { evento.preventDefault(); cerrarFuente(); return; }
      if (estado.editando) {
        evento.preventDefault();
        if (estado.editando.estructura) confirmarEdicion();
        else cancelarEdicion();
      }
      return;
    }
    if (estado.fuente && (evento.ctrlKey || evento.metaKey) && evento.key === "Enter") {
      evento.preventDefault();
      confirmarFuente();
      return;
    }

    var edicion = estado.editando;
    if (!edicion) return;

    if ((evento.ctrlKey || evento.metaKey) && !evento.shiftKey) {
      var tecla = evento.key.toLowerCase();
      if (tecla === "b") { evento.preventDefault(); document.execCommand("bold"); return; }
      if (tecla === "i") { evento.preventDefault(); document.execCommand("italic"); return; }
      if (tecla === "k") {
        evento.preventDefault();
        var url = window.prompt("Dirección del enlace:", "https://");
        if (url) document.execCommand("createLink", false, url);
        return;
      }
    }

    if (evento.key === "Enter" && !evento.shiftKey && !evento.ctrlKey && !evento.metaKey) {
      if (edicion.bloque.tipo === "paragraph" || edicion.bloque.tipo === "titulo") {
        evento.preventDefault();
        edicion.estructura = true;
        crearBloqueDespues(edicion.el, edicion.bloque);
      }
      return;
    }

    if (evento.key === "Backspace" && edicion.bloque.tipo === "paragraph"
        && !edicion.el.textContent.trim() && caretAlPrincipio(edicion.el)) {
      evento.preventDefault();
      edicion.estructura = true;
      borrarBloqueVacio(edicion.el, edicion.bloque);
    }
  }

  function alPegar(evento) {
    if (!estado.editando) return;
    evento.preventDefault();
    var texto = (evento.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, texto);
  }

  function alEscribir() {
    if (!estado.editando) return;
    volcarEdicionActual(true);
  }

  function alPerderFoco() {
    if (estado.editando) confirmarEdicion();
  }

  function alHacerClic(evento) {
    if (!estado.activo || estado.editando || estado.fuente || estado.resincronizando) return;
    if (evento.target.closest("button, .timer, .editor-insitu")) return;

    var enlace = evento.target.closest("a[href]");
    if (enlace) { evento.preventDefault(); return; }

    var el = buscarBloque(evento.target);
    if (!el || !el._bloque) return;
    var seccion = content.querySelectorAll(":scope > section.slide")[el._bloque.seccion];
    if (seccion && seccion._bloqueado) return;

    evento.preventDefault();
    var bloque = el._bloque;
    if (bloque.tipo === "titulo" || TIPOS_RICOS[bloque.tipo]) activarRico(el, bloque, evento);
    else activarFuente(el, bloque);
  }

  /* ----------------------------------------------------------
     Barra de herramientas
     ---------------------------------------------------------- */
  function crearBarra() {
    barra = document.createElement("div");
    barra.className = "editor-insitu";
    barra.innerHTML = '<span class="editor-insitu__titulo">✎ Editando en la página</span>'
      + '<span class="editor-insitu__estado">Cargando…</span>'
      + '<span class="editor-insitu__pendiente" hidden>⚠ HTML/PDF sin reconstruir</span>'
      + '<span class="editor-insitu__acciones">'
      + '<button type="button" data-editor="guardar">Guardar Markdown</button>'
      + '<button type="button" class="is-principal" data-editor="reconstruir">Reconstruir HTML y PDF</button>'
      + '<a data-editor="clasico" href="/editor?archivo=' + encodeURIComponent(ARCHIVO) + '">Editor clásico</a>'
      + '<button type="button" data-editor="salir">Salir</button>'
      + '</span>';
    document.body.appendChild(barra);
    salidaEstado = barra.querySelector(".editor-insitu__estado");
    avisoPendiente = barra.querySelector(".editor-insitu__pendiente");

    barra.addEventListener("click", function (evento) {
      var boton = evento.target.closest("[data-editor]");
      if (!boton) return;
      var accion = boton.getAttribute("data-editor");
      if (accion === "guardar") guardar(false);
      else if (accion === "reconstruir") guardar(true);
      else if (accion === "salir") salir();
    });
  }

  function inyectarEstilos() {
    var estilos = document.createElement("style");
    estilos.textContent = [
      ".modo-insitu .editor-insitu{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:9px 16px;background:#123a59;color:#fff;font:14px/1.35 system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 -2px 10px rgba(0,0,0,.25)}",
      "body.modo-insitu{padding-bottom:70px}",
      ".modo-insitu .editor-insitu__titulo{font-weight:700}",
      ".modo-insitu .editor-insitu__estado{font-size:.86rem;opacity:.9}",
      ".modo-insitu .editor-insitu__estado.is-error{color:#ffd1cc}",
      ".modo-insitu .editor-insitu__pendiente{background:#ffbf47;color:#3a2a00;border-radius:999px;padding:2px 10px;font-size:.8rem;font-weight:700}",
      ".modo-insitu .editor-insitu__acciones{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}",
      ".modo-insitu .editor-insitu button,.modo-insitu .editor-insitu a{font:inherit;border-radius:6px;padding:.42em .7em;border:1px solid transparent;cursor:pointer;text-decoration:none;background:#fff;color:#123a59;font-weight:600}",
      ".modo-insitu .editor-insitu button.is-principal{background:#6ee7b7}",
      ".modo-insitu .editor-insitu button:focus-visible,.modo-insitu .editor-insitu a:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}",
      ".modo-insitu [hidden]{display:none !important}",
      ".modo-insitu .slide .md-rico,.modo-insitu .slide .md-fuente-activable{border-radius:4px;transition:background .12s,box-shadow .12s}",
      ".modo-insitu .slide .md-rico:hover{background:#eef7f2;box-shadow:0 0 0 2px #bfe6d5}",
      ".modo-insitu .slide .md-fuente-activable{cursor:text}",
      ".modo-insitu .slide .md-fuente-activable:hover{background:#eef3f8;box-shadow:0 0 0 2px #c3d5e5}",
      ".modo-insitu .slide [contenteditable='true']{outline:3px solid #6ee7b7;outline-offset:2px;background:#f4fffb}",
      ".modo-insitu .slide .heading__number[contenteditable='false']{opacity:.75}",
      ".modo-insitu .md-fuente{margin:14px 0;border:1px solid #9fadb9;border-radius:8px;background:#f8fafc;overflow:hidden}",
      ".modo-insitu .md-fuente__barra{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 12px;background:#e3ebf3;font-size:.86rem}",
      ".modo-insitu .md-fuente__barra code{font-family:ui-monospace,Consolas,monospace}",
      ".modo-insitu .md-fuente__botones{display:flex;gap:6px}",
      ".modo-insitu .md-fuente__botones button{font:inherit;border-radius:5px;padding:.35em .65em;border:1px solid #9fadb9;background:#fff;cursor:pointer;font-weight:600;color:#123a59}",
      ".modo-insitu .md-fuente__botones button[data-accion='aplicar']{background:#6ee7b7}",
      ".modo-insitu .md-fuente textarea{display:block;width:100%;box-sizing:border-box;border:0;border-top:1px solid #cbd6e0;border-bottom:1px solid #cbd6e0;padding:12px;font:14px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;color:#18222b;background:#fff;resize:vertical}",
      ".modo-insitu .md-fuente__ayuda{margin:0;padding:6px 12px;font-size:.8rem;color:#52606c}",
      "@media print{.editor-insitu{display:none !important}}",
      "@media print{.modo-insitu [contenteditable],.modo-insitu .md-rico,.modo-insitu .md-fuente-activable{outline:none !important;background:none !important;box-shadow:none !important}}"
    ].join("");
    document.head.appendChild(estilos);
  }

  /* ----------------------------------------------------------
     Entrar y salir
     ---------------------------------------------------------- */
  function activar() {
    if (estado.activo) return;
    estado.activo = true;
    document.body.classList.add("modo-insitu");
    crearBarra();
    inyectarEstilos();
    mensaje("Cargando el capítulo…");

    api("/api/in-situ?archivo=" + encodeURIComponent(ARCHIVO)).then(function (datos) {
      if (!estado.activo) return;
      estado.mdGuardado = datos.markdown;
      estado.lineas = datos.markdown.split("\n");
      estado.sucio = false;
      estado.pendiente = false;
      renderizarSecciones(datos.secciones);
      mensaje("Editando «" + datos.titulo + "» · los cambios se guardan solos");
    }).catch(function (error) {
      mensaje("No se pudo abrir el editor: " + error.message, true);
    });
  }

  function salir() {
    clearTimeout(estado.programado);
    if (estado.fuente) cerrarFuente();
    if (estado.editando) confirmarEdicion();
    var terminar = function () {
      estado.activo = false;
      document.body.classList.remove("modo-insitu");
      if (barra) { barra.remove(); barra = null; }
      var boton = document.getElementById("btn-editor");
      if (boton) boton.hidden = false;
      mensaje("");
    };
    if (estado.sucio) guardar(false).then(terminar);
    else terminar();
  }

  function alternar() {
    if (estado.activo) salir();
    else activar();
  }

  /* ----------------------------------------------------------
     Arranque
     ---------------------------------------------------------- */
  var botonEditor = document.getElementById("btn-editor");
  if (botonEditor) {
    botonEditor.href = "#";
    botonEditor.hidden = false;
    botonEditor.title = "Editar el texto tal y como se ve, sin salir de la página";
    var etiqueta = botonEditor.querySelector(".btn__label");
    if (etiqueta) etiqueta.textContent = "Editar página";
    botonEditor.addEventListener("click", function (evento) {
      evento.preventDefault();
      alternar();
    });
  }

  if (content) {
    content.addEventListener("click", alHacerClic);
    content.addEventListener("focusout", alPerderFoco);
    content.addEventListener("input", alEscribir);
    content.addEventListener("paste", alPegar);
  }
  document.addEventListener("keydown", alPulsarTecla);

  // API interna para depuración y pruebas manuales desde la consola.
  window.__editorInsitu = {
    activar: activar,
    salir: salir,
    guardar: guardar,
    resincronizar: resincronizar,
    convertir: markdownDeBloque,
    estado: estado
  };

  // Permite abrir un capítulo directamente en modo edición con ?editar=1.
  if (/(?:\?|&)editar=1(?:&|$)/.test(window.location.search)) activar();
  window.addEventListener("beforeunload", function (evento) {
    // Solo se avisa si queda Markdown sin guardar; la reconstrucción de HTML
    // y PDF se puede hacer después con el botón correspondiente.
    if (!estado.activo || !estado.sucio) return;
    evento.preventDefault();
    evento.returnValue = "Hay cambios sin guardar.";
  });
})();
