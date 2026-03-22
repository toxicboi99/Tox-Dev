/**
 * ToxDev Agency — Main script
 * -------------------------------------------
 * Beginner notes:
 * - CONFIG: Replace placeholder IDs/URLs with your real EmailJS + Google Sheets webhook.
 * - Three.js draws the hero background; we cap pixel ratio for smooth FPS.
 * - GSAP ScrollTrigger animates sections as you scroll.
 */

/* ========== CONFIG — Edit these for production ========== */

const CONFIG = {
  /** Floating button — full wa.me URL (country code + number, no +). Example: https://wa.me/14155551234 */
  whatsappUrl: "https://wa.me/1234567890",

  /** Google Apps Script (or other) webhook that accepts POST JSON — replace before launch */
  googleSheetsWebhookUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",

  /** EmailJS: https://dashboard.emailjs.com — create service + template for "thank you" */
  emailjs: {
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
    serviceId: "YOUR_SERVICE_ID",
    /** Template should thank the user; params used: reply_to, to_name, to_email, message */
    thankYouTemplateId: "YOUR_TEMPLATE_ID",
  },

  /** Throttle mouse moves for parallax (ms) */
  parallaxThrottleMs: 12,

  /** Max device pixel ratio for Three.js (performance) */
  maxPixelRatio: 1.75,
};

/* ========== Utilities ========== */

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function throttle(fn, wait) {
  let t = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - t >= wait) {
      t = now;
      fn.apply(this, args);
    }
  };
}

/* ========== Page loader ========== */

function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;
  loader.classList.add("is-hidden");
  setTimeout(() => loader.remove(), 700);
}

window.addEventListener("load", () => {
  hideLoader();
  document.getElementById("year").textContent = new Date().getFullYear();
});

/* ========== Header scroll + mobile nav ========== */

const header = document.getElementById("header");
function onScrollHeader() {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 40);
}
window.addEventListener("scroll", throttle(onScrollHeader, 100), { passive: true });
onScrollHeader();

const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");
const navBackdrop = document.getElementById("navBackdrop");

function setMobileNavOpen(open) {
  if (!navMenu || !navToggle) return;
  navMenu.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", open);
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  document.body.classList.toggle("nav-open", open);
  if (navBackdrop) navBackdrop.classList.toggle("is-visible", open);
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const open = !navMenu.classList.contains("is-open");
    setMobileNavOpen(open);
  });
  navMenu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setMobileNavOpen(false));
  });
  if (navBackdrop) {
    navBackdrop.addEventListener("click", () => setMobileNavOpen(false));
  }
  window.addEventListener(
    "resize",
    throttle(() => {
      if (window.innerWidth > 768 && navMenu.classList.contains("is-open")) {
        setMobileNavOpen(false);
      }
    }, 150)
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navMenu.classList.contains("is-open")) setMobileNavOpen(false);
  });
}

/* ========== Theme (light / dark) ========== */

const THEME_KEY = "toxdev-theme";

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (_) {}
  const btn = document.getElementById("themeToggle");
  if (btn) btn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
}

function initTheme() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const stored = (() => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  })();
  if (stored === "light" || stored === "dark") {
    applyTheme(stored);
  } else {
    applyTheme("dark");
  }
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next);
  });
}

initTheme();

(function applyFloatingFabLinks() {
  const wa = document.querySelector(".fab-float__btn--wa");
  if (wa && CONFIG.whatsappUrl) wa.setAttribute("href", CONFIG.whatsappUrl);
})();

/* ========== Floating contact — one button opens WhatsApp + social panel ========== */

function setupFabFloat() {
  const root = document.getElementById("fabFloat");
  const toggle = document.getElementById("fabToggle");
  const panel = document.getElementById("fabPanel");
  const backdrop = document.getElementById("fabBackdrop");
  if (!root || !toggle || !panel) return;

  function setOpen(open) {
    root.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute(
      "aria-label",
      open ? "Close contact menu" : "Open WhatsApp and social links"
    );
    panel.setAttribute("aria-hidden", !open);
    if (backdrop) backdrop.setAttribute("aria-hidden", !open);
    if (open) panel.removeAttribute("inert");
    else panel.setAttribute("inert", "");
    document.body.classList.toggle("fab-open", open);
  }

  toggle.addEventListener("click", () => setOpen(!root.classList.contains("is-open")));
  if (backdrop) backdrop.addEventListener("click", () => setOpen(false));
  panel.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-open")) setOpen(false);
  });
}

setupFabFloat();

/* ========== Hero Three.js (floating shapes + soft particles) ========== */

let threeCleanup = null;

/** Hero scene + fog — keep in sync with .hero__canvas-wrap gradients in style.css */
const HERO_BG_DEEP = 0x0a0818;
const HERO_FOG_DENSITY = 0.036;

function initHeroThree() {
  if (typeof THREE === "undefined" || prefersReducedMotion()) {
    return;
  }

  const canvas = document.getElementById("heroCanvas");
  const container = document.getElementById("heroCanvasWrap");
  if (!canvas || !container) return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HERO_BG_DEEP, HERO_FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.5, 6);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setClearColor(0x000000, 0);

  /** Main abstract shapes — low poly for performance */
  const group = new THREE.Group();
  scene.add(group);

  const matA = new THREE.MeshStandardMaterial({
    color: 0x7c5cff,
    metalness: 0.35,
    roughness: 0.35,
    emissive: 0x2a1f66,
    emissiveIntensity: 0.4,
    flatShading: true,
  });
  const matB = new THREE.MeshStandardMaterial({
    color: 0x00e5c8,
    metalness: 0.25,
    roughness: 0.45,
    emissive: 0x004d43,
    emissiveIntensity: 0.35,
    flatShading: true,
  });

  const torus = new THREE.Mesh(new THREE.TorusKnotGeometry(0.85, 0.28, 100, 16), matA);
  torus.position.set(-1.8, 0.3, 0);
  group.add(torus);

  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), matB);
  ico.position.set(1.6, -0.2, -0.5);
  group.add(ico);

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), matA.clone());
  box.material.emissiveIntensity = 0.25;
  box.position.set(0.2, 0.8, -1.2);
  box.rotation.set(0.4, 0.6, 0.2);
  group.add(box);

  /** Few particles (not thousands) — keeps FPS stable */
  const particleCount = 420;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x9b8cff,
    size: 0.04,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  const amb = new THREE.AmbientLight(0x4a4080, 0.72);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xe8e4ff, 0.85);
  dir.position.set(4, 6, 5);
  scene.add(dir);
  const pt = new THREE.PointLight(0x7c5cff, 1.35, 22);
  pt.position.set(-3, 2, 4);
  scene.add(pt);
  const pt2 = new THREE.PointLight(0x00c4aa, 0.45, 16);
  pt2.position.set(3.5, -1.5, 3);
  scene.add(pt2);

  let width = 0;
  let height = 0;
  let frame = 0;
  let running = true;

  function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  /** Mouse-influenced rotation (subtle parallax on 3D group) */
  let mx = 0;
  let my = 0;
  const onMove = throttle((e) => {
    const nx = (e.clientX / width) * 2 - 1;
    const ny = (e.clientY / height) * 2 - 1;
    mx = nx * 0.35;
    my = ny * 0.25;
  }, 32);
  window.addEventListener("mousemove", onMove, { passive: true });

  function animate() {
    if (!running) return;
    frame += 0.008;
    torus.rotation.x = frame * 0.7;
    torus.rotation.y = frame * 0.5;
    ico.rotation.y = frame * 0.9;
    ico.rotation.z = frame * 0.25;
    box.rotation.x = frame * 0.4;
    box.rotation.y = frame * 0.55;

    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, mx * 0.45, 0.04);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -my * 0.25, 0.04);

    particles.rotation.y = frame * 0.05;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  threeCleanup = () => {
    running = false;
    window.removeEventListener("mousemove", onMove);
    ro.disconnect();
    renderer.dispose();
    pGeo.dispose();
    pMat.dispose();
    torus.geometry.dispose();
    ico.geometry.dispose();
    box.geometry.dispose();
    [matA, matB].forEach((m) => m.dispose && m.dispose());
  };
}

/** Lazy-init Three when hero is near viewport — saves work on long pages / slow devices */
function lazyInitHeroThree() {
  const wrap = document.getElementById("heroCanvasWrap");
  if (!wrap) {
    initHeroThree();
    return;
  }
  if (prefersReducedMotion()) {
    initHeroThree();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          initHeroThree();
          io.disconnect();
        }
      });
    },
    { rootMargin: "100px 0px", threshold: 0 }
  );
  io.observe(wrap);
}

lazyInitHeroThree();

/* ========== Mouse parallax (2D hero text) ========== */

const heroContent = document.querySelector(".hero__content");
if (heroContent && !prefersReducedMotion()) {
  const strength = parseFloat(heroContent.getAttribute("data-parallax") || "0.04");
  const move = throttle((e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    heroContent.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  }, CONFIG.parallaxThrottleMs);
  window.addEventListener("mousemove", move, { passive: true });
}

/* ========== 3D tilt — team cards ========== */

function setupTiltCards() {
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    const inner = card.querySelector(".tilt-card__inner");
    if (!inner || prefersReducedMotion()) return;

    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const px = (x / r.width - 0.5) * 2;
      const py = (y / r.height - 0.5) * 2;
      const max = 12;
      inner.style.transform = `rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(8px)`;
    });

    card.addEventListener("mouseleave", () => {
      inner.style.transform = "";
    });
  });
}
setupTiltCards();

/* ========== GSAP scroll reveals ========== */

function setupScrollAnimations() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray("[data-reveal], .reveal").forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 36 },
      {
        opacity: 1,
        y: 0,
        duration: prefersReducedMotion() ? 0.01 : 0.85,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      }
    );
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupScrollAnimations);
} else {
  setupScrollAnimations();
}

/* ========== Services → Contact + hidden field ========== */

const serviceField = document.getElementById("serviceInquiry");

const projectRefField = document.getElementById("projectRef");

document.querySelectorAll(".service-card[data-service]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.getAttribute("data-service") || "";
    if (serviceField) serviceField.value = name;
    if (projectRefField) projectRefField.value = "";
    const contact = document.getElementById("contact");
    if (contact) contact.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    const first = document.getElementById("contactName");
    if (first) first.focus({ preventScroll: true });
  });
});

/* ========== Portfolio — 20 flip cards ========== */

/** Each project: unique image seed for picsum + display meta */
const PORTFOLIO_ITEMS = [
  { title: "Nebula Commerce", tag: "eCommerce", year: "2025", img: "https://picsum.photos/seed/tox-nebula/800/600" },
  { title: "Pulse Analytics", tag: "Web App", year: "2025", img: "https://picsum.photos/seed/tox-pulse/800/600" },
  { title: "Atlas Realty", tag: "Web Design", year: "2024", img: "https://picsum.photos/seed/tox-atlas/800/600" },
  { title: "Vertex LMS", tag: "EdTech", year: "2024", img: "https://picsum.photos/seed/tox-vertex/800/600" },
  { title: "Lumen Health", tag: "Healthcare", year: "2024", img: "https://picsum.photos/seed/tox-lumen/800/600" },
  { title: "Kite Mobile", tag: "Marketing", year: "2024", img: "https://picsum.photos/seed/tox-kite/800/600" },
  { title: "Drift Audio", tag: "Brand", year: "2023", img: "https://picsum.photos/seed/tox-drift/800/600" },
  { title: "Cipher Vault", tag: "Security", year: "2023", img: "https://picsum.photos/seed/tox-cipher/800/600" },
  { title: "Harbor Logistics", tag: "B2B", year: "2023", img: "https://picsum.photos/seed/tox-harbor/800/600" },
  { title: "Solstice Travel", tag: "Booking", year: "2023", img: "https://picsum.photos/seed/tox-solstice/800/600" },
  { title: "Frame Studio", tag: "Portfolio", year: "2023", img: "https://picsum.photos/seed/tox-frame/800/600" },
  { title: "Mint Payroll", tag: "SaaS", year: "2022", img: "https://picsum.photos/seed/tox-mint/800/600" },
  { title: "Echo Podcast", tag: "Media", year: "2022", img: "https://picsum.photos/seed/tox-echo/800/600" },
  { title: "Quartz Bank", tag: "Fintech", year: "2022", img: "https://picsum.photos/seed/tox-quartz/800/600" },
  { title: "Northwind Energy", tag: "Corporate", year: "2022", img: "https://picsum.photos/seed/tox-north/800/600" },
  { title: "Pixel Arcade", tag: "Games", year: "2022", img: "https://picsum.photos/seed/tox-pixel/800/600" },
  { title: "Cedar Nonprofit", tag: "NGO", year: "2021", img: "https://picsum.photos/seed/tox-cedar/800/600" },
  { title: "Ridge Outdoors", tag: "Retail", year: "2021", img: "https://picsum.photos/seed/tox-ridge/800/600" },
  { title: "Velvet Fashion", tag: "Luxury", year: "2021", img: "https://picsum.photos/seed/tox-velvet/800/600" },
  { title: "Orbit Launch", tag: "Startup", year: "2021", img: "https://picsum.photos/seed/tox-orbit/800/600" },
];

function buildPortfolio() {
  const grid = document.getElementById("portfolioGrid");
  if (!grid) return;

  PORTFOLIO_ITEMS.forEach((item) => {
    const article = document.createElement("article");
    article.className = "project-card";
    article.innerHTML = `
      <a href="#contact" class="project-card__link" data-project-title="${item.title}">
        <div class="project-card__image-wrap">
          <img src="${item.img}" alt="${item.title} — ${item.tag}, ${item.year}" width="800" height="600" loading="lazy" decoding="async" />
          <div class="project-card__overlay" aria-hidden="true"></div>
          <div class="project-card__content">
            <span class="project-card__tag">${item.tag}</span>
            <h3 class="project-card__title">${item.title}</h3>
            <span class="project-card__cta">
              View project
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </span>
          </div>
        </div>
      </a>
    `;
    grid.appendChild(article);
  });

  /** Prefill hidden project_ref + optional message line when “View project” is used */
  grid.addEventListener("click", (e) => {
    const a = e.target.closest("a.project-card__link[data-project-title]");
    if (!a) return;
    const title = a.getAttribute("data-project-title") || "";
    const projectRef = document.getElementById("projectRef");
    const serviceFieldEl = document.getElementById("serviceInquiry");
    if (projectRef) projectRef.value = `Project interest: ${title}`;
    if (serviceFieldEl) serviceFieldEl.value = "";
  });
}
buildPortfolio();

/* ========== Testimonials slider ========== */

const TESTIMONIALS = [
  {
    quote:
      "ToxDev shipped a storefront that stayed fast on Black Friday. Conversion jumped within weeks — and the 3D hero still runs butter-smooth.",
    name: "Priya N.",
    role: "CMO, Nebula Commerce",
  },
  {
    quote:
      "Their team speaks design and engineering fluently. We finally got an SEO foundation we can measure, not guess.",
    name: "Daniel F.",
    role: "Founder, Pulse Analytics",
  },
  {
    quote:
      "Clear process, sharp communication, and no drama. The site feels premium — our investors noticed.",
    name: "Elena V.",
    role: "CEO, Orbit Launch",
  },
  {
    quote:
      "Accessibility and performance were non-negotiable. They delivered both without watering down the creative.",
    name: "Marcus T.",
    role: "Product, Cipher Vault",
  },
];

function buildTestimonialSlider() {
  const track = document.getElementById("testimonialTrack");
  const dotsWrap = document.getElementById("testDots");
  const prev = document.getElementById("testPrev");
  const next = document.getElementById("testNext");
  if (!track || !dotsWrap) return;

  TESTIMONIALS.forEach((t, i) => {
    const slide = document.createElement("div");
    slide.className = "testimonial-slide" + (i === 0 ? " is-active" : "");
    slide.innerHTML = `
      <blockquote>“${t.quote}”</blockquote>
      <cite><strong>${t.name}</strong>${t.role}</cite>
    `;
    track.appendChild(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "slider-dot" + (i === 0 ? " is-active" : "");
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  const slides = track.querySelectorAll(".testimonial-slide");
  const dots = dotsWrap.querySelectorAll(".slider-dot");
  let index = 0;

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, j) => s.classList.toggle("is-active", j === index));
    dots.forEach((d, j) => d.classList.toggle("is-active", j === index));
  }

  if (prev) prev.addEventListener("click", () => goTo(index - 1));
  if (next) next.addEventListener("click", () => goTo(index + 1));

  /** Auto-advance (respect reduced motion) */
  if (!prefersReducedMotion()) {
    setInterval(() => goTo(index + 1), 6500);
  }
}
buildTestimonialSlider();

/* ========== Contact form — validation + submit ========== */

const form = document.getElementById("contactForm");
const elName = document.getElementById("contactName");
const elEmail = document.getElementById("contactEmail");
const elMessage = document.getElementById("contactMessage");
const errName = document.getElementById("errName");
const errEmail = document.getElementById("errEmail");
const errMessage = document.getElementById("errMessage");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("formToast");

function validateName() {
  const v = (elName.value || "").trim();
  if (!v) return "Please enter your name.";
  if (v.length < 2) return "Name should be at least 2 characters.";
  return "";
}

function validateEmail() {
  const v = (elEmail.value || "").trim();
  if (!v) return "Please enter your email.";
  /** HTML5-like check + simple pattern */
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!ok) return "Enter a valid email address.";
  return "";
}

function validateMessage() {
  const v = (elMessage.value || "").trim();
  if (!v) return "Please enter a message.";
  if (v.length < 10) return "Message should be at least 10 characters.";
  return "";
}

function showFieldError(input, errEl, msg) {
  if (msg) {
    input.classList.add("is-invalid");
    errEl.textContent = msg;
  } else {
    input.classList.remove("is-invalid");
    errEl.textContent = "";
  }
}

function wireRealtimeValidation() {
  if (elName) {
    elName.addEventListener("input", () => showFieldError(elName, errName, validateName()));
    elName.addEventListener("blur", () => showFieldError(elName, errName, validateName()));
  }
  if (elEmail) {
    elEmail.addEventListener("input", () => showFieldError(elEmail, errEmail, validateEmail()));
    elEmail.addEventListener("blur", () => showFieldError(elEmail, errEmail, validateEmail()));
  }
  if (elMessage) {
    elMessage.addEventListener("input", () => showFieldError(elMessage, errMessage, validateMessage()));
    elMessage.addEventListener("blur", () => showFieldError(elMessage, errMessage, validateMessage()));
  }
}
wireRealtimeValidation();

/** EmailJS init once */
let emailJsReady = false;
function initEmailJs() {
  if (typeof emailjs === "undefined") return;
  if (CONFIG.emailjs.publicKey.includes("YOUR_")) {
    console.warn("[ToxDev] Set CONFIG.emailjs.publicKey in script.js for EmailJS.");
    return;
  }
  emailjs.init({ publicKey: CONFIG.emailjs.publicKey });
  emailJsReady = true;
}
initEmailJs();

function showToast() {
  if (!toast) return;
  toast.classList.add("is-visible");
  toast.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.setAttribute("aria-hidden", "true");
  }, 5200);
}

async function sendThankYouEmail(name, email, message) {
  if (!emailJsReady || typeof emailjs === "undefined") return;
  const { serviceId, thankYouTemplateId } = CONFIG.emailjs;
  if (serviceId.includes("YOUR_") || thankYouTemplateId.includes("YOUR_")) return;

  await emailjs.send(serviceId, thankYouTemplateId, {
    to_name: name,
    to_email: email,
    reply_to: email,
    message: message,
    subject_line: "Thanks for reaching out — ToxDev",
  });
}

async function postToGoogleSheets(payload) {
  const url = CONFIG.googleSheetsWebhookUrl;
  if (url.includes("YOUR_")) {
    console.warn("[ToxDev] Replace CONFIG.googleSheetsWebhookUrl with your Apps Script URL.");
    return { ok: false, skipped: true };
  }
  const res = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Sheet webhook failed");
  return { ok: true };
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const n = validateName();
    const em = validateEmail();
    const m = validateMessage();
    showFieldError(elName, errName, n);
    showFieldError(elEmail, errEmail, em);
    showFieldError(elMessage, errMessage, m);
    if (n || em || m) return;

    const name = elName.value.trim();
    const email = elEmail.value.trim();
    const message = elMessage.value.trim();
    const serviceInquiry = serviceField ? serviceField.value : "";

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    const projectRef = document.getElementById("projectRef");
    const projectRefVal = projectRef ? projectRef.value.trim() : "";

    const payload = {
      name,
      email,
      message,
      service_inquiry: serviceInquiry,
      project_ref: projectRefVal,
      submitted_at: new Date().toISOString(),
      source: "ToxDev website",
    };

    try {
      /** Run sheet + email in parallel; sheet may be skipped in dev */
      const tasks = [];
      tasks.push(
        postToGoogleSheets(payload).catch((err) => {
          console.error("Sheets:", err);
        })
      );
      tasks.push(
        sendThankYouEmail(name, email, message).catch((err) => {
          console.error("EmailJS:", err);
        })
      );
      await Promise.all(tasks);

      form.reset();
      if (serviceField) serviceField.value = "";
      if (projectRef) projectRef.value = "";
      showToast();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again or email us directly.");
    } finally {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }
  });
}
