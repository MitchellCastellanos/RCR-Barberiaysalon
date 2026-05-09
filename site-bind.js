// ============================================================
// site-bind.js
// Live data bindings for the main RCR Barber Shop site
// (index.html, Services.html, Contact.html). Subscribes to the
// same Firestore document used by /enlaces/ and /enlaces/admin/
// so any change made in the admin panel flows everywhere.
// ============================================================

import { subscribeData } from "./enlaces/data-store.js";

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------- Helpers ----------
function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m === 0 ? "00" : String(m).padStart(2, "0");
  return `${h12}:${mm}${period}`;
}

function fmtPriceMxn(p) {
  if (p == null || p === "") return "—";
  const n = Number(p);
  if (Number.isNaN(n)) return String(p);
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildWa(phone, msg) {
  const num = String(phone || "").replace(/[^\d]/g, "");
  if (!num) return "#";
  const t = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${num}${t}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Day grouping for Hours ----------
const DAY_NAMES_LONG = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function groupConsecutiveHours(hours) {
  // Order: Mon → Sat → Sun (typical Mexican shop layout).
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups = [];
  let cur = null;
  for (const d of order) {
    const h = hours[d];
    const key = (h && !h.closed && h.open && h.close) ? `${h.open}-${h.close}` : "closed";
    if (cur && cur.key === key) {
      cur.days.push(d);
    } else {
      if (cur) groups.push(cur);
      cur = { key, days: [d], hours: h };
    }
  }
  if (cur) groups.push(cur);
  return groups;
}

function formatDayRange(days) {
  // Days are passed in week-order. Show as "Lunes" or "Lunes – Miércoles".
  if (days.length === 1) return DAY_NAMES_LONG[days[0]];
  return `${DAY_NAMES_LONG[days[0]]} – ${DAY_NAMES_LONG[days[days.length - 1]]}`;
}

// ---------- Bindings ----------
function applyTextBindings(data) {
  const map = {
    businessName:    data.business?.name,
    tagline:         data.business?.tagline,
    location:        data.business?.location,
    established:     data.business?.established,
    rating:          data.business?.rating,
    instagramHandle: data.links?.instagramHandle,
    websiteLabel:    data.links?.websiteLabel,
  };
  Object.entries(map).forEach(([key, val]) => {
    if (val == null || val === "") return;
    $$(`[data-bind="${key}"]`).forEach(el => { el.textContent = val; });
  });
}

function applyLinkBindings(data) {
  const links = data.links || {};
  const waBooking = buildWa(links.whatsapp, links.whatsappBookingMessage);
  const waLadies  = buildWa(links.whatsapp, "Hola RCR, quiero agendar un servicio para dama");
  const waGeneric = buildWa(links.whatsapp, links.whatsappGenericMessage);

  const linkMap = {
    bookingCta:       waBooking,
    bookingLadiesCta: waLadies,
    whatsapp:         waGeneric,
    instagram:        links.instagram,
    facebook:         links.facebook,
    website:          links.website,
    maps:             links.maps,
    reviewForm:       links.reviewForm,
  };
  Object.entries(linkMap).forEach(([key, href]) => {
    if (!href) return;
    $$(`[data-link="${key}"]`).forEach(el => el.setAttribute("href", href));
  });
}

// ---------- Section renderers ----------
function renderPriceTable(data) {
  const tbody = $('[data-section="prices"]');
  if (!tbody) return;
  const services = (data.services || [])
    .filter(s => s && s.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (services.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center text-secondary py-3">Próximamente.</td></tr>`;
    return;
  }
  tbody.innerHTML = services.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}${s.description ? `<br><small class="text-secondary">${escapeHtml(s.description)}</small>` : ""}</td>
      <td>${escapeHtml(fmtPriceMxn(s.price))}</td>
    </tr>
  `).join("");
}

function renderHoursList(data) {
  const container = $('[data-section="hours"]');
  if (!container) return;
  const groups = groupConsecutiveHours(data.hours || {});
  container.innerHTML = groups.map(g => {
    const dayLabel = formatDayRange(g.days);
    const hoursLabel = g.key === "closed"
      ? `<span class="text-danger fw-semibold">Cerrado</span>`
      : `${fmtTime(g.hours.open)} - ${fmtTime(g.hours.close)}`;
    return `
      <div class="list-group-item bg-dark text-white d-flex justify-content-between border-warning">
        <span><b>${escapeHtml(dayLabel)}</b></span>
        <span>${hoursLabel}</span>
      </div>
    `;
  }).join("");
}

function renderHomeGallery(data) {
  const viewer = document.getElementById("viewer");
  const thumbs = document.getElementById("thumbs");
  const counter = document.getElementById("counter");
  const gallerySection = document.querySelector(".gallery");
  if (!viewer || !thumbs) return;

  const items = (data.gallery || [])
    .filter(g => g && g.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (items.length === 0) {
    if (gallerySection) gallerySection.style.display = "none";
    return;
  }
  if (gallerySection) gallerySection.style.display = "";

  viewer.innerHTML = items.map((g, i) =>
    `<img src="${escapeHtml(g.url)}" alt="${escapeHtml(g.alt || `Foto ${i + 1}`)}" loading="lazy">`
  ).join("");
  thumbs.innerHTML = items.map((g, i) =>
    `<img src="${escapeHtml(g.url)}" data-i="${i}" alt="${escapeHtml(g.alt || `thumb ${i + 1}`)}" loading="lazy">`
  ).join("");
  if (counter) counter.textContent = `1 / ${items.length}`;

  // Re-init the carousel logic that lives on index.html.
  if (typeof window.__initCarousel === "function") window.__initCarousel();
}

// ---------- Boot ----------
let lastData = null;

subscribeData((data) => {
  lastData = data;
  applyTextBindings(data);
  applyLinkBindings(data);
  renderPriceTable(data);
  renderHoursList(data);
  renderHomeGallery(data);
});

// Re-export a minimal helper so pages can opt into refresh on focus.
window.__rcrLastData = () => lastData;
