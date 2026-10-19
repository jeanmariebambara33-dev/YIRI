// Service worker de YIRI. Deux rôles seulement :
//   1. garder la page en mémoire pour qu'elle s'ouvre même sans réseau ;
//   2. ne JAMAIS se mettre entre l'application et Supabase.
// Tout ce qui n'est pas une ressource du site passe directement au réseau.

const VERSION = "yiri-v2";
const COQUILLE = ["/", "/index.html", "/manifest.webmanifest", "/icone-192.png", "/icone-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.allSettled(COQUILLE.map((u) => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                      // écritures : jamais interceptées
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Supabase, polices, CDN : direct au réseau

  // Pages : on tente le réseau d'abord, pour que les mises à jour arrivent ; sinon la version gardée.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const reponse = await fetch(req);
        const c = await caches.open(VERSION);
        c.put("/index.html", reponse.clone());
        return reponse;
      } catch {
        return (await caches.match("/index.html")) || (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  // Fichiers du site (icônes, manifeste) : la copie gardée d'abord, puis mise à jour en arrière-plan.
  e.respondWith((async () => {
    const garde = await caches.match(req);
    const reseau = fetch(req).then((r) => {
      if (r && r.ok) caches.open(VERSION).then((c) => c.put(req, r.clone()));
      return r;
    }).catch(() => garde || Response.error());
    return garde || reseau;
  })());
});

// ---------------------------------------------------------------------------
// Notifications poussées (migration 0017)
// ---------------------------------------------------------------------------
// Le message arrive chiffré ; le navigateur l'a déjà déchiffré quand il nous le remet.
// Nous n'y touchons pas : nous l'affichons.
//
// Un garde-fou : si le contenu est illisible (version plus ancienne du service worker, message
// forgé), on affiche quand même quelque chose. Un navigateur qui reçoit un push et n'affiche
// AUCUNE notification finit par retirer l'autorisation à l'application.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const titre = typeof d.titre === "string" && d.titre ? d.titre : "YIRI";
  const corps = typeof d.corps === "string" ? d.corps : "";
  const lien = typeof d.lien === "string" && d.lien ? d.lien : "/";
  e.waitUntil(self.registration.showNotification(titre, {
    body: corps,
    icon: "/icone-192.png",
    badge: "/icone-192.png",
    lang: "fr",
    // L'identifiant évite les doublons : le même événement reçu deux fois remplace la
    // notification au lieu d'en empiler une seconde.
    tag: typeof d.id === "string" && d.id ? d.id : undefined,
    renotify: false,
    data: { lien },
  }));
});

// Un clic doit ouvrir le bon écran, et réutiliser l'onglet déjà ouvert plutôt que d'en empiler.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const lien = (e.notification.data && e.notification.data.lien) || "/";
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenetres) {
      if (f.url.startsWith(self.location.origin)) {
        await f.focus();
        try { await f.navigate(lien); } catch { /* certains navigateurs l'interdisent : le focus suffit */ }
        return;
      }
    }
    await self.clients.openWindow(lien);
  })());
});

// L'abonnement de l'appareil peut être renouvelé par le navigateur sans nous prévenir : il
// faut alors réenregistrer, sinon l'appareil cesse silencieusement de recevoir.
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenetres) f.postMessage({ yiri: "push-a-reenregistrer" });
  })());
});
