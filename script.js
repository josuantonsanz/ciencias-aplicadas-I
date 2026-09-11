/* ============================================================
   CIENCIAS APLICADAS I · Comportamiento
   1) Índice automático con scroll-spy
   2) Menú lateral en móvil
   3) Botón Imprimir/PDF
   4) Modo diapositivas (navegación por botones, teclado y táctil)
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
      tituloSeccion.href = "#" + section.id;
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
     3) BOTÓN IMPRIMIR / PDF
     ---------------------------------------------------------- */
  document.getElementById("btn-print").addEventListener("click", function () {
    window.print();
  });

  /* ----------------------------------------------------------
     4) MODO DIAPOSITIVAS
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

    // 2) Una diapositiva por cada sección de contenido
    sections.forEach(function (section) {
      var vista = document.createElement("div");
      vista.className = "slide-view";
      vista.innerHTML = '<div class="slide-view__inner">' + section.innerHTML + "</div>";
      stage.appendChild(vista);
      vistas.push(vista);
    });

    indice = 0;
    actualizar();
  }

  function actualizar() {
    vistas.forEach(function (vista, i) {
      vista.classList.toggle("is-active", i === indice);
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
    crearVistas();
    slideshow.hidden = false;
    document.body.style.overflow = "hidden"; // bloquea el scroll de fondo
  }

  function cerrar() {
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
})();
