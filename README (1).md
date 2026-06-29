/* =========================================================
   Entre mar, vino y atardeceres — app logic
   Vanilla JS, no dependencies.
   ========================================================= */
(() => {
  "use strict";

  const STORE_KEY = "emva.state.v1";
  const PIN_HASH = "056cc3e4b91ffa46435bb981d0d98c329222ca41cf12825a533797330a9cc56e"; // SHA-256 of the master PIN

  /* ---------- State ---------- */
  let data = null;          // itinerary.json
  let plans = [];           // plan list
  let state = null;         // persisted state
  let current = 0;          // index of visible card
  let adminAuthed = false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Persistence ---------- */
  function defaultState() {
    return {
      unlocked: {},          // { planId: true }
      completed: {},         // { planId: true }
      current: 0,
      tasting: {},           // { wineIndex: { voter: stars } }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return defaultState();
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { /* storage may be unavailable */ }
  }

  function isUnlocked(i) {
    if (i === 0) return true; // first plan always unlocked
    return !!state.unlocked[plans[i].id];
  }
  function setUnlocked(i, val) {
    if (i === 0) { return; } // first stays unlocked
    if (val) state.unlocked[plans[i].id] = true;
    else delete state.unlocked[plans[i].id];
    saveState();
  }

  /* ---------- Init ---------- */
  async function init() {
    try {
      const res = await fetch("itinerary.json", { cache: "no-cache" });
      data = await res.json();
    } catch (e) {
      console.error("No se pudo cargar el itinerario", e);
      return;
    }
    plans = data.plans || [];
    state = loadState();
    current = Math.min(Math.max(state.current | 0, 0), plans.length - 1);

    setupBackground();
    setupCover();
    renderDeck();
    buildDots();
    setupNav();
    setupSwipe();
    setupAdmin();
    setupKeyboard();
    registerSW();
  }

  /* =========================================================
     BACKGROUND — canvas coastal animation w/ fallbacks
     ========================================================= */
  function setupBackground() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = $("#bgCanvas");
    const video = $("#bgVideo");

    if (reduce) {
      canvas.classList.add("is-hidden");
      return; // CSS shows static fallback
    }

    // Try a local video first; fall back to canvas if it can't play.
    const videoSrc = "assets/video/coast.mp4";
    let usingVideo = false;
    const probe = document.createElement("video");
    probe.muted = true;
    probe.addEventListener("loadeddata", () => {
      usingVideo = true;
      video.src = videoSrc;
      video.classList.add("is-active");
      canvas.classList.add("is-hidden");
      video.play().catch(() => {});
    });
    probe.addEventListener("error", () => { if (!usingVideo) startCanvas(canvas); });
    probe.src = videoSrc;
    // If probe stalls (no file), kick off canvas quickly.
    setTimeout(() => { if (!usingVideo) startCanvas(canvas); }, 350);
  }

  function startCanvas(canvas) {
    if (canvas.dataset.running) return;
    canvas.dataset.running = "1";
    const ctx = canvas.getContext("2d");
    let w, h, dpr;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = Math.floor(innerWidth * dpr);
      h = canvas.height = Math.floor(innerHeight * dpr);
    }
    resize();
    addEventListener("resize", resize, { passive: true });

    // Precompute wave layers
    const layers = [
      { y: 0.62, amp: 0.018, len: 0.9, speed: 0.00018, col: "#15414d", alpha: 0.9 },
      { y: 0.70, amp: 0.024, len: 1.3, speed: 0.00026, col: "#102f39", alpha: 0.92 },
      { y: 0.80, amp: 0.030, len: 1.7, speed: 0.00034, col: "#0c2630", alpha: 0.95 },
    ];

    function draw(t) {
      // Sky / sunset gradient
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const pulse = (Math.sin(t * 0.00007) + 1) / 2; // slow light variation
      g.addColorStop(0, "#0e2730");
      g.addColorStop(0.32, lerpColor("#1d4a57", "#27566180", pulse));
      g.addColorStop(0.5, lerpColor("#c79a5a", "#d8b074", pulse));
      g.addColorStop(0.56, "#9c7a52");
      g.addColorStop(0.62, "#2b5560");
      g.addColorStop(1, "#0b2129");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Sun glow
      const sunY = h * (0.5 + Math.sin(t * 0.00005) * 0.01);
      const rg = ctx.createRadialGradient(w * 0.5, sunY, 0, w * 0.5, sunY, h * 0.35);
      rg.addColorStop(0, `rgba(245, 220, 170, ${0.35 + pulse * 0.12})`);
      rg.addColorStop(1, "rgba(245, 220, 170, 0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);

      // Water layers
      layers.forEach((L) => {
        ctx.beginPath();
        ctx.moveTo(0, h);
        const baseY = h * L.y;
        for (let x = 0; x <= w; x += 8 * dpr) {
          const k = (x / w) * Math.PI * 2 * L.len;
          const y = baseY + Math.sin(k + t * L.speed) * (h * L.amp)
                          + Math.sin(k * 2.3 + t * L.speed * 1.7) * (h * L.amp * 0.4);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.globalAlpha = L.alpha;
        ctx.fillStyle = L.col;
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Shimmer on the water near the sun reflection
      ctx.save();
      ctx.globalAlpha = 0.10 + pulse * 0.05;
      ctx.fillStyle = "#f5dcaa";
      for (let i = 0; i < 22; i++) {
        const rx = w * 0.5 + Math.sin(i * 12.9 + t * 0.0002) * w * 0.12;
        const ry = h * (0.58 + i * 0.012);
        const rw = (Math.sin(i * 3.3 + t * 0.0003) * 0.5 + 0.5) * 40 * dpr;
        ctx.fillRect(rx - rw / 2, ry, rw, 1.5 * dpr);
      }
      ctx.restore();

      // Drifting mist
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#f3ece0";
      for (let i = 0; i < 3; i++) {
        const mx = ((t * 0.012 * (i + 1)) % (w + 400 * dpr)) - 200 * dpr;
        const my = h * (0.5 + i * 0.06);
        const rg2 = ctx.createRadialGradient(mx, my, 0, mx, my, 260 * dpr);
        rg2.addColorStop(0, "rgba(243,236,224,0.5)");
        rg2.addColorStop(1, "rgba(243,236,224,0)");
        ctx.fillStyle = rg2;
        ctx.fillRect(mx - 260 * dpr, my - 120 * dpr, 520 * dpr, 240 * dpr);
      }
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }

    let raf = requestAnimationFrame(draw);

    // Pause when tab hidden (perf)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(draw);
    });
  }

  function lerpColor(a, b, t) {
    // Accept #rrggbb or #rrggbbaa; ignore alpha for simplicity
    const pa = hex(a), pb = hex(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hex(c) {
    const s = c.replace("#", "");
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }

  /* =========================================================
     COVER
     ========================================================= */
  function setupCover() {
    const cover = $("#cover");
    const main = $("#main");
    $("#startBtn").addEventListener("click", () => {
      cover.classList.add("is-leaving");
      main.classList.remove("hidden");
      setTimeout(() => {
        cover.classList.add("hidden");
        main.focus();
      }, 700);
      goTo(current, false);
    });
    $("#homeBtn").addEventListener("click", () => {
      main.classList.add("hidden");
      cover.classList.remove("hidden", "is-leaving");
    });
  }

  /* =========================================================
     DECK / CARDS
     ========================================================= */
  function renderDeck() {
    const deck = $("#deck");
    deck.innerHTML = "";
    plans.forEach((plan, i) => {
      deck.appendChild(buildCard(plan, i));
    });
    goTo(current, false);
  }

  function buildCard(plan, i) {
    const unlocked = isUnlocked(i);
    const card = document.createElement("article");
    card.className = "card" + (unlocked ? "" : " card--locked");
    card.dataset.index = i;
    card.setAttribute("role", "group");
    card.setAttribute("aria-roledescription", "capítulo");
    card.setAttribute("aria-label", unlocked ? plan.title : "Capítulo bloqueado");

    if (unlocked) buildUnlocked(card, plan, i);
    else buildLocked(card, i);

    return card;
  }

  function buildUnlocked(card, plan, i) {
    const media = document.createElement("div");
    media.className = "card__media";
    media.appendChild(makeScene(plan));
    // Real image (lazy) layered on top of the generated scene if it loads.
    if (plan.image) {
      const img = document.createElement("img");
      img.className = "card__img";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.style.opacity = "0";
      img.style.transition = "opacity .5s ease";
      img.addEventListener("load", () => { img.style.opacity = "1"; });
      img.addEventListener("error", () => { img.remove(); });
      img.src = plan.image;
      media.appendChild(img);
    }
    const grad = document.createElement("div");
    grad.className = "card__media-grad";
    media.appendChild(grad);

    const tag = document.createElement("span");
    tag.className = "card__daytag";
    tag.textContent = plan.day;
    media.appendChild(tag);
    card.appendChild(media);

    const body = document.createElement("div");
    body.className = "card__body";
    body.innerHTML = `
      <p class="card__chapter">Capítulo ${i + 1} · ${plans.length}</p>
      <h2 class="card__title"></h2>
      <p class="card__desc"></p>
    `;
    body.querySelector(".card__title").textContent = plan.title;
    body.querySelector(".card__desc").textContent = plan.description || "";

    if (plan.location) {
      const a = document.createElement("a");
      a.className = "card__location";
      a.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(plan.location);
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg><span></span>`;
      a.querySelector("span").textContent = plan.location;
      body.appendChild(a);
    }

    if (plan.type === "tasting") {
      body.appendChild(buildTasting());
    }

    const actions = document.createElement("div");
    actions.className = "card__actions";

    // Unlock-next button when applicable
    const next = i + 1;
    if (next < plans.length && !isUnlocked(next)) {
      const btn = document.createElement("button");
      btn.className = "btn btn--primary btn--block";
      btn.textContent = "Desbloquear siguiente plan";
      btn.addEventListener("click", () => unlockNext(i, btn));
      actions.appendChild(btn);
    } else if (state.completed[plan.id]) {
      const done = document.createElement("span");
      done.className = "card__completed";
      done.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m9.5 16.2-3.7-3.7L4.4 14l5.1 5 9-9-1.4-1.4z"/></svg> Capítulo vivido`;
      actions.appendChild(done);
    }
    body.appendChild(actions);
    card.appendChild(body);
  }

  function buildLocked(card, i) {
    const media = document.createElement("div");
    media.className = "card__media";
    media.innerHTML = `
      <div class="locked__mist"></div>
      <div class="locked__veil">
        <div class="locked__icon">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5m3 8H9V6a3 3 0 0 1 6 0z"/></svg>
        </div>
      </div>`;
    card.appendChild(media);

    const body = document.createElement("div");
    body.className = "card__body";
    body.innerHTML = `
      <p class="card__chapter">Capítulo ${i + 1} · ${plans.length}</p>
      <h2 class="card__title">Sorpresa pendiente</h2>
      <p class="card__desc">Este capítulo todavía está cerrado. Desbloquea el plan anterior para continuar.</p>
    `;

    const actions = document.createElement("div");
    actions.className = "card__actions";
    // Allow unlocking from the locked card only if the previous one is unlocked.
    if (isUnlocked(i - 1)) {
      const btn = document.createElement("button");
      btn.className = "btn btn--primary btn--block";
      btn.textContent = "Abrir este capítulo";
      btn.addEventListener("click", () => unlockNext(i - 1, btn));
      actions.appendChild(btn);
    } else {
      const hint = document.createElement("p");
      hint.className = "ranking__pending";
      hint.textContent = "Desbloquea los capítulos anteriores para llegar aquí.";
      actions.appendChild(hint);
    }
    body.appendChild(actions);
    card.appendChild(body);
  }

  // Generated SVG scene used as elegant fallback / base layer
  function makeScene(plan) {
    const palettes = {
      road:     ["#1d4a57", "#143742", "#c9a25b"],
      table:    ["#3a6e78", "#1d4a57", "#d8bd87"],
      hotel:    ["#244e57", "#143742", "#7ba292"],
      beach:    ["#3a6e78", "#5b8f8a", "#e9dcc6"],
      sunset:   ["#c9824a", "#9c5a52", "#2b5560"],
      night:    ["#0f2a33", "#143742", "#4f6e78"],
      morning:  ["#5b8f8a", "#7ba292", "#e9dcc6"],
      town:     ["#4f7c6f", "#1d4a57", "#d8bd87"],
      drink:    ["#3a6e78", "#244e57", "#c9a25b"],
      icecream: ["#7ba292", "#5b8f8a", "#f3ead8"],
      wine:     ["#6e3a4a", "#3a2530", "#c9a25b"],
      music:    ["#1d3a47", "#0f2a33", "#c9a25b"],
      default:  ["#1d4a57", "#143742", "#7ba292"],
    };
    const p = palettes[plan.scene] || palettes.default;
    const div = document.createElement("div");
    div.className = "card__scene";
    div.style.background =
      `radial-gradient(120% 90% at 30% 18%, ${p[2]}55, transparent 55%),` +
      `linear-gradient(160deg, ${p[0]}, ${p[1]})`;
    return div;
  }

  /* ---------- Navigation ---------- */
  function goTo(i, animate = true) {
    i = Math.max(0, Math.min(i, plans.length - 1));
    const cards = $$(".card", $("#deck"));
    cards.forEach((c, idx) => {
      c.classList.toggle("is-active", idx === i);
      c.classList.toggle("is-prev", idx < i);
      c.setAttribute("aria-hidden", idx === i ? "false" : "true");
    });
    current = i;
    state.current = i;
    saveState();
    updateProgress();
    updateDots();
    // mark unlocked plans as completed when viewed
    const plan = plans[i];
    if (isUnlocked(i) && !state.completed[plan.id]) {
      state.completed[plan.id] = true;
      saveState();
    }
  }

  function updateProgress() {
    const pct = ((current + 1) / plans.length) * 100;
    $("#progressFill").style.width = pct + "%";
    $("#progressLabel").textContent = `Capítulo ${current + 1} de ${plans.length}`;
    $("#prevBtn").disabled = current === 0;
    $("#nextBtn").disabled = current === plans.length - 1;
  }

  function buildDots() {
    const dots = $("#dots");
    dots.innerHTML = "";
    plans.forEach((_, i) => {
      const d = document.createElement("span");
      d.className = "dot";
      dots.appendChild(d);
    });
    updateDots();
  }
  function updateDots() {
    $$(".dot", $("#dots")).forEach((d, i) => {
      d.classList.toggle("is-active", i === current);
      d.classList.toggle("is-unlocked", isUnlocked(i) && i !== current);
    });
  }

  function setupNav() {
    $("#prevBtn").addEventListener("click", () => goTo(current - 1));
    $("#nextBtn").addEventListener("click", () => goTo(current + 1));
  }

  /* ---------- Swipe ---------- */
  function setupSwipe() {
    const deck = $("#deck");
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, decided = false, horizontal = false;

    deck.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = dy = 0; dragging = true; decided = false; horizontal = false;
    }, { passive: true });

    deck.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
      if (!decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy);
        if (horizontal) deck.classList.add("is-dragging");
      }
      if (horizontal) {
        e.preventDefault();
        const active = $(".card.is-active", deck);
        if (active) {
          const resist = (current === 0 && dx > 0) || (current === plans.length - 1 && dx < 0) ? 0.35 : 1;
          active.style.transform = `translateX(${dx * resist}px)`;
          active.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.4));
        }
      }
    }, { passive: false });

    function end() {
      if (!dragging) return;
      dragging = false;
      deck.classList.remove("is-dragging");
      const active = $(".card.is-active", deck);
      if (active) { active.style.transform = ""; active.style.opacity = ""; }
      if (horizontal && Math.abs(dx) > 60) {
        if (dx < 0) goTo(current + 1);
        else goTo(current - 1);
      }
    }
    deck.addEventListener("touchend", end);
    deck.addEventListener("touchcancel", end);
  }

  /* ---------- Keyboard ---------- */
  function setupKeyboard() {
    document.addEventListener("keydown", (e) => {
      if ($("#main").classList.contains("hidden")) return;
      if (anyModalOpen()) return;
      if (e.key === "ArrowRight") goTo(current + 1);
      else if (e.key === "ArrowLeft") goTo(current - 1);
    });
  }

  /* ---------- Unlock ---------- */
  function unlockNext(fromIndex, btn) {
    const target = fromIndex + 1;
    if (target >= plans.length) return;
    if (!isUnlocked(fromIndex)) return; // safety
    setUnlocked(target, true);
    if (btn) btn.disabled = true;
    flourish();
    toast("Nuevo capítulo desbloqueado", true);
    refreshCard(fromIndex);
    refreshCard(target);
    updateDots();
    setTimeout(() => goTo(target), 480);
  }

  function refreshCard(i) {
    const deck = $("#deck");
    const old = $(`.card[data-index="${i}"]`, deck);
    if (!old) return;
    const fresh = buildCard(plans[i], i);
    if (old.classList.contains("is-active")) fresh.classList.add("is-active");
    if (old.classList.contains("is-prev")) fresh.classList.add("is-prev");
    fresh.setAttribute("aria-hidden", old.getAttribute("aria-hidden") || "true");
    old.replaceWith(fresh);
  }

  function flourish() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const f = document.createElement("div");
    f.className = "flourish";
    f.innerHTML = '<div class="flourish__ring"></div>';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 950);
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, gold = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("toast--gold", gold);
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), 2600);
  }

  /* =========================================================
     TASTING
     ========================================================= */
  function buildTasting() {
    const wines = data.tasting.wines;
    const voters = data.tasting.voters;
    const wrap = document.createElement("div");
    wrap.className = "tasting";

    const intro = document.createElement("p");
    intro.className = "tasting__intro";
    intro.textContent = "Cada uno puntúa los cuatro vinos de 1 a 5 estrellas. Elige quién vota y toca las estrellas.";
    wrap.appendChild(intro);

    // Voter selector
    const sel = document.createElement("div");
    sel.className = "tasting__voters";
    sel.setAttribute("role", "tablist");
    sel.setAttribute("aria-label", "Quién puntúa");
    let activeVoter = voters[0];
    voters.forEach((v) => {
      const b = document.createElement("button");
      b.className = "tasting__voter" + (v === activeVoter ? " is-active" : "");
      b.textContent = v;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", v === activeVoter ? "true" : "false");
      b.addEventListener("click", () => {
        activeVoter = v;
        $$(".tasting__voter", sel).forEach((x) => {
          const on = x.textContent === v;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderStars();
      });
      sel.appendChild(b);
    });
    wrap.appendChild(sel);

    const winesWrap = document.createElement("div");
    winesWrap.style.display = "flex";
    winesWrap.style.flexDirection = "column";
    winesWrap.style.gap = "12px";
    wrap.appendChild(winesWrap);

    const ranking = document.createElement("div");
    wrap.appendChild(ranking);

    function getScore(wi, voter) {
      return (state.tasting[wi] && state.tasting[wi][voter]) || 0;
    }
    function setScore(wi, voter, val) {
      if (!state.tasting[wi]) state.tasting[wi] = {};
      state.tasting[wi][voter] = val;
      saveState();
      renderStars();
      renderRanking();
    }
    function avg(wi) {
      const s = state.tasting[wi] || {};
      const vals = voters.map((v) => s[v]).filter((x) => x > 0);
      if (vals.length < voters.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    function renderStars() {
      winesWrap.innerHTML = "";
      wines.forEach((name, wi) => {
        const a = avg(wi);
        const win = document.createElement("div");
        win.className = "wine";
        win.dataset.wi = wi;

        const top = document.createElement("div");
        top.className = "wine__top";
        const nameEl = document.createElement("span");
        nameEl.className = "wine__name";
        nameEl.textContent = name;
        const avgEl = document.createElement("span");
        avgEl.className = "wine__avg";
        avgEl.innerHTML = a !== null
          ? `Media <b>${a.toFixed(1)}</b>`
          : "Pendiente de completar";
        top.appendChild(nameEl);
        top.appendChild(avgEl);
        win.appendChild(top);

        const stars = document.createElement("div");
        stars.className = "stars";
        stars.setAttribute("role", "group");
        stars.setAttribute("aria-label", `${name} — puntuación de ${activeVoter}`);
        const myScore = getScore(wi, activeVoter);
        for (let s = 1; s <= 5; s++) {
          const star = document.createElement("button");
          star.className = "star" + (s <= myScore ? " is-on" : "");
          star.setAttribute("aria-label", `${s} de 5 estrellas`);
          star.setAttribute("aria-pressed", s <= myScore ? "true" : "false");
          star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="currentColor" stroke-width="1" d="m12 2 2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>';
          star.addEventListener("click", () => setScore(wi, activeVoter, s));
          stars.appendChild(star);
        }
        win.appendChild(stars);
        winesWrap.appendChild(win);
      });
      highlightWinner();
    }

    function highlightWinner() {
      const order = rankedWines();
      $$(".wine", winesWrap).forEach((el) => el.classList.remove("wine--winner"));
      if (order && order.complete && order.list.length) {
        const topScore = order.list[0].avg;
        order.list.forEach((r) => {
          if (Math.abs(r.avg - topScore) < 1e-9) {
            const el = winesWrap.querySelector(`.wine[data-wi="${r.wi}"]`);
            if (el) {
              el.classList.add("wine--winner");
              if (!el.querySelector(".wine__crown")) {
                const crown = document.createElement("span");
                crown.className = "wine__crown";
                crown.setAttribute("aria-hidden", "true");
                crown.innerHTML = ' <svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle"><path fill="currentColor" d="M3 7l4 4 5-6 5 6 4-4v10H3z"/></svg>';
                el.querySelector(".wine__name").appendChild(crown);
              }
            }
          }
        });
      }
    }

    function rankedWines() {
      const list = wines.map((name, wi) => ({ wi, name, avg: avg(wi) }));
      const complete = list.every((x) => x.avg !== null);
      const ranked = list.filter((x) => x.avg !== null).sort((a, b) => b.avg - a.avg);
      return { complete, list: ranked, all: list };
    }

    function renderRanking() {
      const r = rankedWines();
      ranking.innerHTML = "";
      if (!r.complete) {
        const box = document.createElement("div");
        box.className = "ranking";
        const done = r.all.filter((x) => x.avg !== null).length;
        box.innerHTML = `<h3 class="ranking__title">Clasificación</h3>
          <p class="ranking__pending">Pendiente de completar · ${done} de ${wines.length} vinos con todos los votos</p>`;
        ranking.appendChild(box);
        highlightWinner();
        return;
      }
      const box = document.createElement("div");
      box.className = "ranking";
      box.innerHTML = `<h3 class="ranking__title">Clasificación final</h3>`;
      // dense ranking with ties
      let pos = 0, prev = null, shown = 0;
      const topScore = r.list[0].avg;
      const winners = r.list.filter((x) => Math.abs(x.avg - topScore) < 1e-9);
      r.list.forEach((row) => {
        shown++;
        if (prev === null || Math.abs(row.avg - prev) > 1e-9) { pos = shown; }
        prev = row.avg;
        const isWin = Math.abs(row.avg - topScore) < 1e-9;
        const el = document.createElement("div");
        el.className = "ranking__row" + (isWin ? " ranking__row--win" : "");
        el.innerHTML = `
          <span class="ranking__pos">${pos}º</span>
          <span class="ranking__name"></span>
          <span class="ranking__score">${row.avg.toFixed(1)} ★</span>`;
        el.querySelector(".ranking__name").textContent = row.name;
        box.appendChild(el);
      });
      if (winners.length > 1) {
        const tie = document.createElement("p");
        tie.className = "ranking__tie";
        tie.textContent = `Empate en lo más alto: ${winners.map((w) => w.name).join(" y ")}`;
        box.appendChild(tie);
      }
      ranking.appendChild(box);
      highlightWinner();
    }

    // expose a refresher so admin reset can update an open card
    wrap._refresh = () => { renderStars(); renderRanking(); };

    renderStars();
    renderRanking();
    return wrap;
  }

  /* =========================================================
     ADMIN
     ========================================================= */
  function anyModalOpen() {
    return !$("#pinModal").classList.contains("hidden") || !$("#adminModal").classList.contains("hidden");
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function setupAdmin() {
    const pinModal = $("#pinModal");
    const adminModal = $("#adminModal");
    let entered = "";

    $("#adminTrigger").addEventListener("click", () => {
      if (adminAuthed) { openAdmin(); return; }
      entered = "";
      updatePinDots();
      $("#pinError").textContent = "";
      openModal(pinModal);
    });

    function updatePinDots() {
      $$("#pinDots span").forEach((s, i) => s.classList.toggle("is-filled", i < entered.length));
    }

    $("#keypad").addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "clear") { entered = ""; updatePinDots(); return; }
      if (action === "del") { entered = entered.slice(0, -1); updatePinDots(); return; }
      if (entered.length >= 4) return;
      entered += btn.textContent.trim();
      updatePinDots();
      if (entered.length === 4) {
        const ok = (await sha256(entered)) === PIN_HASH;
        if (ok) {
          adminAuthed = true;
          closeModal(pinModal);
          openAdmin();
        } else {
          $("#pinDots").classList.add("is-error");
          $("#pinError").textContent = "Código incorrecto. Inténtalo de nuevo.";
          setTimeout(() => {
            $("#pinDots").classList.remove("is-error");
            entered = "";
            updatePinDots();
          }, 600);
        }
      }
    });

    // Admin actions
    $("#adminModal").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-admin]");
      if (!btn) return;
      const act = btn.dataset.admin;
      if (act === "unlockAll") {
        plans.forEach((_, i) => setUnlocked(i, true));
        toast("Todos los capítulos desbloqueados");
      } else if (act === "lockAll") {
        plans.forEach((_, i) => setUnlocked(i, false));
        if (current > 0) current = 0;
        toast("Capítulos bloqueados salvo el primero");
      } else if (act === "resetTasting") {
        state.tasting = {};
        saveState();
        refreshTastingCards();
        toast("Puntuaciones de la cata reiniciadas");
      } else if (act === "resetAll") {
        if (confirm("¿Resetear todo el progreso, incluidas las puntuaciones?")) {
          state = defaultState();
          saveState();
          current = 0;
          toast("Progreso reseteado");
        } else return;
      }
      renderAll();
      renderAdminList();
    });

    function openAdmin() {
      renderAdminList();
      openModal(adminModal);
    }

    function renderAdminList() {
      const list = $("#adminList");
      list.innerHTML = "";
      plans.forEach((plan, i) => {
        const li = document.createElement("li");
        li.className = "admin__item";
        const unlocked = isUnlocked(i);
        li.innerHTML = `
          <span class="admin__item-num">${i + 1}</span>
          <span class="admin__item-info">
            <span class="admin__item-day">${plan.day}</span>
            <span class="admin__item-title"></span>
          </span>`;
        li.querySelector(".admin__item-title").textContent = plan.title;
        const toggle = document.createElement("button");
        toggle.className = "admin__toggle";
        toggle.setAttribute("aria-pressed", unlocked ? "true" : "false");
        toggle.setAttribute("aria-label", `${unlocked ? "Bloquear" : "Desbloquear"} ${plan.title}`);
        if (i === 0) { toggle.disabled = true; toggle.style.opacity = "0.5"; }
        toggle.addEventListener("click", () => {
          if (i === 0) return;
          setUnlocked(i, !isUnlocked(i));
          toggle.setAttribute("aria-pressed", isUnlocked(i) ? "true" : "false");
          renderAll();
        });
        li.appendChild(toggle);
        list.appendChild(li);
      });
    }

    // close handlers
    document.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => {
        closeModal(pinModal);
        closeModal(adminModal);
      });
    });
  }

  function refreshTastingCards() {
    $$(".tasting").forEach((t) => { if (t._refresh) t._refresh(); });
  }

  function renderAll() {
    // Rebuild every card to reflect lock changes, preserving current index.
    renderDeck();
    buildDots();
    goTo(Math.min(current, plans.length - 1), false);
  }

  /* ---------- Modal helpers ---------- */
  let lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    m.classList.remove("hidden");
    const focusable = m.querySelector("button, a, input");
    if (focusable) focusable.focus();
    document.addEventListener("keydown", escClose);
  }
  function closeModal(m) {
    m.classList.add("hidden");
    document.removeEventListener("keydown", escClose);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function escClose(e) {
    if (e.key === "Escape") {
      closeModal($("#pinModal"));
      closeModal($("#adminModal"));
    }
  }

  /* ---------- Service worker ---------- */
  function registerSW() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
      });
    }
  }

  /* ---------- Go ---------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
