/* ===== Profils locaux (style Netflix) + phrase secrète =====
   Chaque profil a sa propre Ma liste, sa progression « vu », ses notifications et ses réglages.
   Les données du profil actif restent dans les clés habituelles (noir.list, noir.seen…) : changer de profil échange simplement ces clés, puis recharge la page.
   Phrase secrète : 8 mots qui dérivent une clé de chiffrement. La sauvegarde en ligne (api/profile.js) ne contient que des données chiffrées, illisibles sans la phrase. */
(function () {
"use strict";
var PF_KEYS = ["noir.list", "noir.seen", "noir.resume", "noir.prefs", "noir.collections", "noir.dropped", "noir.notif.subs", "noir.notif.read", "noir.notif.gone", "noir.notif.items", "noir.notif.since"];
var PF_CLOUD_KEYS = ["noir.list", "noir.seen", "noir.resume", "noir.prefs", "noir.collections", "noir.dropped", "noir.notif.subs", "noir.notif.read", "noir.notif.gone"];   /* ce qui est sauvegardé en ligne (pas les données qui se recalculent) */
var META = "noir.profiles", CUR = "noir.pf.cur", DATA = "noir.pf.d.", SESS = "noir.pf.ok", PULLED = "noir.pf.pulled";
var WORDS = "lune soleil etoile nuage pluie neige vent orage brume aurore sable ocean vague rivage ile lac source fleuve pont mont colline foret prairie jardin verger champ sentier route tunnel phare port barque voile ancre perle corail coquille galet cristal rubis opale jade ambre onyx argent cuivre bronze fer or tigre dragon panda lapin renard loup ours cerf biche hibou aigle moineau cygne grue canard poney chat chien souris panthere lion zebre koala singe paon colibri papillon abeille fourmi grenouille tortue poisson requin dauphin baleine crabe pieuvre meduse licorne cerise pomme poire peche prune mangue ananas citron orange banane melon raisin fraise framboise myrtille noix noisette amande riz the cafe miel sucre sel poivre menthe basilic thym safran vanille cannelle gingembre ramen sushi gateau bonbon glace crepe brioche biscuit tarte pizza soupe salade fromage beurre lait chocolat fleur rose lotus iris tulipe pivoine orchidee lilas violette jasmin lavande bambou pin chene erable saule cedre palmier cactus fougere mousse lierre bruyere ruban plume ballon cadeau cloche tambour guitare piano violon flute harpe radio camera livre carnet crayon pinceau miroir lampe bougie lanterne parapluie echarpe chapeau bottes gants valise horloge boussole carte voyage fusee comete galaxie planete eclipse arcenciel tonnerre eclair flamme braise cendre volcan geyser glacier desert oasis canyon grotte falaise recif lagune delta archipel savane tundra jungle steppe plaine vallee cascade ruisseau etang marais jonc nenuphar trefle muguet coquelicot bleuet marguerite camelia glycine magnolia gardenia hibiscus azalee aube crepuscule zenith horizon mirage tempete bourrasque rosee givre grele brouillard souffle echo rythme melodie refrain ballade sonate poeme conte".split(" ");

/* ===== Avatars : personnages dessinés en SVG (aucune image à charger) ===== */
var PF_SKIN = ["#f7dcc4", "#f2c9a5", "#e6b48b", "#cf9970"];
var PF_CATS = [
  { id: "k", name: "K-Drama" }, { id: "j", name: "J-Drama" }, { id: "c", name: "C-Drama" }, { id: "t", name: "Thaï" }, { id: "b", name: "BL" }
];
/* h = coiffure, hc = couleur des cheveux, o = tenue, oc = couleur de la tenue, a = accessoires, s = peau, bg = fond (dégradé) */
var PF_AV = {
  k1: { n: "Chaebol", h: "side", hc: "#1d1a26", o: "suit", oc: "#2a2f45", ac: "#ff5d8f", s: 0, bg: ["#ff7aa8", "#6c5ce7"] },
  k2: { n: "Sageuk", h: "long", hc: "#17141f", o: "hanbok", oc: "#8fd3c8", ac: "#ff7aa8", s: 0, a: ["flower"], bg: ["#ffd3a5", "#fd6585"] },
  k3: { n: "Lycée", h: "short", hc: "#2b2118", o: "sailor", oc: "#243b6b", ac: "#e8453c", s: 1, a: ["glasses"], bg: ["#7bdff2", "#7a6cff"] },
  k4: { n: "Idol", h: "spiky", hc: "#c9ccd6", o: "tee", oc: "#ff4f81", ac: "#fff", s: 0, a: ["earring"], bg: ["#232526", "#ff4f81"] },
  j1: { n: "Kimono", h: "bun", hc: "#17141f", o: "kimono", oc: "#d94f6a", ac: "#f6d365", s: 0, a: ["flower"], bg: ["#ffb7c5", "#ff7e5f"] },
  j2: { n: "Seifuku", h: "bob", hc: "#2a1c16", o: "sailor", oc: "#1f2a5a", ac: "#e8453c", s: 1, bg: ["#a1c4fd", "#c2e9fb"] },
  j3: { n: "Quotidien", h: "curly", hc: "#4a2f20", o: "hoodie", oc: "#f6a04d", ac: "#fff", s: 1, bg: ["#84fab0", "#8fd3f4"] },
  j4: { n: "Yukata", h: "long", hc: "#1a1420", o: "kimono", oc: "#4f6fd9", ac: "#ffe08a", s: 0, a: ["flower"], bg: ["#667eea", "#f093fb"] },
  c1: { n: "Hanfu", h: "bun", hc: "#15121b", o: "hanfu", oc: "#b3262e", ac: "#f6d365", s: 0, a: ["stick"], bg: ["#f6d365", "#fda085"] },
  c2: { n: "Jade", h: "long", hc: "#17141f", o: "hanfu", oc: "#2f9e8f", ac: "#e9fff8", s: 0, a: ["stick"], bg: ["#11998e", "#38ef7d"] },
  c3: { n: "Général", h: "topknot", hc: "#14111a", o: "hanfu", oc: "#1f2430", ac: "#d6a84a", s: 2, bg: ["#434343", "#c9a14a"] },
  c4: { n: "Moderne", h: "bob", hc: "#1b1620", o: "blazer", oc: "#5a2a8a", ac: "#ff8fb8", s: 0, a: ["earring"], bg: ["#fbc2eb", "#a6c1ee"] },
  t1: { n: "Jasmin", h: "long", hc: "#1c1410", o: "kimono", oc: "#f2a65a", ac: "#fff", s: 2, a: ["jasmine"], bg: ["#43e97b", "#38f9d7"] },
  t2: { n: "Campus", h: "side", hc: "#201710", o: "uniform", oc: "#ffffff", ac: "#2d4fa8", s: 2, bg: ["#4facfe", "#00f2fe"] },
  t3: { n: "Doré", h: "bun", hc: "#18110c", o: "hanbok", oc: "#d8a33c", ac: "#7a1f3d", s: 2, a: ["crown"], bg: ["#f83600", "#f9d423"] },
  t4: { n: "Chill", h: "short", hc: "#241912", o: "tee", oc: "#2dc5a0", ac: "#fff", s: 3, bg: ["#0ba360", "#3cba92"] },
  b1: { n: "Duo", duo: true, bg: ["#8b5cf6", "#ff6fb5"] },
  b2: { n: "Rainbow", h: "curly", hc: "#2e1e3d", o: "tee", oc: "#ff6fb5", ac: "#fff", s: 1, a: ["rainbow"], bg: ["#6a11cb", "#2575fc"] },
  b3: { n: "Pull", h: "side", hc: "#3a2a22", o: "hoodie", oc: "#8b5cf6", ac: "#fff", s: 0, a: ["glasses"], bg: ["#2b1055", "#7597de"] },
  b4: { n: "Coeur", h: "spiky", hc: "#e6d9ff", o: "blazer", oc: "#241a3f", ac: "#ff6fb5", s: 0, a: ["hearts"], bg: ["#0f0c29", "#8b5cf6"] }
};
var PF_AVORDER = Object.keys(PF_AV);

function pfShade(hex, p) {   /* éclaircit (p>0) ou assombrit (p<0) une couleur #rrggbb */
  var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  var f = function (x) { return Math.max(0, Math.min(255, Math.round(p < 0 ? x * (1 + p) : x + (255 - x) * p))); };
  return "#" + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}
function pfPerson(c) {
  var skin = PF_SKIN[c.s || 0], dk = pfShade(skin, -.12), hair = c.hc || "#1d1a26", oc = c.oc || "#444", ac = c.ac || "#fff", o = [];
  var back = "", front = "", acc = "", a = c.a || [];
  /* cheveux derrière la tête */
  if (c.h === "long") back = '<path d="M26 40C24 12 76 12 74 40L77 80C77 87 65 87 64 80L64 46L36 46L36 80C35 87 23 87 23 80Z" fill="' + hair + '"/>';
  if (c.h === "bob") back = '<path d="M27 40C25 13 75 13 73 40L73 62C73 67 66 67 66 62L66 44L34 44L34 62C34 67 27 67 27 62Z" fill="' + hair + '"/>';
  if (c.h === "bun") back = '<circle cx="50" cy="15" r="9" fill="' + hair + '"/>';
  if (c.h === "topknot") back = '<ellipse cx="50" cy="14" rx="6" ry="7" fill="' + hair + '"/>';
  /* tenue */
  var body = '<path d="M10 100C10 78 30 69 50 69C70 69 90 78 90 100Z" fill="' + oc + '"/>';
  var fx = "";
  if (c.o === "suit" || c.o === "blazer") {
    fx = '<path d="M38 70L50 90L62 70Z" fill="#fff"/><path d="M38 70L47 100L30 100Z" fill="' + pfShade(oc, -.25) + '"/><path d="M62 70L53 100L70 100Z" fill="' + pfShade(oc, -.25) + '"/>' +
      (c.o === "suit" ? '<path d="M48 76H52L53.5 92L50 97L46.5 92Z" fill="' + ac + '"/>' : '<circle cx="66" cy="84" r="3" fill="' + ac + '"/>');
  } else if (c.o === "tee") {
    fx = '<path d="M40 69Q50 80 60 69" fill="' + pfShade(skin, -.05) + '" stroke="' + pfShade(oc, -.3) + '" stroke-width="2"/>';
  } else if (c.o === "hoodie") {
    fx = '<path d="M34 72Q50 64 66 72L66 78Q50 88 34 78Z" fill="' + pfShade(oc, -.2) + '"/><path d="M46 82L45 96M54 82L55 96" stroke="' + ac + '" stroke-width="2" stroke-linecap="round"/>';
  } else if (c.o === "hanbok") {
    fx = '<path d="M36 70L50 94L64 70L58 69L50 84L42 69Z" fill="#fff"/><path d="M50 86Q42 94 40 100L46 100Q48 94 53 89Z" fill="' + ac + '"/>';
  } else if (c.o === "kimono") {
    fx = '<path d="M33 72L58 100L50 100L28 78Z" fill="#fff"/><path d="M67 72L48 100L56 100L72 78Z" fill="' + pfShade(oc, -.2) + '"/><rect x="10" y="90" width="80" height="10" fill="' + ac + '"/>';
  } else if (c.o === "hanfu") {
    fx = '<path d="M34 70L50 96L66 70" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M38 70L50 90L62 70" fill="none" stroke="' + ac + '" stroke-width="3" stroke-linejoin="round"/>';
  } else if (c.o === "sailor") {
    fx = '<path d="M30 74L50 70L70 74L62 92L50 80L38 92Z" fill="#fff"/><path d="M33 76L50 73L67 76" fill="none" stroke="' + oc + '" stroke-width="2"/><path d="M46 84L50 80L54 84L52 92L48 92Z" fill="' + ac + '"/>';
  } else if (c.o === "uniform") {
    fx = '<path d="M40 69L50 82L60 69Z" fill="#fff"/><rect x="62" y="80" width="14" height="6" rx="1" fill="' + ac + '"/><path d="M44 70L50 80L56 70" fill="none" stroke="' + pfShade(oc, -.2) + '" stroke-width="2"/>';
  }
  o.push(body, fx);
  o.push('<rect x="44" y="58" width="12" height="15" rx="5" fill="' + dk + '"/>');
  o.push(back);
  o.push('<circle cx="31" cy="46" r="3.4" fill="' + skin + '"/><circle cx="69" cy="46" r="3.4" fill="' + skin + '"/>');
  o.push('<ellipse cx="50" cy="44" rx="19" ry="21" fill="' + skin + '"/>');
  /* frange */
  var cap = "M30 45C27 22 40 17 50 17C60 17 73 22 70 45C66 36 62 30 50 30C38 30 34 36 30 45Z";
  if (c.h === "side") front = '<path d="M30 45C26 22 44 15 57 19C69 22 73 33 70 45C66 34 52 28 41 34C35 37 32 41 30 45Z" fill="' + hair + '"/>';
  else if (c.h === "bob" || c.h === "long") front = '<path d="M30 44C32 28 43 25 50 27C58 25 68 28 70 44C62 35 40 35 30 44Z" fill="' + hair + '"/>';
  else if (c.h === "curly") front = '<path d="' + cap + '" fill="' + hair + '"/>' + [[35, 29], [44, 23], [56, 23], [65, 29], [30, 38], [70, 38], [50, 20]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7.5" fill="' + hair + '"/>'; }).join("");
  else if (c.h === "spiky") front = '<path d="M30 45L27 28L37 32L39 17L48 28L54 15L60 28L70 19L68 33L71 45C66 36 60 32 50 32C40 32 34 36 30 45Z" fill="' + hair + '"/>';
  else front = '<path d="' + cap + '" fill="' + hair + '"/>';
  o.push(front);
  /* visage */
  o.push('<ellipse cx="40.5" cy="46" rx="1.9" ry="2.5" fill="#241a1a"/><ellipse cx="59.5" cy="46" rx="1.9" ry="2.5" fill="#241a1a"/>');
  o.push('<circle cx="36" cy="52" r="4" fill="#ff8aa8" opacity=".3"/><circle cx="64" cy="52" r="4" fill="#ff8aa8" opacity=".3"/>');
  o.push('<path d="M45.5 54.5Q50 58.5 54.5 54.5" fill="none" stroke="#7a3b3b" stroke-width="1.7" stroke-linecap="round"/>');
  o.push('<path d="M36.5 41Q40.5 39 44 41M56 41Q59.5 39 63.5 41" fill="none" stroke="' + pfShade(hair, .08) + '" stroke-width="1.6" stroke-linecap="round"/>');
  /* accessoires */
  if (a.indexOf("glasses") > -1) o.push('<circle cx="40.5" cy="46" r="7" fill="none" stroke="#2a2a35" stroke-width="1.8"/><circle cx="59.5" cy="46" r="7" fill="none" stroke="#2a2a35" stroke-width="1.8"/><path d="M47.5 45.5Q50 44 52.5 45.5" fill="none" stroke="#2a2a35" stroke-width="1.8"/>');
  if (a.indexOf("flower") > -1) o.push('<g transform="translate(66 27)">' + [0, 72, 144, 216, 288].map(function (d) { return '<ellipse cx="0" cy="-4.6" rx="3.2" ry="4.4" fill="#ff7aa8" transform="rotate(' + d + ')"/>'; }).join("") + '<circle r="2.4" fill="#ffe08a"/></g>');
  if (a.indexOf("stick") > -1) o.push('<path d="M58 14L76 34" stroke="#f6d365" stroke-width="2.2" stroke-linecap="round"/><circle cx="58" cy="14" r="3.2" fill="#e8453c"/>');
  if (a.indexOf("earring") > -1) o.push('<circle cx="30.5" cy="53" r="2.2" fill="#ffd54a"/>');
  if (a.indexOf("jasmine") > -1) o.push([[32, 36], [37, 30], [44, 26.5], [52, 25.5], [60, 27], [66, 31], [69, 37]].map(function (p) { return '<g transform="translate(' + p[0] + ' ' + p[1] + ')">' + [0, 90, 180, 270].map(function (d) { return '<ellipse cx="0" cy="-2.2" rx="1.5" ry="2.4" fill="#fff" transform="rotate(' + d + ')"/>'; }).join("") + '<circle r="1" fill="#ffd54a"/></g>'; }).join(""));
  if (a.indexOf("crown") > -1) o.push('<path d="M38 26L41 17L46 23L50 14L54 23L59 17L62 26Q50 22 38 26Z" fill="#ffd54a" stroke="#c98a12" stroke-width="1"/>');
  return o.join("");
}
function pfHeart(x, y, s, col) { return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 3C-6-4 -12 3 0 12C12 3 6-4 0 3Z" fill="' + col + '"/>'; }
function pfAvatar(code, size) {
  var c = PF_AV[code] || PF_AV.k1, id = "g" + code, bg = c.bg || ["#444", "#222"], g = "";
  var inner;
  if (c.duo) {
    inner = '<g transform="translate(-2 22) scale(.78)">' + pfPerson({ h: "side", hc: "#1d1a26", o: "suit", oc: "#2a2f45", ac: "#ff6fb5", s: 0 }) + '</g>' +
      '<g transform="translate(34 22) scale(.78)">' + pfPerson({ h: "short", hc: "#5a3a2a", o: "hoodie", oc: "#ffffff", ac: "#8b5cf6", s: 1, a: ["glasses"] }) + '</g>' + pfHeart(50, 18, .9, "#fff");
  } else {
    inner = pfPerson(c);
    if ((c.a || []).indexOf("hearts") > -1) inner += pfHeart(18, 22, .7, "#ff6fb5") + pfHeart(82, 30, .55, "#fff") + pfHeart(78, 12, .4, "#ff6fb5");
    if ((c.a || []).indexOf("rainbow") > -1) inner += ["#ff5d5d", "#ffc94a", "#5dd39e", "#5da8ff"].map(function (col, i) { return '<path d="M' + (66 + i * 3) + ' 24A' + (14 - i * 3) + ' ' + (14 - i * 3) + ' 0 0 1 ' + (94 - i * 3) + ' 24" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round" transform="translate(-6 -2)"/>'; }).join("");
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + (size || 100) + '" height="' + (size || 100) + '" role="img" aria-label="' + c.n + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + bg[0] + '"/><stop offset="1" stop-color="' + bg[1] + '"/></linearGradient></defs><rect width="100" height="100" fill="url(#' + id + ')"/>' + inner + '</svg>';
}

/* ===== Stockage ===== */
function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function metas() { var l = jget(META, []); return Array.isArray(l) ? l.filter(function (p) { return p && p.id && p.name; }) : []; }
function saveMetas(l) { jset(META, l); }
function curId() { try { return localStorage.getItem(CUR) || ""; } catch (e) { return ""; } }
function cur() { var id = curId(); return metas().filter(function (p) { return p.id === id; })[0] || null; }
function snapshot(keys) { var d = {}; (keys || PF_KEYS).forEach(function (k) { try { var v = localStorage.getItem(k); if (v != null) d[k] = v; } catch (e) {} }); return d; }
function applySnap(d) {
  PF_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  Object.keys(d || {}).forEach(function (k) { if (PF_KEYS.indexOf(k) > -1 && typeof d[k] === "string") { try { localStorage.setItem(k, d[k]); } catch (e) {} } });
}
function saveCur() { var id = curId(); if (id) jset(DATA + id, snapshot()); }
function rid() { var u = new Uint8Array(6); crypto.getRandomValues(u); return Array.prototype.map.call(u, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }

/* changer de profil : on range les données du profil actif, on charge celles du nouveau, puis on recharge */
function select(id) {
  var ps = metas(); if (!ps.filter(function (p) { return p.id === id; })[0]) return;
  if (id !== curId()) { saveCur(); applySnap(jget(DATA + id, {})); try { localStorage.setItem(CUR, id); } catch (e) {} }
  try { sessionStorage.setItem(SESS, "1"); sessionStorage.removeItem(PULLED); } catch (e) {}
  location.href = "/";
}
function create(name, avatar, cloud, photo) {
  var ps = metas(), p = { id: rid(), name: name, avatar: avatar, at: Date.now() };
  if (cloud) p.cloud = cloud;
  if (avatar === "me" && photo) p.photo = photo;
  if (!ps.length) { ps.push(p); saveMetas(ps); try { localStorage.setItem(CUR, p.id); } catch (e) {} return { p: p, first: true }; }   /* 1er profil : il garde les données déjà présentes sur l'appareil */
  ps.push(p); saveMetas(ps); jset(DATA + p.id, {});
  return { p: p, first: false };
}
function update(id, patch) { var ps = metas(); ps.forEach(function (p) { if (p.id === id) { Object.keys(patch).forEach(function (k) { p[k] = patch[k]; }); } }); saveMetas(ps); }
function remove(id) {
  var p = metas().filter(function (x) { return x.id === id; })[0];
  var ps = metas().filter(function (x) { return x.id !== id; }); saveMetas(ps);
  try { localStorage.removeItem(DATA + id); } catch (e) {}
  if (p && p.cloud) api("del", { id: p.cloud.id, auth: p.cloud.auth }).catch(function () {});
  if (curId() === id) {
    try { localStorage.removeItem(CUR); } catch (e) {}
    if (ps.length) { select(ps[0].id); return; }
    applySnap({}); try { sessionStorage.removeItem(SESS); } catch (e) {} location.href = "/";
  }
}

/* ===== Phrase secrète + chiffrement ===== */
function newPhrase() { var u = new Uint8Array(8); crypto.getRandomValues(u); return Array.prototype.map.call(u, function (x) { return WORDS[x]; }).join("-"); }
function normPhrase(s) {
  var w = String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/).filter(Boolean);
  return w.length === 8 && w.every(function (x) { return WORDS.indexOf(x) > -1; }) ? w.join("-") : "";
}
function hex(u) { return Array.prototype.map.call(u, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
function b64(u) { var s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function derive(phrase) {
  var enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(phrase), "PBKDF2", false, ["deriveBits"]).then(function (km) {
    return crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode("dramabym-profile-v1"), iterations: 200000, hash: "SHA-256" }, km, 768);
  }).then(function (bits) { var u = new Uint8Array(bits); return { key: b64(u.slice(0, 32)), auth: hex(u.slice(32, 64)), id: hex(u.slice(64, 88)) }; });
}
function aesKey(b) { return crypto.subtle.importKey("raw", unb64(b), "AES-GCM", false, ["encrypt", "decrypt"]); }
function encrypt(text, keyB64) {
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return aesKey(keyB64).then(function (k) { return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(text)); }).then(function (ct) {
    var c = new Uint8Array(ct), out = new Uint8Array(12 + c.length); out.set(iv, 0); out.set(c, 12); return b64(out);
  });
}
function decrypt(blob, keyB64) {
  var u = unb64(blob);
  return aesKey(keyB64).then(function (k) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, k, u.slice(12)); }).then(function (pt) { return new TextDecoder().decode(pt); });
}
function api(op, body) {
  var b = { op: op }; Object.keys(body || {}).forEach(function (k) { b[k] = body[k]; });
  return fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b), keepalive: op === "put" }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; });
  });
}
var cloudState = null;   /* null = inconnu, true / false */
function cloudOk() {
  if (cloudState !== null) return Promise.resolve(cloudState);
  if (!(window.crypto && crypto.subtle)) { cloudState = false; return Promise.resolve(false); }
  return api("ping", {}).then(function (j) { cloudState = !!(j && j.ok && j.cloud); return cloudState; }, function () { return false; });
}

/* ===== Sauvegarde en ligne (chiffrée) ===== */
function hsh(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h + ":" + s.length; }
function cloudSnapString(p) { return JSON.stringify({ name: p.name, avatar: p.avatar, photo: p.photo || "", data: snapshot(PF_CLOUD_KEYS) }); }
var syncing = false, lastPush = 0;
function pushNow(force) {
  var p = cur();
  if (!p || !p.cloud || syncing || !navigator.onLine) return Promise.resolve();
  var s = cloudSnapString(p), h = hsh(s);
  if (!force && h === p.cloud.last) return Promise.resolve();
  syncing = true; var at = Date.now();
  var payload = JSON.stringify({ v: 1, name: p.name, avatar: p.avatar, photo: p.photo || "", data: snapshot(PF_CLOUD_KEYS), at: at });
  return encrypt(payload, p.cloud.key).then(function (blob) { return api("put", { id: p.cloud.id, auth: p.cloud.auth, blob: blob, at: at }); }).then(function (r) {
    if (r && r.ok) { var c = p.cloud; c.last = h; c.at = at; update(p.id, { cloud: c }); lastPush = Date.now(); }
  }).catch(function () {}).then(function () { syncing = false; });
}
function pullBoot() {
  var p = cur(); if (!p || !p.cloud) return;
  try { if (sessionStorage.getItem(PULLED)) return; sessionStorage.setItem(PULLED, "1"); } catch (e) {}
  api("get", { id: p.cloud.id }).then(function (r) {
    if (!r || !r.ok || !r.blob) return;
    return decrypt(r.blob, p.cloud.key).then(function (txt) {
      var rem = JSON.parse(txt);
      if (!rem || (+rem.at || 0) <= (+p.cloud.at || 0)) return;                     /* rien de plus récent en ligne */
      if (hsh(cloudSnapString(p)) !== p.cloud.last) return;                          /* modifications locales non envoyées : on garde les miennes */
      applySnap(rem.data || {});
      var okAv = avValid(rem.avatar, rem.photo), np = { name: rem.name || p.name, avatar: okAv ? rem.avatar : p.avatar, photo: okAv && rem.avatar === "me" ? rem.photo : (okAv ? "" : p.photo || "") };
      var c = p.cloud; c.at = +rem.at; c.last = hsh(JSON.stringify({ name: np.name, avatar: np.avatar, photo: np.photo, data: snapshot(PF_CLOUD_KEYS) }));
      update(p.id, { name: np.name, avatar: np.avatar, photo: np.photo, cloud: c });
      location.reload();
    });
  }).catch(function () {});
}
function startSync() {
  if (!cur() || !cur().cloud) return;
  setInterval(function () { if (Date.now() - lastPush > 180000) pushNow(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (document.hidden) pushNow(); });
  window.addEventListener("pagehide", function () { pushNow(); });
  setTimeout(function () { pullBoot(); }, 1500);
  if (!cur().cloud.at) setTimeout(function () { pushNow(true); }, 4000);   /* première sauvegarde en ligne */
}

/* ===== Photos : avatars ajoutés par le Head admin (u:ID) et photo de la galerie (me) ===== */
function customAv() { try { return typeof avatarItems === "function" ? avatarItems() : []; } catch (e) { return []; } }
var PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]{20,160000}$/;
function avValid(code, photo) { code = String(code || ""); if (code === "me") return PHOTO_RE.test(String(photo || "")); if (/^u:\w+$/.test(code)) return true; return !!PF_AV[code]; }
function avHTML(code, photo, size) {
  code = String(code || "");
  if (code === "me" && PHOTO_RE.test(String(photo || ""))) return '<img src="' + photo + '" alt="" width="' + size + '" height="' + size + '">';
  if (/^u:\w+$/.test(code)) {
    var it = customAv().filter(function (x) { return x.id === code.slice(2); })[0];
    if (it) return '<img src="' + E(it.src) + '" alt="' + E(it.name || "") + '" width="' + size + '" height="' + size + '">';
  }
  return pfAvatar(PF_AV[code] ? code : "k1", size);
}
function avCatOf(code) { if (PF_AV[code]) return code.charAt(0); var it = /^u:/.test(code) ? customAv().filter(function (x) { return "u:" + x.id === code; })[0] : null; return it ? (it.cat || "x") : "k"; }

/* ===== Écran « Qui regarde ? » ===== */
var scr = null, mode = "choose", manage = false, boot = false, edit = null, selAv = "k1", selCat = "k", selPhoto = "", phraseShown = "", pending = null;
function E(s) { return typeof esc === "function" ? esc(s) : String(s).replace(/[&<>"']/g, ""); }
function avBtn(code, label) { return '<button type="button" class="pfav-opt' + (selAv === code ? " on" : "") + '" data-pf="av" data-code="' + code + '" aria-label="' + E(label) + '" title="' + E(label) + '">' + avHTML(code, "", 96) + '</button>'; }
function render() {
  if (!scr) return;
  var ps = metas(), c = curId(), h = "";
  if (mode === "choose") {
    h = '<h1 class="pftitle" id="pftitle">' + (manage ? "Gérer les profils" : ps.length ? "Qui regarde ?" : "Crée ton profil") + '</h1>';
    h += '<div class="pfgrid">' + ps.map(function (p) {
      return '<button type="button" class="pfcard' + (p.id === c ? " cur" : "") + '" data-pf="' + (manage ? "edit" : "pick") + '" data-id="' + p.id + '"><span class="pfav">' + avHTML(p.avatar, p.photo, 200) + (manage ? '<span class="pfedit" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span>' : '') + '</span><b>' + E(p.name) + '</b></button>';
    }).join("") + (ps.length < 6 ? '<button type="button" class="pfcard add" data-pf="new"><span class="pfav plus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><b>Ajouter un profil</b></button>' : '') + '</div>';
    h += '<p class="pfhint">' + (ps.length ? "Chaque profil a sa propre liste, sa progression et ses réglages." : "Un profil garde ta liste, ta progression et tes réglages. Tu peux en créer plusieurs sur le même appareil.") + '</p>';
    h += '<div class="pfactions">' + (ps.length ? '<button type="button" class="btn ghost" data-pf="manage">' + (manage ? "Terminé" : "Gérer les profils") + '</button>' : '') + '<button type="button" class="pflink" data-pf="restore">Me reconnecter avec ma phrase secrète</button></div>';
  } else if (mode === "form") {
    var cu = customAv(), catList = PF_CATS.concat(cu.some(function (x) { return (x.cat || "x") === "x"; }) ? [{ id: "x", name: "Spécial" }] : []);
    var cats = catList.map(function (k) { return '<button type="button" class="pftab' + (selCat === k.id ? " on" : "") + '" data-pf="cat" data-cat="' + k.id + '">' + k.name + '</button>'; }).join("");
    var avs = PF_AVORDER.filter(function (k) { return k.charAt(0) === selCat; }).map(function (k) { return avBtn(k, PF_AV[k].n); }).join("") +
      cu.filter(function (x) { return (x.cat || "x") === selCat; }).map(function (x) { return avBtn("u:" + x.id, x.name || "Photo"); }).join("");
    h = '<h1 class="pftitle" id="pftitle">' + (edit ? "Modifier le profil" : "Créer un profil") + '</h1><div class="pfform"><div class="pfpreview" id="pfprev">' + avHTML(selAv, selPhoto, 200) + '</div><div class="pffields">' +
      '<label class="f"><span>Nom</span><input type="text" id="pfname" maxlength="20" autocomplete="off" value="' + E(edit ? edit.name : "") + '" placeholder="Ton prénom ou pseudo"></label>' +
      '<div class="pftabs">' + cats + '</div><div class="pfavs" id="pfavs">' + avs + '</div>' +
      '<div class="pfphotorow"><label class="btn small ghost pffile">' + (selAv === "me" ? "Changer ma photo" : "Ma photo (galerie)") + '<input type="file" id="pfphoto" accept="image/*" hidden></label><span class="note">Rognée en carré, gardée sur ton appareil et dans ta sauvegarde chiffrée.</span></div><p class="note" id="pferr"></p>' +
      '<div class="row"><button type="button" class="btn" data-pf="save">' + (edit ? "Enregistrer" : "Continuer") + '</button><button type="button" class="btn ghost" data-pf="back">Annuler</button>' + (edit ? '<button type="button" class="btn danger" data-pf="del">Supprimer</button>' : '') + '</div></div></div>';
  } else if (mode === "phrase") {
    h = '<h1 class="pftitle" id="pftitle">Ta phrase secrète</h1><div class="pfform one"><p class="lead">Elle te permet de retrouver ce profil (liste, progression, réglages) sur un autre appareil, ou si tu vides ton navigateur. <b>Note-la maintenant : elle ne sera plus jamais affichée.</b></p>' +
      '<div class="pfphrase">' + phraseShown.split("-").map(function (w, i) { return '<span><i>' + (i + 1) + '</i>' + w + '</span>'; }).join("") + '</div>' +
      '<p class="note">Garde-la pour toi : quiconque la connaît peut ouvrir ton profil. Si tu la perds, la sauvegarde en ligne est impossible à récupérer.</p>' +
      '<div class="row"><button type="button" class="btn ghost" data-pf="copy">Copier la phrase</button><button type="button" class="btn" data-pf="done">J\'ai noté ma phrase</button></div></div>';
  } else if (mode === "restore") {
    h = '<h1 class="pftitle" id="pftitle">Retrouver mon profil</h1><div class="pfform one"><p class="lead">Entre ta phrase secrète (8 mots, avec ou sans tirets).</p>' +
      '<textarea id="pfphr" rows="3" class="pfta" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="lune-tigre-pivoine-..."></textarea><p class="note" id="pferr"></p>' +
      '<div class="row"><button type="button" class="btn" data-pf="dorestore">Me reconnecter</button><button type="button" class="btn ghost" data-pf="back">Retour</button></div></div>';
  }
  scr.querySelector(".pfbody").innerHTML = h;
  var ni = scr.querySelector("#pfname"); if (ni && !edit && !ni.value) ni.focus();
}
function setErr(m, ok) { var e = scr && scr.querySelector("#pferr"); if (e) { e.textContent = m || ""; e.style.color = ok ? "var(--grn)" : ""; } }
function open(m, opts) {
  opts = opts || {}; boot = !!opts.boot; manage = false; edit = null; mode = m || (metas().length ? "choose" : "choose");
  if (!scr) {
    scr = document.createElement("div"); scr.className = "pfscreen"; scr.id = "pfscreen"; scr.setAttribute("role", "dialog"); scr.setAttribute("aria-modal", "true"); scr.setAttribute("aria-labelledby", "pftitle");
    scr.innerHTML = '<button type="button" class="pfclose" data-pf="close" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="pfbody"></div>';
    document.body.appendChild(scr); scr.addEventListener("click", onClick); scr.addEventListener("input", onInput); scr.addEventListener("change", onChange);
  }
  scr.classList.toggle("noclose", boot); document.documentElement.classList.add("pfopen");
  cloudOk(); render();
}
function close() { if (scr) { scr.remove(); scr = null; } document.documentElement.classList.remove("pfopen"); }
function onChange(e) {
  if (e.target.id !== "pfphoto") return;
  var f = e.target.files && e.target.files[0]; e.target.value = "";
  if (!f) return;
  if (typeof cropToJpeg !== "function") { setErr("Photo indisponible sur ce navigateur"); return; }
  setErr("");
  cropToJpeg(f, 256, .85).then(function (d) {
    if (!PHOTO_RE.test(d)) throw new Error("Photo trop lourde");
    selPhoto = d; selAv = "me";
    var pv = scr && scr.querySelector("#pfprev"); if (pv) pv.innerHTML = avHTML(selAv, selPhoto, 200);
    scr.querySelectorAll(".pfav-opt").forEach(function (b) { b.classList.remove("on"); });
    var lb = scr.querySelector(".pffile"); if (lb) lb.firstChild.nodeValue = "Changer ma photo";
  }).catch(function (er) { setErr(er && er.message ? er.message : "Impossible de lire cette image"); });
}
function onInput(e) { if (e.target.id === "pfname") setErr(""); }
function startForm(p) { edit = p || null; selAv = p && avValid(p.avatar, p.photo) ? p.avatar : PF_AVORDER[Math.floor(Math.random() * PF_AVORDER.length)]; selPhoto = p && p.photo ? p.photo : ""; selCat = avCatOf(selAv); mode = "form"; render(); }
function onClick(e) {
  var t = e.target.closest ? e.target.closest("[data-pf]") : null; if (!t) return;
  var a = t.dataset.pf, ps = metas();
  if (a === "close") { if (!boot) close(); }
  else if (a === "pick") select(t.dataset.id);
  else if (a === "manage") { manage = !manage; render(); }
  else if (a === "edit") startForm(ps.filter(function (p) { return p.id === t.dataset.id; })[0]);
  else if (a === "new") startForm(null);
  else if (a === "restore") { mode = "restore"; render(); }
  else if (a === "back") { mode = "choose"; edit = null; render(); }
  else if (a === "cat") { selCat = t.dataset.cat; var f = scr.querySelector("#pfname"), v = f ? f.value : ""; render(); var f2 = scr.querySelector("#pfname"); if (f2) f2.value = v; }
  else if (a === "av") { selAv = t.dataset.code; scr.querySelector("#pfprev").innerHTML = avHTML(selAv, selPhoto, 200); var lb2 = scr.querySelector(".pffile"); if (lb2) lb2.firstChild.nodeValue = selPhoto ? "Ma photo (galerie)" : "Ma photo (galerie)"; scr.querySelectorAll(".pfav-opt").forEach(function (b) { b.classList.toggle("on", b.dataset.code === selAv); }); }
  else if (a === "save") saveForm();
  else if (a === "del") { if (edit && window.confirm("Supprimer le profil « " + edit.name + " » ? Sa liste, sa progression et ses réglages seront effacés de cet appareil" + (edit.cloud ? " et de la sauvegarde en ligne." : "."))) remove(edit.id); }
  else if (a === "copy") { try { navigator.clipboard.writeText(phraseShown).then(function () { toast("Phrase copiée"); }, function () { toast("Copie impossible : note-la à la main"); }); } catch (er) { toast("Copie impossible : note-la à la main"); } }
  else if (a === "done") { var pd = pending; pending = null; phraseShown = ""; if (pd) { close(); if (pd.first) { paintBtn(); toast("Profil créé"); startSync(); pushNow(true); } else select(pd.p.id); } }
  else if (a === "dorestore") doRestore();
}
function saveForm() {
  var n = (scr.querySelector("#pfname").value || "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!n) { setErr("Donne un nom à ton profil"); return; }
  if (metas().some(function (p) { return p.name.toLowerCase() === n.toLowerCase() && (!edit || p.id !== edit.id); })) { setErr("Un profil porte déjà ce nom"); return; }
  if (selAv === "me" && !PHOTO_RE.test(selPhoto)) { setErr("Choisis une photo ou un avatar"); return; }
  var ph = selAv === "me" ? selPhoto : "";
  if (edit) { update(edit.id, { name: n, avatar: selAv, photo: ph }); edit = null; mode = "choose"; paintBtn(); render(); if (cur() && cur().cloud) pushNow(true); return; }
  var btn = scr.querySelector('[data-pf="save"]'); btn.disabled = true;
  cloudOk().then(function (ok) {
    if (!ok) { var r = create(n, selAv, null, ph); paintBtn(); if (r.first) { close(); toast("Profil créé (sauvegarde en ligne indisponible)"); } else select(r.p.id); return; }
    setErr("Création en cours…", true);
    var phrase = newPhrase();
    return derive(phrase).then(function (d) {
      var r = create(n, selAv, { id: d.id, auth: d.auth, key: d.key, at: 0, last: "" }, ph);
      phraseShown = phrase; pending = r; mode = "phrase"; render();
      if (!r.first) { /* le nouveau profil démarre à vide : sa 1re sauvegarde se fera à son ouverture */ }
    });
  }).catch(function () { btn.disabled = false; setErr("Impossible de créer le profil. Réessaie."); });
}
function doRestore() {
  var raw = scr.querySelector("#pfphr").value, ph = normPhrase(raw);
  if (!ph) { setErr("La phrase doit contenir 8 mots de la liste. Vérifie l'orthographe."); return; }
  var btn = scr.querySelector('[data-pf="dorestore"]'); btn.disabled = true; setErr("Recherche de ton profil…", true);
  cloudOk().then(function (ok) {
    if (!ok) throw new Error("off");
    return derive(ph).then(function (d) {
      return api("get", { id: d.id }).then(function (r) {
        if (!r || !r.ok || !r.blob) throw new Error("none");
        return decrypt(r.blob, d.key).then(function (txt) {
          var rem = JSON.parse(txt), ps = metas(), ex = ps.filter(function (p) { return p.cloud && p.cloud.id === d.id; })[0];
          var av = avValid(rem.avatar, rem.photo) ? rem.avatar : "k1", phRem = av === "me" ? rem.photo : "";
          saveCur();
          var cloud = { id: d.id, auth: d.auth, key: d.key, at: +rem.at || 0, last: "" };
          var id;
          if (ex) { id = ex.id; update(id, { name: rem.name || ex.name, avatar: av, photo: phRem, cloud: cloud }); }
          else {
            var nm = String(rem.name || "Profil").slice(0, 20), base = nm, i = 2;
            while (ps.some(function (p) { return p.name.toLowerCase() === nm.toLowerCase(); })) nm = (base.slice(0, 17) + " " + i++);
            var pr = { id: rid(), name: nm, avatar: av, photo: phRem, at: Date.now(), cloud: cloud }; ps.push(pr); saveMetas(ps); id = pr.id;
          }
          var data = rem.data || {}; var keep = {}; PF_KEYS.forEach(function (k) { if (typeof data[k] === "string") keep[k] = data[k]; });
          jset(DATA + id, keep);
          cloud.last = hsh(JSON.stringify({ name: rem.name || ex && ex.name || "", avatar: av, photo: phRem, data: keep }));
          update(id, { cloud: cloud });
          select(id);
        }, function () { throw new Error("bad"); });
      });
    });
  }).catch(function (er) {
    btn.disabled = false;
    setErr(er && er.message === "none" ? "Aucune sauvegarde trouvée pour cette phrase." : er && er.message === "bad" ? "Phrase incorrecte." : er && er.message === "off" ? "La sauvegarde en ligne n'est pas disponible pour l'instant." : "Connexion impossible. Réessaie.");
  });
}

/* ===== Bouton du haut ===== */
var PERSON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2.2c-3.6 0-8 1.8-8 5.3V21h16v-1.5c0-3.5-4.4-5.3-8-5.3z"/></svg>';
function paintBtn() {
  var p = cur(), ok = !!(p && avValid(p.avatar, p.photo));
  var b = document.getElementById("pfbtn");
  if (b) { b.innerHTML = ok ? avHTML(p.avatar, p.photo, 44) : PERSON; b.classList.toggle("has", ok); b.title = p ? "Profil : " + p.name : "Profils"; b.setAttribute("aria-label", b.title); }
  var t = document.getElementById("pftab");
  if (t) { var av = t.querySelector(".tabav"); if (av) { av.innerHTML = ok ? avHTML(p.avatar, p.photo, 44) : PERSON; av.classList.toggle("has", ok); } var lb = t.querySelector(".tablb"); if (lb) lb.textContent = p ? p.name.slice(0, 9) : "Profil"; }
}
function init() {
  var ps = metas(), id = curId();
  if (ps.length && !ps.filter(function (p) { return p.id === id; })[0]) { try { localStorage.setItem(CUR, ps[0].id); } catch (e) {} }
  ["pfbtn", "pftab"].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener("click", function () { open("choose"); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && scr && !boot) close(); });
  paintBtn();
  var asked = false; try { asked = !!sessionStorage.getItem(SESS); } catch (e) {}
  if (ps.length >= 2 && !asked) open("choose", { boot: true });
  else try { sessionStorage.setItem(SESS, "1"); } catch (e) {}
  startSync();
}
window.PF = { open: open, current: cur, list: metas, refresh: function () { paintBtn(); if (scr && mode === "choose") render(); } };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
