/* ============================================================
   CIENCIAS APLICADAS I · Comportamiento
   1) Índice automático con scroll-spy
   2) Menú lateral en móvil
   3) Botón Imprimir/PDF
   4) Temporizadores de actividades (cuenta atrás y aviso sonoro)
   5) Modo diapositivas (navegación por botones, teclado y táctil)
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     1) ÍNDICE AUTOMÁTICO
     ---------------------------------------------------------- */
  var tocList = document.getElementById("toc");
  var sections = Array.prototype.slice.call(document.querySelectorAll(".slide"));

  // Asigna un id automático a las secciones que no lo tengan
  sections.forEach(function (section, i) {
    if (!section.id) section.id = "seccion-" + (i + 1);
  });

  var MATERIAS = {
    ciencias:     "Ciencias aplicadas",
    matematicas: "Matemáticas",
    biologia:    "Biología",
    fisica:      "Física",
    quimica:     "Química",
    actividades: "Repaso"
  };

  var materiaActual = null;
  var seccionActual = null;
  var sublistaActual = null;

  sections.forEach(function (section) {
    var heading = section.querySelector("h2");
    if (!heading) return;

    var materia = section.getAttribute("data-materia") || "";
    var seccion = section.getAttribute("data-seccion") || "";
    var textoTitulo = heading.textContent.trim();

    // Añade separador de materia cuando cambia
    if (materia && materia !== materiaActual) {
      materiaActual = materia;
      seccionActual = null;
      var cabecera = document.createElement("li");
      cabecera.className = "toc__materia";
      cabecera.textContent = MATERIAS[materia] || materia;
      tocList.appendChild(cabecera);
    }

    // Los encabezados ## forman el primer nivel del índice; las
    // diapositivas creadas desde ### se añaden dentro de esa sección.
    if (seccion && seccion !== seccionActual) {
      seccionActual = seccion;
      var grupo = document.createElement("li");
      grupo.className = "toc__seccion";

      var tituloSeccion = document.createElement("a");
      tituloSeccion.className = "toc__seccion-titulo";

      // Las portadas-resumen solo se muestran en el visor de diapositivas.
      // En la lectura normal, el título del índice enlaza al primer apartado
      // visible de la sección en vez de al resumen oculto.
      var destino = section;
      if (section.classList.contains("slide--seccion")
          && !section.classList.contains("slide--seccion--titulo-necesario")) {
        var posicion = sections.indexOf(section);
        destino = sections.slice(posicion + 1).find(function (candidata) {
          return candidata.getAttribute("data-seccion") === seccion
            && !candidata.classList.contains("slide--seccion");
        }) || section;
      }
      tituloSeccion.href = "#" + destino.id;
      tituloSeccion.textContent = seccion;
      grupo.appendChild(tituloSeccion);

      sublistaActual = document.createElement("ol");
      sublistaActual.className = "toc__sublista";
      grupo.appendChild(sublistaActual);
      tocList.appendChild(grupo);
    }

    // La diapositiva de sección ya está enlazada en su encabezado de grupo.
    if (section.getAttribute("data-nivel") === "2") return;

    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#" + section.id;
    a.textContent = textoTitulo;
    li.appendChild(a);
    (sublistaActual || tocList).appendChild(li);
  });

  /* Scroll-spy: resalta la sección visible */
  var enlacesToc = Array.prototype.slice.call(tocList.querySelectorAll("a"));

  function resaltarIndice() {
    var posicion = window.scrollY + 110;
    var activo = null;

    sections.forEach(function (section) {
      if (section.offsetTop <= posicion) activo = section.id;
    });

    enlacesToc.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("href") === "#" + activo);
    });
  }

  window.addEventListener("scroll", resaltarIndice, { passive: true });
  resaltarIndice();

  /* ----------------------------------------------------------
     2) MENÚ LATERAL EN MÓVIL
     ---------------------------------------------------------- */
  var sidebar = document.getElementById("sidebar");
  var btnMenu = document.getElementById("btn-menu");

  btnMenu.addEventListener("click", function () {
    sidebar.classList.toggle("is-open");
  });

  // Cerrar el menú al pulsar un enlace (en móvil)
  enlacesToc.forEach(function (a) {
    a.addEventListener("click", function () {
      sidebar.classList.remove("is-open");
    });
  });

  /* ----------------------------------------------------------
     3) IMPRESIÓN Y ACCESO AL EDITOR LOCAL
     El servidor editor-local.js inserta __EDITOR_LOCAL__ únicamente en
     respuestas de 127.0.0.1. En GitHub Pages el enlace permanece oculto
     y, sobre todo, no existe ningún servidor con permiso de escritura.
     ---------------------------------------------------------- */
  document.getElementById("btn-print").addEventListener("click", function () {
    window.print();
  });

  var btnEditor = document.getElementById("btn-editor");
  if (btnEditor && window.__EDITOR_LOCAL__) {
    var archivoMarkdown = window.location.pathname.replace(/\.html$/, ".md").replace(/^\//, "");
    btnEditor.href = "/editor?archivo=" + encodeURIComponent(archivoMarkdown);
    btnEditor.hidden = false;
  }

  /* ----------------------------------------------------------
     4) TEMPORIZADORES DE ACTIVIDADES
     El sonido se genera con Web Audio: no requiere ningún archivo y
     solo se activa al pulsar «Iniciar», respetando el navegador.
     ---------------------------------------------------------- */
  var contextoAudio = null;

  function formatearTiempo(segundos) {
    var minutos = Math.floor(segundos / 60);
    var resto = segundos % 60;
    return minutos + ":" + String(resto).padStart(2, "0");
  }

  function emitirAviso(final) {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      if (!contextoAudio) contextoAudio = new AudioContext();
      if (contextoAudio.state === "suspended") contextoAudio.resume();

      var oscilador = contextoAudio.createOscillator();
      var ganancia = contextoAudio.createGain();
      oscilador.type = "sine";
      oscilador.frequency.value = final ? 1046 : 784;
      ganancia.gain.setValueAtTime(.0001, contextoAudio.currentTime);
      ganancia.gain.exponentialRampToValueAtTime(.07, contextoAudio.currentTime + .01);
      ganancia.gain.exponentialRampToValueAtTime(.0001, contextoAudio.currentTime + (final ? .24 : .09));
      oscilador.connect(ganancia);
      ganancia.connect(contextoAudio.destination);
      oscilador.start();
      oscilador.stop(contextoAudio.currentTime + (final ? .25 : .1));
    } catch (error) {
      // Si el dispositivo o el navegador no permite audio, la cuenta atrás sigue funcionando.
    }
  }

  function pintarTemporizador(timer, estado, mensaje) {
    var restante = estado.restante;
    var pantalla = timer.querySelector(".timer__display");
    var inicio = timer.querySelector('[data-timer-action="start"]');
    var anuncio = timer.querySelector(".timer__announcement");

    pantalla.textContent = formatearTiempo(restante);
    timer.style.setProperty("--timer-progress", (restante / estado.total * 100) + "%");
    timer.classList.toggle("is-ending", restante > 0 && restante <= 5);
    timer.classList.toggle("is-finished", restante === 0);
    inicio.disabled = estado.enMarcha;
    inicio.textContent = estado.enMarcha ? "En marcha" : (restante === 0 ? "Iniciar de nuevo" : (restante < estado.total ? "Reanudar" : "Iniciar"));
    if (mensaje !== undefined) anuncio.textContent = mensaje;
  }

  function pausarTemporizador(timer, silencioso) {
    var estado = timer._timerState;
    if (!estado || !estado.enMarcha) return;
    estado.restante = Math.max(0, Math.ceil((estado.terminaEn - Date.now()) / 1000));
    clearInterval(estado.intervalo);
    estado.enMarcha = false;
    pintarTemporizador(timer, estado, silencioso ? undefined : "Temporizador en pausa.");
  }

  function terminarTemporizador(timer) {
    var estado = timer._timerState;
    clearInterval(estado.intervalo);
    estado.restante = 0;
    estado.enMarcha = false;
    pintarTemporizador(timer, estado, "¡Tiempo terminado!");
    emitirAviso(true);
  }

  function iniciarTemporizador(timer) {
    var estado = timer._timerState;
    if (!estado || estado.enMarcha) return;
    if (estado.restante === 0) estado.restante = estado.total;

    estado.enMarcha = true;
    estado.terminaEn = Date.now() + estado.restante * 1000;
    estado.ultimoAviso = null;
    pintarTemporizador(timer, estado, "");

    // Si se inicia directamente con cinco segundos o menos, también se avisa.
    if (estado.restante <= 5) {
      estado.ultimoAviso = estado.restante;
      emitirAviso(false);
    }

    estado.intervalo = setInterval(function () {
      var nuevoRestante = Math.max(0, Math.ceil((estado.terminaEn - Date.now()) / 1000));
      if (nuevoRestante === estado.restante) return;

      estado.restante = nuevoRestante;
      if (nuevoRestante === 0) {
        terminarTemporizador(timer);
        return;
      }
      if (nuevoRestante <= 5 && estado.ultimoAviso !== nuevoRestante) {
        estado.ultimoAviso = nuevoRestante;
        emitirAviso(false);
      }
      pintarTemporizador(timer, estado);
    }, 200);
  }

  function reiniciarTemporizador(timer) {
    var estado = timer._timerState;
    if (!estado) return;
    clearInterval(estado.intervalo);
    estado.restante = estado.total;
    estado.enMarcha = false;
    estado.ultimoAviso = null;
    pintarTemporizador(timer, estado, "");
  }

  function inicializarTemporizadores(contenedor) {
    Array.prototype.slice.call(contenedor.querySelectorAll(".timer")).forEach(function (timer) {
      if (timer._timerState) return;
      var total = Number(timer.getAttribute("data-timer-seconds"));
      if (!total) return;
      timer._timerState = { total: total, restante: total, enMarcha: false, intervalo: null, terminaEn: 0, ultimoAviso: null };
      pintarTemporizador(timer, timer._timerState, "");
    });
  }

  function pausarTemporizadores(contenedor) {
    Array.prototype.slice.call(contenedor.querySelectorAll(".timer")).forEach(function (timer) {
      pausarTemporizador(timer, true);
    });
  }

  document.addEventListener("click", function (evento) {
    var boton = evento.target.closest("[data-timer-action]");
    if (!boton) return;
    var timer = boton.closest(".timer");
    if (!timer || !timer._timerState) return;

    var accion = boton.getAttribute("data-timer-action");
    if (accion === "start") iniciarTemporizador(timer);
    if (accion === "pause") pausarTemporizador(timer);
    if (accion === "reset") reiniciarTemporizador(timer);
  });

  inicializarTemporizadores(document);

  /* ----------------------------------------------------------
     5) MODO DIAPOSITIVAS
     ---------------------------------------------------------- */
  var slideshow   = document.getElementById("slideshow");
  var stage       = document.getElementById("slides-stage");
  var barra       = document.getElementById("slides-bar");
  var contador    = document.getElementById("slides-counter");
  var btnSlides   = document.getElementById("btn-slides");
  var btnCerrar   = document.getElementById("slides-close");
  var btnPrev     = document.getElementById("slides-prev");
  var btnNext     = document.getElementById("slides-next");

  var vistas = [];      // elementos .slide-view
  var indice = 0;

  /* Una sección conserva contenido propio si, además del título, tiene texto,
     listas, tablas, imágenes o cajas. */
  function tieneContenidoPropio(nodo) {
    var elementos = nodo.querySelectorAll("p, ul, ol, table, img, svg, figure, blockquote, pre, .math, .box");
    return Array.prototype.some.call(elementos, function (elemento) {
      if (elemento.textContent.trim()) return true;
      var multimedia = elemento.matches("img, svg")
        ? elemento
        : elemento.querySelector("img, svg, .katex");
      return Boolean(multimedia);
    });
  }

  /* Convierte una caja de actividades en una diapositiva a pantalla completa:
     el texto ocupa todo el espacio y el temporizador queda abajo a la derecha. */
  function crearVistaActividades(caja, contexto) {
    var contenido = caja.cloneNode(true);
    var temporizadores = Array.prototype.slice.call(contenido.querySelectorAll(".timer"));
    temporizadores.forEach(function (temporizador) {
      temporizador.parentNode.removeChild(temporizador);
    });

    var html = "";
    if (contexto) html += '<p class="actividades__contexto">' + contexto + "</p>";
    html += '<div class="' + contenido.className + '">' + contenido.innerHTML + "</div>";
    temporizadores.forEach(function (temporizador) {
      html += temporizador.outerHTML;
    });

    var vista = document.createElement("div");
    vista.className = "slide-view slide-view--actividades";
    vista.innerHTML = '<div class="slide-view__inner slide-view__inner--actividades">'
      + html + "</div>";
    return vista;
  }

  /* Agranda la letra del entorno de actividades todo lo que quepa en pantalla
     (búsqueda binaria del tamaño máximo que no desborda la caja). */
  function ajustarActividad(vista) {
    if (!vista || !vista.classList.contains("slide-view--actividades")) return;
    var caja = vista.querySelector(".box--actividades");
    if (!caja) return;

    caja.style.fontSize = "";
    if (!caja.clientHeight) return;

    // El límite superior crece con la pantalla para aprovecharla al máximo
    // sin que un ejercicio corto quede desproporcionado.
    var maximo = Math.max(80, Math.min(200, vista.clientHeight / 4));
    var minimo = 13, mejor = minimo;
    for (var paso = 0; paso < 15; paso++) {
      var prueba = (minimo + maximo) / 2;
      caja.style.fontSize = prueba + "px";
      if (caja.scrollHeight <= caja.clientHeight + 1) {
        mejor = prueba;
        minimo = prueba;
      } else {
        maximo = prueba;
      }
    }
    caja.style.fontSize = Math.max(13, Math.floor(mejor)) + "px";
  }

  /* Hace lo mismo con el resto de diapositivas: agranda la letra hasta llenar
     la pantalla. Si el contenido es muy largo, se queda en un tamaño legible
     y la diapositiva se puede desplazar hacia abajo. */
  function ajustarDiapositiva(vista) {
    if (!vista
        || vista.classList.contains("slide-view--actividades")
        || vista.classList.contains("slide-view--cover")) return;
    var inner = vista.querySelector(".slide-view__inner");
    if (!inner) return;

    inner.style.fontSize = "";
    if (!inner.clientHeight) return;

    var maximo = Math.max(26, Math.min(110, vista.clientHeight / 6));
    var minimo = 15, mejor = minimo;
    for (var paso = 0; paso < 14; paso++) {
      var prueba = (minimo + maximo) / 2;
      inner.style.fontSize = prueba + "px";
      if (inner.scrollHeight <= inner.clientHeight + 1) {
        mejor = prueba;
        minimo = prueba;
      } else {
        maximo = prueba;
      }
    }
    inner.style.fontSize = Math.max(15, Math.floor(mejor)) + "px";
  }

  function crearVistas() {
    stage.innerHTML = "";
    vistas = [];

    // 1) Diapositiva de portada: clona la portada real de la página
    var portada = document.querySelector(".cover");
    if (portada) {
      var vistaPortada = document.createElement("div");
      vistaPortada.className = "slide-view slide-view--cover";
      vistaPortada.innerHTML = '<div class="slide-view__inner">' + portada.innerHTML + "</div>";
      stage.appendChild(vistaPortada);
      vistas.push(vistaPortada);
    }

    // 2) Una diapositiva por sección. Los entornos de actividades se extraen
    //    y se muestran ampliados en su propia diapositiva.
    sections.forEach(function (section) {
      var clon = document.createElement("div");
      clon.innerHTML = section.innerHTML;

      var cajas = Array.prototype.slice.call(clon.querySelectorAll(".box--actividades"));
      var encabezado = clon.querySelector("h2");
      var contexto = encabezado ? encabezado.innerHTML : "";

      cajas.forEach(function (caja) { caja.parentNode.removeChild(caja); });

      if (!cajas.length || tieneContenidoPropio(clon)) {
        var vista = document.createElement("div");
        vista.className = "slide-view";
        vista.innerHTML = '<div class="slide-view__inner">' + clon.innerHTML + "</div>";
        stage.appendChild(vista);
        vistas.push(vista);
      }

      cajas.forEach(function (caja) {
        var vistaActividad = crearVistaActividades(caja, contexto);
        stage.appendChild(vistaActividad);
        vistas.push(vistaActividad);
      });
    });

    inicializarTemporizadores(stage);
    indice = 0;
    actualizar();
  }

  function actualizar() {
    vistas.forEach(function (vista, i) {
      var activa = i === indice;
      vista.classList.toggle("is-active", activa);
      if (activa) {
        ajustarActividad(vista);
        ajustarDiapositiva(vista);
      }
    });
    contador.textContent = (indice + 1) + " / " + vistas.length;
    barra.style.width = ((indice + 1) / vistas.length * 100) + "%";
  }

  function irA(n) {
    if (n < 0) n = 0;
    if (n > vistas.length - 1) n = vistas.length - 1;
    indice = n;
    actualizar();
  }

  function siguiente() { irA(indice + 1); }
  function anterior()  { irA(indice - 1); }

  function abrir() {
    slideshow.hidden = false;
    document.body.style.overflow = "hidden"; // bloquea el scroll de fondo
    crearVistas();
  }

  function cerrar() {
    pausarTemporizadores(slideshow);
    slideshow.hidden = true;
    document.body.style.overflow = "";
  }

  /* Eventos de botones */
  btnSlides.addEventListener("click", abrir);
  btnCerrar.addEventListener("click", cerrar);
  btnNext.addEventListener("click", siguiente);
  btnPrev.addEventListener("click", anterior);

  /* Teclado: ← → espacio y Esc */
  document.addEventListener("keydown", function (e) {
    if (slideshow.hidden) return;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault();
        siguiente();
        break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        anterior();
        break;
      case "Home":
        e.preventDefault();
        irA(0);
        break;
      case "End":
        e.preventDefault();
        irA(vistas.length - 1);
        break;
      case "Escape":
        cerrar();
        break;
    }
  });

  /* Navegación táctil (deslizar en horizontal; el vertical hace scroll) */
  var inicioX = 0, inicioY = 0;
  stage.addEventListener("touchstart", function (e) {
    inicioX = e.changedTouches[0].clientX;
    inicioY = e.changedTouches[0].clientY;
  }, { passive: true });

  stage.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - inicioX;
    var dy = e.changedTouches[0].clientY - inicioY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? siguiente() : anterior();
    }
  }, { passive: true });

  /* Al cambiar el tamaño de la ventana se vuelve a calcular el tamaño de letra
     de la diapositiva que se está proyectando. */
  window.addEventListener("resize", function () {
    if (slideshow.hidden) return;
    ajustarActividad(vistas[indice]);
    ajustarDiapositiva(vistas[indice]);
  });
})();
