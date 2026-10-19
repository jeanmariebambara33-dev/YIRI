// Service worker de YIRI. Deux rôles seulement :
//   1. garder la page en mémoire pour qu'elle s'ouvre même sans réseau ;
//   2. ne JAMAIS se mettre entre l'application et Supabase.
// Tout ce qui n'est pas une ressource du site passe directement au réseau.

const VERSION = "yiri-v1";
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
