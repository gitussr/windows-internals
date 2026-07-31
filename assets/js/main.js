/* Shared behavior for every page: icons, diagrams, syntax highlight,
   scroll-spy, mobile nav, reveal-on-scroll, and the glossary tooltip system. */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    initIcons();
    initMermaid();
    initPrism();
    initMobileNav();
    initSidebarActiveByPage();
    initScrollSpyTOC();
    initReveal();
    initTooltips();
    initDetailsAutoScroll();
  }

  function initIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function initMermaid() {
    if (!window.mermaid) return;
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      themeVariables: {
        darkMode: true,
        background: "#0b0f1d",
        primaryColor: "#152040",
        primaryTextColor: "#e8ecfb",
        primaryBorderColor: "#3b82f6",
        lineColor: "#5b7bd5",
        secondaryColor: "#1c2747",
        tertiaryColor: "#101833",
        actorBkg: "#152040",
        actorBorder: "#3b82f6",
        actorTextColor: "#e8ecfb",
        signalColor: "#8aa6ff",
        signalTextColor: "#cfd8ff",
        labelBoxBkgColor: "#152040",
        labelBoxBorderColor: "#3b82f6",
        labelTextColor: "#e8ecfb",
        loopTextColor: "#b6c0e0",
        noteBkgColor: "#241a3a",
        noteBorderColor: "#a78bfa",
        noteTextColor: "#e8ecfb",
        fontFamily: "Segoe UI, ui-sans-serif, system-ui, sans-serif",
        fontSize: "14px",
      },
      flowchart: { curve: "basis", htmlLabels: true },
      sequence: { actorMargin: 60, boxMargin: 10, messageMargin: 34, mirrorActors: false },
    });

    var diagrams = initDiagramZoomWrappers();
    window.mermaid
      .run({ querySelector: ".mermaid" })
      .then(function () {
        diagrams.forEach(function (d) { d.fit(true); });
      })
      .catch(function (err) {
        if (window.console) console.error("Mermaid render failed:", err);
      });
  }

  // Wraps every .diagram-frame's .mermaid element in a pannable/zoomable
  // viewport with on-screen controls, wheel-zoom, drag-to-pan, and pinch-zoom.
  // Must run BEFORE mermaid.run() so the .mermaid nodes it renders into are
  // already reparented (reparenting an existing node doesn't break mermaid's
  // reference to it).
  function initDiagramZoomWrappers() {
    var frames = Array.prototype.slice.call(document.querySelectorAll(".diagram-frame"));
    var instances = [];

    frames.forEach(function (frame) {
      var mermaidEl = frame.querySelector(".mermaid");
      if (!mermaidEl) return;

      var viewport = document.createElement("div");
      viewport.className = "diagram-zoom-viewport";
      mermaidEl.parentNode.insertBefore(viewport, mermaidEl);
      viewport.appendChild(mermaidEl);

      var toolbar = document.createElement("div");
      toolbar.className = "diagram-toolbar";
      toolbar.innerHTML =
        '<button type="button" data-zoom="out" aria-label="Zoom out">−</button>' +
        '<button type="button" data-zoom="reset" aria-label="Reset zoom" title="Reset zoom">◎</button>' +
        '<button type="button" data-zoom="in" aria-label="Zoom in">+</button>';
      frame.appendChild(toolbar);

      var hint = document.createElement("div");
      hint.className = "diagram-zoom-hint";
      hint.textContent = "Scroll/pinch to zoom · drag to pan";
      frame.appendChild(hint);

      var state = { scale: 1, minScale: 0.3, maxScale: 5, panX: 0, panY: 0, userMoved: false };

      function apply() {
        mermaidEl.style.transform =
          "translate(" + state.panX + "px," + state.panY + "px) scale(" + state.scale + ")";
      }

      function setScale(next, originX, originY) {
        next = Math.min(state.maxScale, Math.max(state.minScale, next));
        if (originX !== undefined && state.scale > 0) {
          var ratio = next / state.scale;
          state.panX = originX - (originX - state.panX) * ratio;
          state.panY = originY - (originY - state.panY) * ratio;
        }
        state.scale = next;
        state.userMoved = true;
        apply();
      }

      function fit(recenter) {
        var svg = mermaidEl.querySelector("svg");
        if (!svg) return;

        var vb = svg.viewBox && svg.viewBox.baseVal;
        var svgW = (vb && vb.width) || parseFloat(svg.getAttribute("width")) || svg.getBoundingClientRect().width || 800;
        var svgH = (vb && vb.height) || parseFloat(svg.getAttribute("height")) || svg.getBoundingClientRect().height || 400;

        svg.removeAttribute("height");
        svg.style.maxWidth = "none";
        svg.style.width = svgW + "px";
        svg.style.height = svgH + "px";

        var vpWidth = viewport.clientWidth || frame.clientWidth || 300;
        var fitScale = svgW > 0 ? Math.min(1, vpWidth / svgW) : 1;

        state.minScale = Math.min(fitScale, 0.3);
        state.maxScale = Math.max(5, fitScale * 6);

        var targetHeight = Math.min(svgH * fitScale, Math.max(220, window.innerHeight * 0.62));
        viewport.style.height = Math.max(160, targetHeight) + "px";

        if (recenter || !state.userMoved) {
          state.scale = fitScale;
          var vpHeight = viewport.clientHeight;
          state.panX = Math.max(0, (vpWidth - svgW * fitScale) / 2);
          state.panY = Math.max(0, (vpHeight - svgH * fitScale) / 2);
          state.userMoved = false;
        }
        apply();
      }

      toolbar.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-zoom]");
        if (!btn) return;
        var cx = viewport.clientWidth / 2;
        var cy = viewport.clientHeight / 2;
        var action = btn.getAttribute("data-zoom");
        if (action === "in") setScale(state.scale * 1.3, cx, cy);
        else if (action === "out") setScale(state.scale / 1.3, cx, cy);
        else fit(true);
      });

      viewport.addEventListener(
        "wheel",
        function (e) {
          e.preventDefault();
          var rect = viewport.getBoundingClientRect();
          setScale(state.scale * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX - rect.left, e.clientY - rect.top);
        },
        { passive: false }
      );

      var dragging = false, startX = 0, startY = 0, startPanX = 0, startPanY = 0;
      viewport.addEventListener("mousedown", function (e) {
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startPanX = state.panX; startPanY = state.panY;
        viewport.classList.add("grabbing");
      });
      window.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        state.panX = startPanX + (e.clientX - startX);
        state.panY = startPanY + (e.clientY - startY);
        state.userMoved = true;
        apply();
      });
      window.addEventListener("mouseup", function () {
        dragging = false;
        viewport.classList.remove("grabbing");
      });
      viewport.addEventListener("dblclick", function () { fit(true); });

      var pinchStartDist = 0, pinchStartScale = 1;
      function touchDist(t) {
        var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }
      viewport.addEventListener(
        "touchstart",
        function (e) {
          if (e.touches.length === 1) {
            dragging = true;
            startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            startPanX = state.panX; startPanY = state.panY;
          } else if (e.touches.length === 2) {
            dragging = false;
            pinchStartDist = touchDist(e.touches);
            pinchStartScale = state.scale;
          }
        },
        { passive: true }
      );
      viewport.addEventListener(
        "touchmove",
        function (e) {
          if (e.touches.length === 1 && dragging) {
            state.panX = startPanX + (e.touches[0].clientX - startX);
            state.panY = startPanY + (e.touches[0].clientY - startY);
            state.userMoved = true;
            apply();
          } else if (e.touches.length === 2 && pinchStartDist) {
            var d = touchDist(e.touches);
            setScale(pinchStartScale * (d / pinchStartDist), viewport.clientWidth / 2, viewport.clientHeight / 2);
          }
          e.preventDefault();
        },
        { passive: false }
      );
      viewport.addEventListener("touchend", function (e) {
        if (e.touches.length === 0) dragging = false;
      });

      instances.push({ fit: fit });
    });

    if (instances.length) {
      var resizeTimer;
      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          instances.forEach(function (d) { d.fit(false); });
        }, 150);
      });
    }

    return instances;
  }

  function initPrism() {
    if (window.Prism && typeof window.Prism.highlightAll === "function") {
      window.Prism.highlightAll();
    }
  }

  function initMobileNav() {
    var btn = document.getElementById("mobile-nav-toggle");
    var panel = document.getElementById("mobile-nav-panel");
    if (!btn || !panel) return;

    // Inner pages ship an empty panel and rely on the desktop sidebar's
    // nav links (hidden below lg:) as the single source of truth.
    if (!panel.children.length) {
      var sourceNav = document.querySelector(".desktop-sidebar nav");
      if (sourceNav) panel.innerHTML = sourceNav.innerHTML;
    }

    btn.addEventListener("click", function () {
      var isOpen = panel.classList.toggle("flex");
      panel.classList.toggle("hidden");
      btn.setAttribute("aria-expanded", String(isOpen));
    });
    panel.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        panel.classList.add("hidden");
        panel.classList.remove("flex");
      });
    });
  }

  // Highlights the current page's entry in the sticky sidebar nav
  function initSidebarActiveByPage() {
    var page = document.body.getAttribute("data-page");
    if (!page) return;
    document.querySelectorAll("[data-nav]").forEach(function (link) {
      if (link.getAttribute("data-nav") === page) {
        link.classList.add("active");
      }
    });
  }

  // Highlights the in-page table-of-contents entry matching the section in view
  function initScrollSpyTOC() {
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-link"));
    if (!tocLinks.length) return;
    var sections = tocLinks
      .map(function (link) {
        var id = (link.getAttribute("href") || "").replace("#", "");
        return document.getElementById(id);
      })
      .filter(Boolean);
    if (!sections.length) return;

    var byId = {};
    tocLinks.forEach(function (l) { byId[l.getAttribute("href").replace("#", "")] = l; });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = byId[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            tocLinks.forEach(function (l) { l.classList.remove("active"); });
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { observer.observe(s); });
  }

  function initReveal() {
    var targets = document.querySelectorAll(".reveal, .reveal-scale");
    if (!targets.length) return;
    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach(function (t) { observer.observe(t); });
  }

  // Glossary tooltip system: <span class="term" data-term="KEY">KEY</span>
  function initTooltips() {
    var pop = document.getElementById("tooltip-pop");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "tooltip-pop";
      document.body.appendChild(pop);
    }
    var glossary = window.GLOSSARY || {};

    document.querySelectorAll(".term[data-term]").forEach(function (el) {
      var key = el.getAttribute("data-term");
      var text = glossary[key];
      if (!text) return;

      el.addEventListener("mouseenter", function (e) { showTip(el, key, text); });
      el.addEventListener("focus", function () { showTip(el, key, text); });
      el.addEventListener("mouseleave", hideTip);
      el.addEventListener("blur", hideTip);
      el.addEventListener("mousemove", function (e) { positionTip(e.clientX, e.clientY); });
    });

    function showTip(el, key, text) {
      pop.innerHTML = "<b>" + key + "</b><br>" + text;
      var rect = el.getBoundingClientRect();
      positionTip(rect.left + rect.width / 2, rect.top);
      pop.classList.add("show");
    }
    function positionTip(x, y) {
      var w = 300, pad = 14;
      var left = Math.min(Math.max(pad, x - w / 2), window.innerWidth - w - pad);
      var top = y - 12;
      pop.style.left = left + "px";
      pop.style.top = Math.max(pad, top - 70) + "px";
    }
    function hideTip() { pop.classList.remove("show"); }
  }

  // Smooth-scroll a <details> Q&A item into view when opened
  function initDetailsAutoScroll() {
    document.querySelectorAll("details.qa-item").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) {
          setTimeout(function () {
            var rect = d.getBoundingClientRect();
            if (rect.top < 80) {
              window.scrollBy({ top: rect.top - 96, behavior: "smooth" });
            }
          }, 60);
        }
      });
    });
  }
})();
