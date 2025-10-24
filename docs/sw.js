self.addEventListener("install", e => {
  e.waitUntil(caches.open("gitajnana-cache").then(c => c.addAll(["./", "./index.html", "./app.js"])));
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
