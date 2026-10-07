(function () {
  "use strict";

  /* Links from the old one-page version (#writing, #blog-…) still land somewhere. */
  (function legacy() {
    if (location.pathname !== "/" && location.pathname !== "/index.html") return;
    var h = location.hash.replace(/^#/, "");
    var map = { projects: "/projects/", writing: "/blog/", cv: "/cv/" };
    if (map[h]) location.replace(map[h]);
    else if (h.indexOf("blog-") === 0) location.replace("/blog/" + h.slice(5) + "/");
    else if (h.indexOf("p=") === 0) location.replace("/projects/#" + h);
  })();

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------------------------------------------------------- mobile nav */
  var navToggle = document.querySelector(".nav__toggle");
  var nav = document.getElementById("primary-nav");
  function setNav(open) {
    if (!nav) return;
    nav.setAttribute("data-open", String(open));
    navToggle.setAttribute("aria-expanded", String(open));
  }
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      setNav(nav.getAttribute("data-open") !== "true");
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setNav(false); });
    window.addEventListener("resize", function () { if (window.innerWidth >= 900) setNav(false); });
  }

  /* ------------------------------------------------------------ reveals */
  function revealAll() {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
    window.setTimeout(revealAll, 2500);
  }

  /* ------------------------------------------- project modal (projects page) */
  var modal = document.getElementById("project-modal");
  if (!modal) return;

  var elTitle = modal.querySelector("[data-slot='title']");
  var elLede = modal.querySelector("[data-slot='lede']");
  var elKickers = modal.querySelector("[data-slot='kickers']");
  var elBody = modal.querySelector("[data-slot='body']");
  var elActions = modal.querySelector("[data-slot='actions']");
  var elNext = modal.querySelector("[data-slot='next']");

  var svg = {
    external: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5"></path><path d="M19 5l-8 8"></path><path d="M18 14v5H5V6h5"></path></svg>',
    code: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 8l-4 4 4 4"></path><path d="M15 8l4 4-4 4"></path></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"></path><path d="M12 5l7 7-7 7"></path></svg>'
  };

  function makeLink(href, label, kind, icon) {
    var a = document.createElement("a");
    a.className = "btn btn--sm " + kind;
    a.href = href;
    if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    a.innerHTML = icon + "<span>" + label + "</span>";
    return a;
  }

  function fillModal(tpl) {
    var d = tpl.dataset;
    elTitle.textContent = d.title || "";
    elLede.textContent = d.lede || "";

    elKickers.innerHTML = "";
    [d.kicker, d.role].filter(Boolean).forEach(function (text, i) {
      if (i > 0) {
        var dot = document.createElement("span");
        dot.className = "dot";
        elKickers.appendChild(dot);
      }
      var span = document.createElement("span");
      span.className = "mono";
      span.textContent = text;
      elKickers.appendChild(span);
    });
    if (d.status) {
      var badge = document.createElement("span");
      badge.className = "badge " + (d.status.toLowerCase() === "live" ? "badge--live" : "badge--writeup");
      badge.textContent = d.status;
      elKickers.appendChild(badge);
    }

    elBody.innerHTML = "";
    elBody.appendChild(tpl.content.cloneNode(true));
    elBody.scrollTop = 0;

    elActions.innerHTML = "";
    if (d.live) elActions.appendChild(makeLink(d.live, d.liveLabel || "Open live", "btn--primary", svg.external));
    if (d.source) elActions.appendChild(makeLink(d.source, "Source", "btn--ghost", svg.code));

    if (d.next) {
      elNext.hidden = false;
      elNext.href = "#p=" + d.next;
      elNext.innerHTML = "<span>Next: " + (d.nextLabel || "") + "</span>" + svg.arrow;
    } else {
      elNext.hidden = true;
    }
  }

  function openModal(slug) {
    var tpl = document.getElementById("detail-" + slug);
    if (!tpl) return false;
    fillModal(tpl);
    if (!modal.open) {
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
    }
    document.body.classList.add("is-locked");
    modal.querySelector(".modal__close").focus();
    return true;
  }

  function closeModal() {
    if (modal.open && typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
    document.body.classList.remove("is-locked");
  }

  function clearHash() {
    if (location.hash.indexOf("#p=") === 0) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  modal.addEventListener("close", function () {
    document.body.classList.remove("is-locked");
    clearHash();
  });
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

  function route() {
    var hash = location.hash.replace(/^#/, "");
    if (hash.indexOf("p=") === 0) {
      if (!openModal(hash.slice(2))) clearHash();
      return;
    }
    if (modal.open) closeModal();
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-open-project]");
    if (trigger) {
      e.preventDefault();
      location.hash = "p=" + trigger.getAttribute("data-open-project");
      return;
    }
    if (e.target.closest("[data-close-modal]")) { e.preventDefault(); closeModal(); }
  });

  window.addEventListener("hashchange", route);
  route();
})();
