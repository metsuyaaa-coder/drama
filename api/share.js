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
const TEXTE_RECHERCHE = (q) => ({ titre: "« " + q + " » · DramaByM", desc: "Résultats de recherche pour « " + q + " » dans le répertoire DramaByM." });
const TEXTE_ACTEUR = (n) => ({ titre: n + " · DramaByM", desc: "Les titres avec " + n + " disponibles sur DramaByM." });

const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const propre = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const coupe = (v, n) => { v = propre(v); return v.length > n ? v.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : v; };
const hq = (u) => String(u || "").replace(/\/t\/p\/w\d+\//, "/t/p/w1280/");   // bannière en grande taille (TMDB)
const decode = (v) => { try { return decodeURIComponent(v); } catch (e) { return v; } };

async function lire(url, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: { "user-agent": "dramabym-share" } }); if (!r.ok) throw new Error(r.status); return r; }
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
    '<meta name="twitter:card" content="summary_large_image">',
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
    const parts = chemin.split("/");
    const racine = "/" + (parts[1] || "").toLowerCase();
    const reste = decode(parts.slice(2).join("/"));
    const base = { url: origine + chemin, image: origine + IMAGE_PAR_DEFAUT, defaut: true, type: "website" };
    let page = PAGES[chemin.toLowerCase()] || null;

    if (racine === "/serie" && reste) {
      const cat = await (await lire(origine + "/catalog.json", 5000)).json();
      const liste = Array.isArray(cat) ? cat : (cat && cat.series) || [];
      const s = liste.filter((x) => String(x.id) === String(reste))[0];
      if (s && s.name) {
        const film = s.type === "movie";
        const img = hq(s.backdrop || s.poster);
        const syn = coupe(s.overview, 240) || ("Regarde " + s.name + " sur DramaByM.");
        return reponse(injecte(html, Object.assign(base, {
          titre: s.name + (s.year ? " (" + s.year + ")" : "") + " · DramaByM",
          desc: syn,
          type: film ? "video.movie" : "video.tv_show",
          image: /^https?:\/\//i.test(img) ? img : base.image,
          defaut: !/^https?:\/\//i.test(img)
        })));
      }
    } else if (racine === "/recherche" && reste) page = TEXTE_RECHERCHE(coupe(reste, 60));
    else if (racine === "/acteur" && reste) page = TEXTE_ACTEUR(coupe(reste, 60));
    else if (racine === "/demande" && reste) page = PAGES["/demande"];

    return reponse(injecte(html, Object.assign(base, page || PAGES["/"])));
  } catch (e) {
    return reponse(html);   // en cas de souci : ton index.html d'origine, inchangé
  }
};
