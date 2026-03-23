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

/* ========== Services -> Dynamic contact form ========== */

const CONTACT_SERVICES = {
  "web-development": {
    label: "Web Development",
    subServices: [
      "Frontend Development",
      "Backend Development",
      "Full Stack Development",
      "E-commerce Development",
      "Business Website",
      "Custom Web Application",
    ],
  },
  "ui-ux-design": {
    label: "UI/UX Design",
    subServices: [
      "UI Design",
      "UX Research",
      "Wireframing and Prototyping",
      "Design System",
      "Mobile App Design",
      "Landing Page Design",
    ],
  },
  seo: {
    label: "SEO",
    subServices: [
      "Technical SEO",
      "On-Page SEO",
      "Local SEO",
      "SEO Audit",
      "Content Strategy",
      "Performance Optimization",
    ],
  },
  automation: {
    label: "Automation",
    subServices: [
      "Workflow Automation",
      "CRM Automation",
      "Email Automation",
      "Lead Capture Automation",
      "Reporting Automation",
      "AI Process Automation",
    ],
  },
  "api-development": {
    label: "API Development",
    subServices: [
      "REST API Development",
      "Third-Party Integration",
      "Payment Gateway Integration",
      "Authentication and Security",
      "Microservices API",
      "API Documentation",
    ],
  },
};

const projectRefField = document.getElementById("projectRef");
const serviceCards = document.querySelectorAll(".service-card[data-service-key]");
const elService = document.getElementById("contactService");
const elSubService = document.getElementById("contactSubService");
const summaryService = document.getElementById("summaryService");
const summarySubService = document.getElementById("summarySubService");

function setSummaryChip(el, text, isEmpty) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("is-empty", Boolean(isEmpty));
}

function populateSubServiceOptions(serviceKey, selectedValue = "") {
  if (!elSubService) return;

  const config = CONTACT_SERVICES[serviceKey];
  elSubService.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = config ? "Select a sub-service" : "Select a service first";
  elSubService.appendChild(placeholder);

  if (!config) {
    elSubService.disabled = true;
    elSubService.value = "";
    return;
  }

  config.subServices.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    elSubService.appendChild(option);
  });

  elSubService.disabled = false;
  elSubService.value = config.subServices.includes(selectedValue) ? selectedValue : "";
}

function updateSelectionSummary() {
  const serviceConfig = elService ? CONTACT_SERVICES[elService.value] : null;
  setSummaryChip(summaryService, serviceConfig ? serviceConfig.label : "Service not selected", !serviceConfig);
  setSummaryChip(
    summarySubService,
    elSubService && elSubService.value ? elSubService.value : "Sub-service pending",
    !(elSubService && elSubService.value)
  );
}

function syncActiveServiceCard() {
  if (!serviceCards.length || !elService) return;
  serviceCards.forEach((card) => {
    const isActive = card.getAttribute("data-service-key") === elService.value;
    card.classList.toggle("is-active", isActive);
  });
}

function applyServiceSelection(serviceKey, options = {}) {
  const { scrollToForm = true } = options;
  if (!elService || !CONTACT_SERVICES[serviceKey]) return;

  elService.value = serviceKey;
  populateSubServiceOptions(serviceKey);
  updateSelectionSummary();
  syncActiveServiceCard();

  if (projectRefField) projectRefField.value = "";

  const contact = document.getElementById("contact");
  if (scrollToForm && contact) {
    contact.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  if (elSubService) elSubService.focus({ preventScroll: true });
}

serviceCards.forEach((btn) => {
  btn.addEventListener("click", () => {
    const serviceKey = btn.getAttribute("data-service-key") || "";
    applyServiceSelection(serviceKey);
  });
});

if (elService) {
  elService.addEventListener("change", () => {
    populateSubServiceOptions(elService.value);
    updateSelectionSummary();
    syncActiveServiceCard();
  });
}

if (elSubService) {
  elSubService.addEventListener("change", updateSelectionSummary);
}

populateSubServiceOptions(elService ? elService.value : "");
updateSelectionSummary();
syncActiveServiceCard();

/* ========== Portfolio -> image, name, live button ========== */

/** Replace liveUrl values with your real deployed project links before launch. */
const PORTFOLIO_ITEMS = [
  {
    title: "English Speaking Practice App",
    img: "/img/pro1.png",
    liveUrl: "https://english-app-seven-beta.vercel.app/",
  },
  {
    title: "Flourish Finance",
    img: "/img/pro2.png",
    liveUrl: "https://www.flourishfinance.com.au/",
  },
  {
    title: "UEI Global",
    img: "/img/pro3.png",
    liveUrl: "https://www.uei-global.com/",
  },
  {
    title: "QuickCart E-commerce",
    img: "/img/pro4.png",
    liveUrl: "https://qcart-team.vercel.app/",
  },
  {
    title: "AI Virtual Assistant",
    img: "/img/pro5.png",
    liveUrl: "https://sarthi02.netlify.app/",
  },
  {
    title: "Cake Hub Store E-commerce",
    img: "/img/pro6.png",
    liveUrl: "https://birgunjcakehub.free.nf/?i=1",
  },
];

function buildPortfolio() {
  const grid = document.getElementById("portfolioGrid");
  if (!grid) return;

  grid.innerHTML = "";

  PORTFOLIO_ITEMS.forEach((item) => {
    const article = document.createElement("article");
    article.className = "project-card";
    article.innerHTML = `
      <a
        href="${item.liveUrl}"
        class="project-card__link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View live project: ${item.title}"
      >
        <div class="project-card__image-wrap">
          <img src="${item.img}" alt="${item.title} project preview" width="900" height="680" loading="lazy" decoding="async" />
          <div class="project-card__overlay" aria-hidden="true"></div>
          <span class="project-card__badge">Live Build</span>
        </div>
        <div class="project-card__body">
          <div class="project-card__meta">
            <h3 class="project-card__title">${item.title}</h3>
          </div>
          <span class="project-card__cta">
            View project
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8"/>
            </svg>
          </span>
        </div>
      </a>
    `;
    grid.appendChild(article);
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

/* ========== Contact form -> validation + submit ========== */

const form = document.getElementById("contactForm");
const elName = document.getElementById("contactName");
const elEmail = document.getElementById("contactEmail");
const elPhone = document.getElementById("contactPhone");
const elBudget = document.getElementById("contactBudget");
const elMessage = document.getElementById("contactMessage");
const errService = document.getElementById("errService");
const errSubService = document.getElementById("errSubService");
const errName = document.getElementById("errName");
const errEmail = document.getElementById("errEmail");
const errPhone = document.getElementById("errPhone");
const errBudget = document.getElementById("errBudget");
const errMessage = document.getElementById("errMessage");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("formToast");

function validateService() {
  if (!elService || elService.value) return "";
  return "Please select a service.";
}

function validateSubService() {
  if (!elSubService) return "";
  if (elSubService.disabled) return "Choose a service first.";
  if (!elSubService.value) return "Please select a sub-service.";
  return "";
}

function validateName() {
  const v = (elName.value || "").trim();
  if (!v) return "Please enter your name.";
  if (v.length < 2) return "Name should be at least 2 characters.";
  return "";
}

function validateEmail() {
  const v = (elEmail.value || "").trim();
  if (!v) return "Please enter your email.";
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!ok) return "Enter a valid email address.";
  return "";
}

function validatePhone() {
  const v = (elPhone.value || "").trim();
  if (!v) return "Please enter your phone number.";
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7) return "Enter a valid phone number.";
  return "";
}

function validateBudget() {
  if (!elBudget || elBudget.value) return "";
  return "Please select your budget range.";
}

function validateMessage() {
  const v = (elMessage.value || "").trim();
  if (!v) return "Please enter your project description.";
  if (v.length < 20) return "Project description should be at least 20 characters.";
  return "";
}

function showFieldError(input, errEl, msg) {
  if (!input || !errEl) return;
  if (msg) {
    input.classList.add("is-invalid");
    errEl.textContent = msg;
  } else {
    input.classList.remove("is-invalid");
    errEl.textContent = "";
  }
}

function wireRealtimeValidation() {
  if (elService) {
    elService.addEventListener("change", () => showFieldError(elService, errService, validateService()));
  }
  if (elSubService) {
    elSubService.addEventListener("change", () => showFieldError(elSubService, errSubService, validateSubService()));
  }
  if (elName) {
    elName.addEventListener("input", () => showFieldError(elName, errName, validateName()));
    elName.addEventListener("blur", () => showFieldError(elName, errName, validateName()));
  }
  if (elEmail) {
    elEmail.addEventListener("input", () => showFieldError(elEmail, errEmail, validateEmail()));
    elEmail.addEventListener("blur", () => showFieldError(elEmail, errEmail, validateEmail()));
  }
  if (elPhone) {
    elPhone.addEventListener("input", () => showFieldError(elPhone, errPhone, validatePhone()));
    elPhone.addEventListener("blur", () => showFieldError(elPhone, errPhone, validatePhone()));
  }
  if (elBudget) {
    elBudget.addEventListener("change", () => showFieldError(elBudget, errBudget, validateBudget()));
  }
  if (elMessage) {
    elMessage.addEventListener("input", () => showFieldError(elMessage, errMessage, validateMessage()));
    elMessage.addEventListener("blur", () => showFieldError(elMessage, errMessage, validateMessage()));
  }
}
wireRealtimeValidation();

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

function buildConfirmationSummary(inquiry) {
  return [
    `Service: ${inquiry.serviceLabel}`,
    `Sub-service: ${inquiry.subService}`,
    `Phone: ${inquiry.phone}`,
    `Budget: ${inquiry.budget}`,
    inquiry.projectRef ? `Reference: ${inquiry.projectRef}` : null,
    "",
    `Project details: ${inquiry.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendThankYouEmail(inquiry) {
  if (!emailJsReady || typeof emailjs === "undefined") return;
  const { serviceId, thankYouTemplateId } = CONFIG.emailjs;
  if (serviceId.includes("YOUR_") || thankYouTemplateId.includes("YOUR_")) return;

  await emailjs.send(serviceId, thankYouTemplateId, {
    to_name: inquiry.name,
    to_email: inquiry.email,
    reply_to: inquiry.email,
    phone_number: inquiry.phone,
    budget_range: inquiry.budget,
    service_name: inquiry.serviceLabel,
    sub_service_name: inquiry.subService,
    project_reference: inquiry.projectRef,
    project_summary: inquiry.message,
    confirmation_message: `We received your ${inquiry.serviceLabel} request for ${inquiry.subService}. Our team will review it and reply shortly.`,
    message: buildConfirmationSummary(inquiry),
    subject_line: `Thanks for your ${inquiry.serviceLabel} inquiry - ToxDev`,
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

function resetDynamicFormState() {
  populateSubServiceOptions("");
  updateSelectionSummary();
  syncActiveServiceCard();
  showFieldError(elService, errService, "");
  showFieldError(elSubService, errSubService, "");
  showFieldError(elName, errName, "");
  showFieldError(elEmail, errEmail, "");
  showFieldError(elPhone, errPhone, "");
  showFieldError(elBudget, errBudget, "");
  showFieldError(elMessage, errMessage, "");
  if (projectRefField) projectRefField.value = "";
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const serviceError = validateService();
    const subServiceError = validateSubService();
    const nameError = validateName();
    const emailError = validateEmail();
    const phoneError = validatePhone();
    const budgetError = validateBudget();
    const messageError = validateMessage();

    showFieldError(elService, errService, serviceError);
    showFieldError(elSubService, errSubService, subServiceError);
    showFieldError(elName, errName, nameError);
    showFieldError(elEmail, errEmail, emailError);
    showFieldError(elPhone, errPhone, phoneError);
    showFieldError(elBudget, errBudget, budgetError);
    showFieldError(elMessage, errMessage, messageError);

    if (serviceError || subServiceError || nameError || emailError || phoneError || budgetError || messageError) {
      return;
    }

    const inquiry = {
      name: elName.value.trim(),
      email: elEmail.value.trim(),
      phone: elPhone.value.trim(),
      budget: elBudget.value,
      message: elMessage.value.trim(),
      serviceKey: elService.value,
      serviceLabel: CONTACT_SERVICES[elService.value].label,
      subService: elSubService.value,
      projectRef: projectRefField ? projectRefField.value.trim() : "",
    };

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    const payload = {
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone,
      budget: inquiry.budget,
      message: inquiry.message,
      service_key: inquiry.serviceKey,
      service_name: inquiry.serviceLabel,
      sub_service: inquiry.subService,
      project_ref: inquiry.projectRef,
      submitted_at: new Date().toISOString(),
      source: "ToxDev website",
    };

    try {
      const tasks = [];
      tasks.push(
        postToGoogleSheets(payload).catch((err) => {
          console.error("Sheets:", err);
        })
      );
      tasks.push(
        sendThankYouEmail(inquiry).catch((err) => {
          console.error("EmailJS:", err);
        })
      );
      await Promise.all(tasks);

      form.reset();
      resetDynamicFormState();
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
