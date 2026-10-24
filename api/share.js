/* Aperçus de partage (Discord, WhatsApp, Telegram, Twitter/X, Messenger…).
   Ces applis ne lisent pas le JavaScript du site : elles lisent seulement le HTML renvoyé par le serveur.
   Cette fonction n'est appelée QUE pour ces robots (voir vercel.json). Les visiteurs normaux ne passent jamais ici.
   Elle reprend ton index.html tel quel et remplace seulement les balises d'aperçu (titre, description, image).
   Si quoi que ce soit échoue, elle renvoie ton index.html sans rien changer : le site ne casse jamais. */

const IMAGE_PAR_DEFAUT = "/dbm.png?v=2";

/* ===== Textes des pages (modifie-les ici comme tu veux) ===== */
const PAGES = {
  "/":            { titre: "DramaByM", desc: "Ton répertoire de dramas, séries et films à regarder en streaming ou à télécharger, avec les nouveaux épisodes toujours à jour." },
  "/series":      { titre: "Séries · DramaByM", desc: "Toutes les séries et dramas du répertoire DramaByM : filtre par langue, plateforme ou genre et lance ton prochain épisode." },
  "/films":       { titre: "Films · DramaByM", desc: "Tous les films du répertoire DramaByM, à regarder en streaming ou à télécharger." },
  "/calendrier":  { titre: "Calendrier · DramaByM", desc: "Les prochains épisodes de la semaine : ne rate aucune sortie de tes dramas préférés." },
  "/ma-liste":    { titre: "Ma liste · DramaByM", desc: "Ta liste perso sur DramaByM : tes titres à voir, ceux que tu as aimés et ta progression." },
  "/demande":     { titre: "Faire une demande · DramaByM", desc: "Il manque un titre au répertoire ? Demande-le ici, en streaming ou en téléchargement, et il sera ajouté dès que possible." },
  "/demandes":    { titre: "Demandes en cours · DramaByM", desc: "Les titres demandés par la communauté, en streaming ou en téléchargement, et où ils en sont. Plus un titre est demandé, plus il passe vite." },
  "/parametres":  { titre: "Paramètres · DramaByM", desc: "Règle ton expérience sur DramaByM : langue, lecteur, notifications et affichage." }
};
/* ===== Bannières par page (fichiers à la racine du projet) ===== */
const IMAGES = {
  "/": "/dbm-accueil.png?v=1",
  "/series": "/dbm-series.png?v=1",
  "/films": "/dbm-films.png?v=1",
  "/calendrier": "/dbm-calendrier.png?v=1",
  "/ma-liste": "/dbm-ma-liste.png?v=1",
  "/demande": "/dbm-demande.png?v=1",
  "/demandes": "/dbm-demandes.png?v=1",
  "/parametres": "/dbm-parametres.png?v=1"
};
const PAGES_BL = {
  "/": { titre: "BL · DramaByM", desc: "L'espace BL de DramaByM : tous les dramas et films BL à regarder en streaming, avec les nouveaux épisodes toujours à jour." },
  "/series": { titre: "Séries BL · DramaByM", desc: "Toutes les séries BL du répertoire DramaByM : lance ton prochain épisode." },
  "/films": { titre: "Films BL · DramaByM", desc: "Tous les films BL du répertoire DramaByM, à regarder en streaming." }
};
const TEXTE_RECHERCHE = (q) => ({ titre: "« " + q + " » · DramaByM", desc: "Résultats de recherche pour « " + q + " » dans le répertoire DramaByM." });
const TEXTE_ACTEUR = (n, titres) => ({
  titre: n + " · DramaByM",
  desc: titres && titres.length
    ? coupe("Les titres avec " + n + " sur DramaByM : " + titres.slice(0, 4).join(", ") + (titres.length > 4 ? " et " + (titres.length - 4) + " autre" + (titres.length - 4 > 1 ? "s" : "") : "") + ".", 240)
    : "Les titres avec " + n + " disponibles sur DramaByM."
});

/* ligne d'infos d'une fiche : « Série · 2 saisons · 16 épisodes · ★ 8.5 · Romance / Drame » */
function infosFiche(s) {
  const film = s.type === "movie";
  const saisons = Array.isArray(s.seasons) ? s.seasons : [];
  let eps = 0; saisons.forEach((se) => { eps += (se.episodes || []).length; });
  const p = [film ? "Film" : "Série"];
  if (film && s.runtime) p.push(s.runtime + " min");
  if (!film && saisons.length > 1) p.push(saisons.length + " saisons");
  if (!film && eps) p.push(eps + (eps > 1 ? " épisodes" : " épisode"));
  if (s.rating) p.push("★ " + s.rating);
  if (Array.isArray(s.genres) && s.genres.length) p.push(s.genres.slice(0, 3).join(" / "));
  return p.join(" · ");
}

const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const propre = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const coupe = (v, n) => { v = propre(v); return v.length > n ? v.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : v; };
const hq = (u) => String(u || "").replace(/\/t\/p\/w\d+\//, "/t/p/w1280/");   // bannière en grande taille (TMDB)
const fold = (v) => propre(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const TMDB_IMG = "https://image.tmdb.org/t/p/w780";
const decode = (v) => { try { return decodeURIComponent(v); } catch (e) { return v; } };

async function lire(url, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: { "user-agent": "dramabym-share" } }); if (!r.ok) throw new Error(r.status); return r; }
  finally { clearTimeout(t); }
}

/* ===== Bannière avec texte anglais (titre / logo en anglais) =====
   On interroge TMDB (images de la fiche, langue « en » uniquement) et on prend la meilleure bannière.
   Il faut ton jeton TMDB dans une variable d'environnement Vercel : TMDB_TOKEN (jeton « Lecture API » commençant par eyJ…, ou clé API v3).
   Pas de jeton, pas d'image anglaise, ou erreur : on garde la bannière habituelle de la fiche. */
const JETON_TMDB = () => process.env.TMDB_TOKEN || process.env.TMDB_API_TOKEN || process.env.TMDB_READ_TOKEN || process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_BEARER || process.env.TMDB_API_KEY || process.env.TMDB_KEY || "";
async function banniereAnglaise(s) {
  const jeton = String(JETON_TMDB()).trim();
  const m = String(s.id).match(/^(m)?(\d{1,8})$/);          // série = « 12345 », film = « m12345 »
  if (!jeton || !m) return "";
  let url = "https://api.themoviedb.org/3/" + (m[1] ? "movie" : "tv") + "/" + m[2] + "/images?include_image_language=en";
  const headers = { accept: "application/json" };
  if (jeton.length > 60) headers.Authorization = "Bearer " + jeton; else url += "&api_key=" + encodeURIComponent(jeton);
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 3000);
  try {
    const r = await fetch(url, { signal: c.signal, headers });
    if (!r.ok) return "";
    const d = await r.json();
    const liste = ((d && d.backdrops) || []).filter((b) => b && b.iso_639_1 === "en" && b.file_path && (b.width || 0) >= 1000);
    liste.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0) || (b.vote_count || 0) - (a.vote_count || 0));
    return liste.length ? "https://image.tmdb.org/t/p/w1280" + liste[0].file_path : "";
  } catch (e) { return ""; }
  finally { clearTimeout(t); }
}

function balises(o) {
  const L = [
    '<title>' + esc(o.titre) + '</title>',
    '<meta name="description" content="' + esc(o.desc) + '">',
    '<meta property="og:type" content="' + esc(o.type || "website") + '">',
    '<meta property="og:site_name" content="DramaByM">',
    '<meta property="og:locale" content="fr_FR">',
    '<meta property="og:title" content="' + esc(o.titre) + '">',
    '<meta property="og:description" content="' + esc(o.desc) + '">',
    '<meta property="og:url" content="' + esc(o.url) + '">',
    '<meta property="og:image" content="' + esc(o.image) + '">'
  ];
  if (o.defaut) L.push('<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">');
  L.push(
    '<meta name="twitter:card" content="' + esc(o.card || "summary_large_image") + '">',
    '<meta name="twitter:title" content="' + esc(o.titre) + '">',
    '<meta name="twitter:description" content="' + esc(o.desc) + '">',
    '<meta name="twitter:image" content="' + esc(o.image) + '">'
  );
  return L.join("\n") + "\n";
}

function injecte(html, o) {
  const propre = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>\s*/gi, "");
  /* on glisse le bloc juste après <meta charset> (il doit rester dans les 1024 premiers octets) */
  if (/<meta\s+charset=[^>]*>/i.test(propre)) return propre.replace(/<meta\s+charset=[^>]*>/i, (m) => m + "\n" + balises(o));
  if (/<head[^>]*>/i.test(propre)) return propre.replace(/<head[^>]*>/i, (m) => m + "\n" + balises(o));
  return html;
}

module.exports = async (req, res) => {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
  const origine = proto + "://" + host;
  const reponse = (html) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.end(html);
  };
  const secours = () => { res.statusCode = 302; res.setHeader("Location", origine + "/index.html"); res.end(); };

  let html;
  try { html = await (await lire(origine + "/index.html", 5000)).text(); } catch (e) { return secours(); }

  try {
    let chemin = String(req.query && req.query.path || "/").split("?")[0];
    if (chemin.charAt(0) !== "/") chemin = "/" + chemin;
    chemin = chemin.replace(/\/{2,}/g, "/").slice(0, 300);
    if (chemin.length > 1) chemin = chemin.replace(/\/+$/, "");
    const estBL = /^\/bl(\/|$)/i.test(chemin);                 // espace BL : /bl, /bl/series, /bl/serie/ID…
    const logique = estBL ? (chemin.slice(3) || "/") : chemin;   // même page, sans le préfixe /bl
    const parts = logique.split("/");
    const racine = "/" + (parts[1] || "").toLowerCase();
    const reste = decode(parts.slice(2).join("/"));
    const base = { url: origine + chemin, image: origine + IMAGE_PAR_DEFAUT, defaut: true, type: "website" };
    let page = (estBL && PAGES_BL[logique.toLowerCase()]) || PAGES[logique.toLowerCase()] || null;

    if (racine === "/serie" && reste) {
      const cat = await (await lire(origine + "/catalog.json", 5000)).json();
      const liste = Array.isArray(cat) ? cat : (cat && cat.series) || [];
      const s = liste.filter((x) => String(x.id) === String(reste))[0];
      if (s && s.name) {
        const film = s.type === "movie";
        const en = await banniereAnglaise(s);                 // bannière avec texte anglais si TMDB en a une
        const img = en || hq(s.backdrop || s.poster);
        const infos = infosFiche(s);
        const syn = coupe(infos + " — " + (propre(s.overview) || ("Regarde " + s.name + " sur DramaByM.")), 250);
        return reponse(injecte(html, Object.assign(base, {
          titre: s.name + (s.year ? " (" + s.year + ")" : "") + " · DramaByM",
          desc: syn,
          type: film ? "video.movie" : "video.tv_show",
          image: /^https?:\/\//i.test(img) ? img : base.image,
          defaut: !/^https?:\/\//i.test(img)
        })));
      }
    } else if (racine === "/recherche" && reste) page = TEXTE_RECHERCHE(coupe(reste, 60));
    else if (racine === "/acteur" && reste) {
      const nom = coupe(reste, 60);
      page = TEXTE_ACTEUR(nom);
      try {
        const cat = await (await lire(origine + "/catalog.json", 4000)).json();
        const liste = Array.isArray(cat) ? cat : (cat && cat.series) || [];
        const cle = fold(reste);
        const titres = []; const noms = []; let pid = "", affiche = "";
        liste.forEach((x) => {
          const c = (x.cast || []).filter((y) => y && fold(y.name) === cle)[0];
          if (!c) return;
          if (!affiche) affiche = c.name;
          if (!pid && c.id) pid = c.id;
          titres.push(x);
        });
        titres.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
        titres.forEach((x) => { if (x.name) noms.push(x.name); });
        const nomAffiche = affiche || nom;
        page = TEXTE_ACTEUR(nomAffiche, noms);
        /* photo via ton /api/person (même source que la page acteur) */
        if (titres.length) try {
          const tt = []; titres.slice(0, 6).forEach((x) => { tt.push(x.original_name || x.name); if (x.original_name && x.name) tt.push(x.name); });
          const url = origine + "/api/person?name=" + encodeURIComponent(nomAffiche) + "&language=fr-FR&titles=" + encodeURIComponent(tt.join("|")) + (pid ? "&id=" + encodeURIComponent(pid) : "");
          const p = await (await lire(url, 3500)).json();
          if (p && p.photo) { base.image = TMDB_IMG + p.photo; base.defaut = false; base.card = "summary"; }
        } catch (e) { /* pas de photo : on garde l'image par défaut */ }
      } catch (e) { /* catalogue indisponible : texte simple */ }
    }
    else if (racine === "/demande" && reste) page = PAGES["/demande"];

    const cle = (racine === "/demande" && reste) ? "/demande" : logique.toLowerCase();
    if (IMAGES[cle] && !(estBL && PAGES_BL[cle])) { base.image = origine + IMAGES[cle]; base.defaut = true; }
    return reponse(injecte(html, Object.assign(base, page || (estBL ? PAGES_BL["/"] : PAGES["/"]))));
  } catch (e) {
    return reponse(html);   // en cas de souci : ton index.html d'origine, inchangé
  }
};
