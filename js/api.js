/* =========================================================
   CanastaClara — capa de datos (PRODUCCIÓN)
   Pull: Open Food Facts Search-a-licious / producto v2 + Socrata (INVIMA) vía proxy
         serverless en Vercel (Node.js) con User-Agent:
         canastaclara/1.2 (juan.gutierreztor@cun.edu.co)
   Todas las consultas usan el proxy del mismo origen en Vercel.
   Post: reportes ciudadanos (localStorage, solo este navegador)
   ========================================================= */
"use strict";

/* ---------------- Configuración ---------------- */
const API_CONFIG = {
  timeoutMs: 12000,
};

/* ---------------- Fetch base ---------------- */
class ApiError extends Error {
  constructor(message, o = {}) {
    super(message);
    this.name = "ApiError";
    this.status = o.status || 0;
    this.code = o.code || "";
    this.via = o.via || "";
  }
}

async function fetchJSON(url, { timeout = API_CONFIG.timeoutMs, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: Object.assign({ "Accept": "application/json" }, headers),
    });
    if (!res.ok) {
      let info = null;
      try { info = await res.json(); } catch { /* noop */ }
      throw new ApiError((info && info.error && info.error.message) || ("HTTP " + res.status), {
        status: res.status,
        code: (info && info.error && info.error.code) || "",
      });
    }
    return await res.json();
  } finally { clearTimeout(t); }
}

function proxyUrl(path, params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const qs = usp.toString();
  return path + (qs ? "?" + qs : "");
}

async function apiGet(path, params) {
  return fetchJSON(proxyUrl(path, params));
}

/* ---------------- Open Food Facts ---------------- */
const OFF = {
  /* Búsqueda de texto completo */
  async search(query, { page = 1, colombiaOnly = false, pageSize = 24 } = {}) {
    const d = await apiGet("/api/search",
      { q: query, page, pageSize, colombiaOnly: colombiaOnly ? 1 : 0 });
    return { products: d.products || [], count: d.count || 0, page: d.page || page, pageSize: d.page_size || pageSize };
  },

  /* Explorar por categoría */
  async byCategory(tag, { page = 1, colombiaOnly = true, pageSize = 24 } = {}) {
    const d = await apiGet("/api/category",
      { tag, page, pageSize, colombiaOnly: colombiaOnly ? 1 : 0 });
    return { products: d.products || [], count: d.count || 0, page, pageSize };
  },

  /* Producto por código de barras */
  async product(code) {
    const d = await apiGet("/api/product", { code });
    if (!d.product || d.status === 0) return null;
    return d.product;
  },
};

/* ---------------- Socrata / datos.gov.co (INVIMA) ---------------- */
const DS = {
  REGISTROS: "ui32-p9f2",        // RS y NSO vigentes y vencidas (Dirección de Alimentos y Bebidas)
  ESTABLECIMIENTOS: "uhs6-qp53"  // Establecimientos vigilados (concepto sanitario)
};

const INVIMA = {
  async _get(params) {
    return apiGet("/api/invima", params);
  },

  async registros(texto, limit = 60) {
    return this._get({ds: DS.REGISTROS, q: texto, limit, mode: 'search'});
  },
  async registrosPorTitular(titular, limit = 120) {
    return this._get({ds: DS.REGISTROS, q: titular, limit, mode: 'holder'});
  },
  async establecimientos(razon, limit = 40) {
    return this._get({ds: DS.ESTABLECIMIENTOS, q: razon, limit});
  },
  async conteoRegistros(titular) {
    return this._get({ds: DS.REGISTROS, q: titular, mode: 'count'});
  }
};

/* ---------------- Utilidades de análisis ---------------- */
function extractAdditives(product) {
  const tags = product.additives_tags || [];
  const out = [];
  const seen = new Set();
  for (const tag of tags) {
    const code = tag.replace(/^en:/, "").toLowerCase();
    const num = code.match(/^e?(\d{3,4}[a-z]?)/);
    if (!num) continue;
    const key = "e" + num[1];
    if (seen.has(key)) continue;
    seen.add(key);
    const info = ADDITIVES[key];
    out.push({
      key,
      codigo: key.toUpperCase(),
      nombre: info ? info.nombre : code.replace(/-/g, " "),
      riesgo: info ? info.riesgo : "desconocido",
      info: info || null
    });
  }
  return out;
}

function extractIngredients(product) {
  if (Array.isArray(product.ingredients) && product.ingredients.length) {
    return product.ingredients
      .map(i => (i.text || "").trim())
      .filter(Boolean)
      .slice(0, 60);
  }
  const txt = product.ingredients_text_es || product.ingredients_text || "";
  return txt.split(/[,;]/).map(s => s.trim().replace(/\.$/, "")).filter(s => s.length > 1).slice(0, 60);
}

function computeSellos(product) {
  const n = product.nutriments || {};
  const isLiquid = /bebida|gaseosa|jugo|leche|líquid|liquid|drink|beverage/i.test(product.categories || "");
  const result = [];
  for (const r of SELLOS_RULES) {
    let val = n[r.nutriente];
    if (val == null) { result.push({ ...r, aplica: null }); continue; }
    if (r.factor) val = val * r.factor;
    const umbral = isLiquid
      ? (r.liquidoMg ?? r.liquidoG ?? r.liquidoKcal)
      : (r.solidoMg ?? r.solidoG ?? r.solidoKcal);
    if (umbral == null) { result.push({ ...r, aplica: null }); continue; }
    let aplica = r.min ? val > umbral : val >= umbral;
    result.push({ ...r, aplica, valor: val, unidad: r.solidoMg ? "mg" : (r.solidoKcal ? "kcal" : "g") });
  }
  const texto = ((product.ingredients_text || "") + " " + (product.ingredients_text_es || "")).toLowerCase();
  const edulc = /aspartam|sucralos|stevia|estevia|acesulfam|ciclamat|sacarin|xilit|sorbit|eritrit|edulcorant/i.test(texto)
    || extractAdditives(product).some(a => ["e950","e951","e952","e954","e955","e960","e967","e420","e421"].includes(a.key));
  const cafeina = /cafe[ií]na|caffeine|café taurina|taurina|guaraná|guarana/i.test(texto) || (n.caffeine_100g || 0) > 0;
  result.push({ id:"edulcorantes", sello:"CONTIENE EDULCORANTES", aplica: edulc, unidad:"", valor:null });
  result.push({ id:"cafeina", sello:"CONTIENE CAFEÍNA", aplica: cafeina, unidad:"", valor:null, extra:"Evitar en niños" });
  return result;
}

function companyScore(establecimientos, conteo) {
  let score = 60;
  const conceptos = [];
  for (const e of establecimientos || []) {
    const c = (e.concepto_sanitario_vigente || "").toUpperCase();
    if (!c) continue;
    conceptos.push(c);
    if (c.includes("DESFAVORABLE")) score -= 35;
    else if (c.includes("CONDICIONAD") || c.includes("REQUERIMIENTO")) score -= 15;
    else if (c.includes("FAVORABLE")) score += 12;
  }
  let vigentes = 0, vencidos = 0, cancelados = 0;
  for (const row of conteo || []) {
    const st = (row.estadoregistro || "").toUpperCase();
    const n = parseInt(row.total, 10) || 0;
    if (st.includes("VIGENTE")) vigentes += n;
    else if (st.includes("VENCIDO")) vencidos += n;
    else if (st.includes("CANCEL") || st.includes("SUSPEND")) cancelados += n;
  }
  if (vigentes > 0) score += Math.min(15, vigentes / 4);
  score -= cancelados * 10;
  if (vencidos > vigentes * 2 && vigentes < 3) score -= 12;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, conceptos, vigentes, vencidos, cancelados };
}

function scoreToRating(score, hasData) {
  if (!hasData) return { cls:"rating-sin-datos", label:"SIN DATOS INVIMA", desc:"No se encontraron establecimientos ni registros asociados en datos abiertos." };
  if (score >= 80) return { cls:"rating-favorable", label:"CONFIABLE", desc:"Conceptos sanitarios favorables y registros vigentes en el INVIMA." };
  if (score >= 55) return { cls:"rating-condicionado", label:"OBSERVACIÓN", desc:"Hallazgos parciales o registros mixtos; conviene revisar el detalle." };
  return { cls:"rating-desfavorable", label:"PRECAUCIÓN", desc:"Conceptos desfavorables o registros cancelados/vencidos predominantes." };
}

/* ---------------- Reportes ciudadanos (localStorage) ---------------- */
const REPORTS_KEY = "canastaclara_reportes_v1";
const REPORT_TYPES = [
  'Sin registro sanitario visible', 'Etiquetado engañoso o incompleto',
  'Sellos frontales ausentes/incorrectos', 'Producto vencido o en mal estado',
  'Publicidad dirigida a menores', 'Otro'
];
function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';
}
function validGTIN(code) {
  if (!/^(?:\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = [...code].map(Number), check = digits.pop();
  const sum = digits.reverse().reduce((total,n,index) => total + n * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}
function evidenceFields(rep) {
  const code = cleanText(rep.code || '', 32);
  if (code && !validGTIN(code)) throw new Error('El código de barras no tiene una longitud o dígito de control válido.');
  const observado = cleanText(rep.observado || '', 20);
  if (observado && (!/^\d{4}-\d{2}-\d{2}$/.test(observado) || !Number.isFinite(Date.parse(observado)) || new Date(observado).toISOString().slice(0,10) !== observado || observado > new Date().toISOString().slice(0,10))) throw new Error('La fecha de observación debe ser válida y no futura.');
  let evidencia = cleanText(rep.evidencia || '', 500);
  if (evidencia) {
    let url;
    try { url = new URL(evidencia); } catch { throw new Error('La evidencia debe ser un enlace HTTPS válido.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('La evidencia debe ser HTTPS sin credenciales.');
    evidencia = url.href;
  }
  return {code, observado, evidencia, lote:cleanText(rep.lote,80), lugar:cleanText(rep.lugar,200)};
}
function nutrientPercent(value, reference) {
  const v = Number(value), r = Number(reference);
  return Number.isFinite(v) && Number.isFinite(r) && r > 0 ? Math.max(0,Math.min(100,v / r * 100)) : 0;
}
function normalizeReport(rep) {
  if (!rep || typeof rep !== 'object' || Array.isArray(rep)) return null;
  const producto = cleanText(rep.producto, 120), empresa = cleanText(rep.empresa, 120);
  if (!producto || !empresa || !REPORT_TYPES.includes(rep.tipo) || !['baja','media','alta'].includes(rep.gravedad)) return null;
  return {producto, empresa, code:cleanText(rep.code,32), observado:cleanText(rep.observado,20), evidencia:cleanText(rep.evidencia,500), lote:cleanText(rep.lote,80), lugar:cleanText(rep.lugar,200), tipo:rep.tipo, gravedad:rep.gravedad, detalle:cleanText(rep.detalle, 2000),
    id:typeof rep.id === 'string' && /^[a-z0-9-]{1,64}$/i.test(rep.id) ? rep.id : '',
    fecha:typeof rep.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rep.fecha) ? rep.fecha : ''};
}
const Reports = {
  all() {
    try {
      const list = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
      return Array.isArray(list) ? list.map(normalizeReport).filter(Boolean) : [];
    }
    catch { return []; }
  },
  add(rep) {
    const evidence = evidenceFields(rep);
    rep = normalizeReport(rep);
    if (!rep) throw new Error('Revisa producto, empresa, tipo y gravedad del reporte.');
    Object.assign(rep, evidence);
    const list = Reports.all();
    if (list.length >= 100) throw new Error('Exporta tus reportes y elimina alguno antes de añadir más (máximo 100).');
    rep.id = crypto.randomUUID();
    rep.fecha = new Date().toISOString().slice(0, 10);
    list.unshift(rep);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
    return rep;
  },
  remove(id) {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(Reports.all().filter(r => r.id !== id)));
  },
  forCompany(name) {
    const t = cleanText(name, 120).toUpperCase();
    return Reports.all().filter(r => (r.empresa || "").toUpperCase().includes(t));
  },
  exportJSON() {
    const blob = new Blob([JSON.stringify(Reports.all(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "canastaclara_reportes.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
};

/* Comparador en memoria de sesión */
const CompareStore = { a: null, b: null };

/* ---------------- Helpers de formato ---------------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmt = (v, d = 1) => (v == null || isNaN(v)) ? "—" : Number(v).toFixed(d).replace(/\.0$/, "");
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}
// URL escaping alone cannot restrict schemes or third-party tracking hosts.
function safeProductImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'images.openfoodfacts.org' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
