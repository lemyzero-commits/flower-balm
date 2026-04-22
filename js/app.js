/* =====================================================
   WINKY LUX — FLOWER BALM  |  app.js
   ===================================================== */
(function () {
  "use strict";

  /* ── CONFIG ── */
  const FRAME_COUNT   = 201;
  const FRAME_SPEED   = 2.0;   // product reveal done at ~50% scroll
  const IMAGE_SCALE   = 0.85;  // padded cover mode
  const FIRST_BATCH   = 14;    // priority frames for fast first-paint

  /* Overlay range for stats section */
  const OVL_ENTER     = 0.46;
  const OVL_LEAVE     = 0.68;
  const OVL_FADE      = 0.03;
  const OVL_MAX       = 0.90;

  /* Marquee visible range */
  const MRQ_ENTER     = 0.24;
  const MRQ_LEAVE     = 0.36;
  const MRQ_FADE      = 0.025;

  /* ── DOM ── */
  const loader          = document.getElementById("loader");
  const loaderBar       = document.getElementById("loader-bar");
  const loaderPct       = document.getElementById("loader-percent");
  const canvasWrap      = document.getElementById("canvas-wrap");
  const canvas          = document.getElementById("canvas");
  const ctx             = canvas.getContext("2d");
  const darkOverlay     = document.getElementById("dark-overlay");
  const marqueeWrap     = document.getElementById("marquee");
  const marqueeText     = marqueeWrap && marqueeWrap.querySelector(".marquee-text");
  const scrollContainer = document.getElementById("scroll-container");
  const hero            = document.querySelector(".hero-standalone");
  const sections        = Array.from(document.querySelectorAll(".scroll-section"));

  /* ── CANVAS: size once, then redraw on resize ── */
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let canvasW = 0, canvasH = 0;

  function resizeCanvas() {
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width  = Math.round(canvasW * DPR);
    canvas.height = Math.round(canvasH * DPR);
    canvas.style.width  = canvasW + "px";
    canvas.style.height = canvasH + "px";
    // NOTE: ctx transform is reset when canvas dimensions change — no scale needed
    // We draw at physical pixel coordinates directly
    drawFrame(currentFrame);
  }
  window.addEventListener("resize", resizeCanvas, { passive: true });
  // NOTE: resizeCanvas() is called inside boot() once frames are ready.
  // Calling it here would throw ReferenceError (temporal dead zone on
  // `currentFrame` and `frames` which are declared below).

  /* ── FRAMES ── */
  const frames     = new Array(FRAME_COUNT).fill(null);
  let   currentFrame = 0;
  let   bgColor      = "#0a0a0a";

  function sampleBg(img) {
    try {
      const off = document.createElement("canvas");
      off.width = off.height = 2;
      off.getContext("2d").drawImage(img, 0, 0, 2, 2);
      const d = off.getContext("2d").getImageData(0, 0, 1, 1).data;
      bgColor = `rgb(${d[0]},${d[1]},${d[2]})`;
    } catch (_) {}
  }

  /* ── DRAW FRAME — padded cover at physical pixels ── */
  function drawFrame(idx) {
    const img = frames[idx];
    const cw = canvas.width;    // physical pixels (DPR-scaled)
    const ch = canvas.height;
    if (!cw || !ch) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    if (!img) return;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2,   dy = (ch - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ── PRELOADER ── */
  let loaded = 0;

  function pad(n) { return String(n).padStart(4, "0"); }

  function loadOne(i) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { frames[i] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = `frames/frame_${pad(i + 1)}.webp`;
    });
  }

  function tick(n) {
    loaded += n;
    const pct = Math.min(100, Math.round((loaded / FRAME_COUNT) * 100));
    if (loaderBar)  loaderBar.style.width = pct + "%";
    if (loaderPct)  loaderPct.textContent  = pct + "%";
  }

  async function preload() {
    // Phase 1 — first FIRST_BATCH frames immediately for fast display
    const p1 = [];
    for (let i = 0; i < FIRST_BATCH; i++) p1.push(loadOne(i));
    await Promise.all(p1);
    tick(FIRST_BATCH);
    if (frames[0]) sampleBg(frames[0]);
    drawFrame(0);

    // Phase 2 — rest in background batches
    const BATCH = 25;
    for (let i = FIRST_BATCH; i < FRAME_COUNT; i += BATCH) {
      const batch = [];
      for (let j = i; j < Math.min(i + BATCH, FRAME_COUNT); j++) batch.push(loadOne(j));
      const count = batch.length;
      await Promise.all(batch);
      tick(count);
    }

    // All done — hide loader and start scroll engine
    loader.classList.add("hidden");
    boot();
  }

  /* ── SECTION ANIMATION ── */
  const timelines = new WeakMap();
  const states    = new WeakMap(); // "hidden" | "visible"

  function buildTl(sec) {
    const type = sec.dataset.animation || "fade-up";
    const els  = Array.from(sec.querySelectorAll(
      ".section-label,.section-heading,.section-body,.section-note," +
      ".cta-button,.stat,.stat-number-row,.stat-label"
    ));
    if (!els.length) return gsap.timeline({ paused: true });

    const tl = gsap.timeline({ paused: true });
    const opts = { stagger: 0.13, ease: "power3.out", duration: 0.9 };

    switch (type) {
      case "slide-left":
        gsap.set(els, { x: -80, opacity: 0 });
        tl.to(els, { x: 0, opacity: 1, ...opts });
        break;
      case "slide-right":
        gsap.set(els, { x:  80, opacity: 0 });
        tl.to(els, { x: 0, opacity: 1, ...opts });
        break;
      case "scale-up":
        gsap.set(els, { scale: 0.82, opacity: 0 });
        tl.to(els, { scale: 1, opacity: 1, ...opts, ease: "power2.out", duration: 1.0 });
        break;
      case "stagger-up":
        gsap.set(els, { y: 60, opacity: 0 });
        tl.to(els, { y: 0, opacity: 1, ...opts, stagger: 0.15 });
        break;
      case "clip-reveal":
        gsap.set(els, { clipPath: "inset(100% 0 0 0)", opacity: 0 });
        tl.to(els, { clipPath: "inset(0% 0 0 0)", opacity: 1, ...opts, duration: 1.2, ease: "power4.inOut" });
        break;
      default: // fade-up
        gsap.set(els, { y: 50, opacity: 0 });
        tl.to(els, { y: 0, opacity: 1, ...opts });
    }
    return tl;
  }

  function setupSections() {
    sections.forEach(sec => {
      timelines.set(sec, buildTl(sec));
      states.set(sec, "hidden");
    });
  }

  /* Stats counters — animate once */
  const counted = new WeakSet();
  function animateCounters(sec) {
    if (counted.has(sec)) return;
    counted.add(sec);
    sec.querySelectorAll(".stat-number").forEach(el => {
      const target = parseFloat(el.dataset.value);
      const dec    = parseInt(el.dataset.decimals || "0");
      const obj    = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 2.2, ease: "power1.out",
        onUpdate() {
          el.textContent = dec === 0 ? Math.round(obj.v) : obj.v.toFixed(dec);
        }
      });
    });
  }

  function updateSections(p) {
    sections.forEach(sec => {
      const enter   = parseFloat(sec.dataset.enter)  / 100;
      const leave   = parseFloat(sec.dataset.leave)  / 100;
      const persist = sec.dataset.persist === "true";
      const prev    = states.get(sec);
      const show    = (p >= enter && p <= leave) || (persist && p > leave);

      if (show && prev !== "visible") {
        states.set(sec, "visible");
        sec.style.opacity = "1";
        sec.style.pointerEvents = "auto";
        const tl = timelines.get(sec);
        tl.restart();
        if (sec.classList.contains("section-stats")) animateCounters(sec);

      } else if (!show && prev !== "hidden") {
        states.set(sec, "hidden");
        sec.style.opacity = "0";
        sec.style.pointerEvents = "none";
        const tl = timelines.get(sec);
        tl.pause(0); // snap back to initial state
      }
    });
  }

  /* ── DARK OVERLAY ── */
  function updateOverlay(p) {
    let o = 0;
    if      (p >= OVL_ENTER - OVL_FADE && p < OVL_ENTER) o = ((p - (OVL_ENTER - OVL_FADE)) / OVL_FADE) * OVL_MAX;
    else if (p >= OVL_ENTER && p <= OVL_LEAVE)            o = OVL_MAX;
    else if (p > OVL_LEAVE && p <= OVL_LEAVE + OVL_FADE)  o = OVL_MAX * (1 - (p - OVL_LEAVE) / OVL_FADE);
    darkOverlay.style.opacity = Math.max(0, Math.min(OVL_MAX, o));
  }

  /* ── MARQUEE ── */
  function updateMarquee(p) {
    if (!marqueeWrap || !marqueeText) return;
    let o = 0;
    if      (p >= MRQ_ENTER - MRQ_FADE && p < MRQ_ENTER) o = (p - (MRQ_ENTER - MRQ_FADE)) / MRQ_FADE;
    else if (p >= MRQ_ENTER && p <= MRQ_LEAVE)            o = 1;
    else if (p > MRQ_LEAVE && p <= MRQ_LEAVE + MRQ_FADE)  o = 1 - (p - MRQ_LEAVE) / MRQ_FADE;
    marqueeWrap.style.opacity = Math.max(0, Math.min(1, o));
    // Horizontal slide: moves ~2.5× viewport-widths over full scroll
    gsap.set(marqueeText, { x: -(p * window.innerWidth * 2.5) });
  }

  /* ── BOOT: called after all frames loaded ── */
  function boot() {
    gsap.registerPlugin(ScrollTrigger);

    /* Lenis smooth scroll */
    const lenis = new Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    resizeCanvas();
    positionSections();
    setupSections();

    /* ── HERO circle-wipe: fires while hero scrolls away (0 → 100vh) ── */
    ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom top",    // fires across the entire 100vh hero
      scrub: 0.6,
      onUpdate(self) {
        const p = self.progress;
        // Fade hero out as it scrolls
        hero.style.opacity = Math.max(0, 1 - p * 1.4);
        // Canvas wipes in: 0% → 80% across the hero scroll
        canvasWrap.style.clipPath = `circle(${p * 80}% at 50% 50%)`;
        // Draw first frame during hero phase
        drawFrame(0);
      },
    });

    /* ── Main scroll: frame scrub + sections + overlay ── */
    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate(self) {
        const p = self.progress;

        // Advance frames
        const accel = Math.min(p * FRAME_SPEED, 1);
        const idx   = Math.min(Math.floor(accel * FRAME_COUNT), FRAME_COUNT - 1);
        if (idx !== currentFrame) {
          currentFrame = idx;
          if (idx % 20 === 0 && frames[idx]) sampleBg(frames[idx]);
          requestAnimationFrame(() => drawFrame(currentFrame));
        }

        updateSections(p);
        updateOverlay(p);
        updateMarquee(p);
      },
    });

    /* ── Hero entrance stagger ── */
    const heroWords   = document.querySelectorAll(".hero-word");
    const heroTagline = document.querySelector(".hero-tagline");
    const heroLabel   = document.querySelector(".hero-label");
    gsap.set([heroLabel, heroWords, heroTagline], { y: 70, opacity: 0 });
    gsap.timeline({ delay: 0.25 })
      .to(heroLabel,   { y: 0, opacity: 1, duration: 0.7,  ease: "power3.out" })
      .to(heroWords,   { y: 0, opacity: 1, stagger: 0.12, duration: 0.95, ease: "power3.out" }, "-=0.3")
      .to(heroTagline, { y: 0, opacity: 1, duration: 0.7,  ease: "power3.out" }, "-=0.4");
  }

  /* ── POSITION SECTIONS absolutely within scroll-container ── */
  function positionSections() {
    const containerH = scrollContainer.offsetHeight;
    sections.forEach(sec => {
      const enter   = parseFloat(sec.dataset.enter);
      const leave   = parseFloat(sec.dataset.leave);
      const midFrac = (enter + leave) / 2 / 100;
      sec.style.top       = midFrac * containerH + "px";
      sec.style.transform = "translateY(-50%)";
    });
  }

  /* ── START ── */
  preload();

})();
