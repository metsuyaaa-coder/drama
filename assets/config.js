
/* ===== Configuration ===== */
var CONFIG = {
  TOKEN: "",       /* jeton TMDB : à coller via « Clé TMDB » en mode admin */
  ADMIN_HASH: "",  /* ancien format (un seul admin) : laisse vide, les admins sont dans ADMINS */
  ADMINS: [{ name: "NEBULA", hash: "614d778ed0cba5ca0a8417fb496e2cb752f2e111ed385d663c6771cb040b9266" }],  /* liste des admins : gérée depuis /headadmin */
  BL_UPLOADERS: [],  /* uploadeurs BL (accès limité à l'onglet BL) : gérés depuis /headadmin, colle ici la ligne BL_UPLOADERS qu'il te donne */
  HEAD_HASH: "12afa2afc52f8d72a5d94d6e75aef998d73d95d61c0792b99d93a850795b71a2",   /* empreinte du mot de passe Head admin : à créer sur /headadmin puis à coller ici */
  TOKEN_ENC: "",   /* jeton TMDB chiffré avec ton mot de passe : se débloque tout seul à la connexion admin */
  GITHUB_REPO: "metsuyaaa-coder/drama", /* ex. "pseudo/depot" : si rempli, les visiteurs lisent catalog.json directement sur GitHub (mise à jour en direct) */
  GITHUB_BRANCH: "main",
  GITHUB_PATH: "catalog.json",
  LANG: "fr-FR",
  TMDB_PROXY: "/api/tmdb"  /* mini-serveur Vercel (api/tmdb.js) qui cherche sur TMDB pour les visiteurs sans exposer ta clé */
};
