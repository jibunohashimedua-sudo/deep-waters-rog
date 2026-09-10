/* Deep Waters — offline service worker.
 *
 * Written by hand, and short enough to read in one sitting on purpose.
 *
 * WHY NOT WORKBOX. Workbox earns its place when there is a list of files to
 * keep in step across deploys and a set of revalidation rules to get right.
 * This app has neither. Everything under /_next/static already carries a
 * content hash in its filename and is immutable for ever, and the three
 * fonts are self-hosted alongside it — so "cache it once and never look
 * again" is not a strategy that needs a library, it is four lines. Buying
 * Workbox would have meant a build plugin wrapping the compiler, which is
 * the likeliest way to quietly undo the performance pass this worker has to
 * live beside.
 *
 * THE ONE RULE THAT MATTERS. Nothing personalised is ever written to a
 * cache. Not a page carrying somebody's name, not an RSC payload, not an
 * API response, not a Supabase reply. The only things in Cache Storage are
 * content-hashed static assets and one impersonal shell document. That is
 * what makes it safe for two people to share a phone: there is nothing here
 * for the sign-out purge to miss, because there was never anything personal
 * put here in the first place. The reader's own chapters, notes and progress
 * live in IndexedDB, keyed to them, and are deleted whole on sign out.
 */

/**
 * Bump ONLY when the shape of what is cached changes — not on a deploy.
 *
 * Deploys are already handled without it: everything under /_next/static is
 * content-hashed, so a new build simply asks for different filenames, and
 * the shell is re-fetched whenever the reader is demonstrably online. Bumping
 * this throws away every stored asset and makes the next visit pay for all of
 * them again, which is the opposite of the point.
 *
 * v2: the shell's own chunks moved from the static cache to the shell cache,
 * so the static cache's size trim can no longer evict them. Old installs have
 * them in the wrong place, and activate() clears anything not named here.
 */
const VERSION = "v2";
const STATIC_CACHE = `dw-static-${VERSION}`;
const ASSET_CACHE = `dw-assets-${VERSION}`;
const SHELL_CACHE = `dw-shell-${VERSION}`;
const OURS = [STATIC_CACHE, ASSET_CACHE, SHELL_CACHE];

/** The one document served when a navigation cannot reach the network. It
    holds no personal data of any kind — it draws itself from IndexedDB once
    it is running. */
const SHELL_URL = "/offline";

/** Immutable, content-hashed, and safe to keep for ever. Fonts live here
    too (next/font emits them under /_next/static/media). */
const isStatic = (url) => url.pathname.startsWith("/_next/static/");

/** Icons, the manifest and the logo files. Not hashed, so they are refreshed
    in the background after being served from the cache. */
const isAsset = (url) =>
  url.pathname === "/manifest.json" ||
  url.pathname === "/favicon.ico" ||
  /^\/(favicon|icon-|apple-touch-icon|logo|deep-waters-)/.test(url.pathname);

/** Anything under /_next/static, capped so a long-lived install does not
    accumulate every chunk of every deploy it has ever seen. Old entries are
    dropped oldest-first; they are immutable, so losing one costs a refetch
    and nothing else. */
const STATIC_MAX_ENTRIES = 400;

async function trimCache(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    // cache.keys() is in insertion order, so the head is the oldest.
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  } catch {
    /* Trimming is housekeeping. It must never break a fetch. */
  }
}

/** How often the shell is allowed to be re-fetched in the background. The
    refresh below runs off successful navigations, and without a throttle
    that would be an extra request on every single page the reader opens. */
const SHELL_MAX_AGE_MS = 60 * 60 * 1000;

let shellRefreshedAt = 0;

/**
 * Put the offline shell in the cache, freshly — and everything it needs to
 * be able to draw itself.
 *
 * THE PART THAT IS EASY TO GET WRONG. Caching the shell's HTML is not
 * enough. That HTML is a Next.js document: a few hundred bytes of markup
 * plus `<script src="/_next/static/chunks/…">`. With no network, an HTML
 * document whose scripts cannot load is a blank white page — which is
 * precisely the failure this worker exists to prevent, arrived at by way of
 * doing nine tenths of the work. The scripts are content-hashed, so nothing
 * will fetch them again once they are stored; they just have to be stored,
 * and the only place their names are written down is the shell's own HTML.
 * So it is read, its /_next/static references are pulled out, and they are
 * cached alongside it.
 *
 * The same goes one level deeper for the stylesheet: next/font writes the
 * font files into the CSS as url(/_next/static/media/…), and a shell that
 * renders in Times New Roman on a train is a shell that looks broken. The
 * CSS is parsed for those too.
 *
 * Run on install, on activate, and — at most hourly — after a successful
 * navigation. That last one is what keeps it honest across deploys: the
 * shell names the chunks of the build that served it, so a shell cached
 * three deploys ago would ask for chunks that no longer exist. Refreshing it
 * whenever the reader is demonstrably online means what is stored is never
 * more than one online hour behind the deploy.
 */
async function refreshShell(force) {
  if (!force && Date.now() - shellRefreshedAt < SHELL_MAX_AGE_MS) return;
  try {
    const res = await fetch(SHELL_URL, { cache: "no-store", credentials: "omit" });
    // Only a real, complete answer. An opaque or errored response cached
    // here would be served as the offline page and show a blank screen.
    if (!res.ok || res.type === "opaque") return;

    const html = await res.clone().text();
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(SHELL_URL, res);
    shellRefreshedAt = Date.now();

    // Every /_next/static reference in the document, whatever attribute it
    // came from — script src, stylesheet href, font preload. One pass over
    // the text rather than three, because the only thing that matters is
    // that the URL is one of ours and immutable.
    const refs = new Set();
    for (const m of html.matchAll(/["'(](\/_next\/static\/[^"')\s]+)["')]/g)) {
      refs.add(m[1]);
    }

    // Stored in the SHELL cache, not the static one, and that placement is
    // the point. The static cache is trimmed oldest-first when it grows
    // past its cap — and the shell's own chunks, cached once at install and
    // never requested again by ordinary browsing, would be the very oldest
    // entries in it. Trimming them would leave a shell whose scripts cannot
    // load: a blank page, appearing weeks later, on the one screen that
    // exists to prevent blank pages. Nothing trims this cache.
    const shelf = cache;
    const take = async (url) => {
      try {
        // Either cache is a hit — this is the only cheap way to avoid
        // re-downloading a chunk the ordinary browsing has already stored.
        if (await caches.match(url)) return null;
        const r = await fetch(url);
        if (!r.ok) return null;
        const body = /\.css$/.test(url) ? await r.clone().text() : null;
        await shelf.put(url, r);
        return body;
      } catch {
        // One missing chunk is not a reason to abandon the rest.
        return null;
      }
    };

    const sheets = await Promise.all(Array.from(refs).map(take));

    // A stylesheet names the font files, and nothing else does — next/font
    // writes them in as url(/_next/static/media/…). One level of following,
    // not a crawler. Without this the offline shell renders in Times New
    // Roman, which looks broken rather than offline.
    const fonts = new Set();
    for (const css of sheets) {
      if (!css) continue;
      for (const m of css.matchAll(/url\(\s*["']?(\/_next\/static\/[^"')\s]+)/g)) {
        if (!refs.has(m[1])) fonts.add(m[1]);
      }
    }
    await Promise.all(Array.from(fonts).map(take));
  } catch {
    /* No network. Whatever is already stored stays. */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(refreshShell(true).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("dw-") && !OURS.includes(n))
          .map((n) => caches.delete(n))
      );
      await refreshShell(true);
      await self.clients.claim();
    })()
  );
});

/** Sign out. The page asks for everything of ours to go before it clears
    IndexedDB and drops the session. */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "DW_PURGE") return;
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("dw-")).map((n) => caches.delete(n)));
      // Answer so the page can wait for this before it signs out.
      event.source?.postMessage?.({ type: "DW_PURGED" });
    })()
  );
});

async function cacheFirst(request, cacheName, { revalidate = false } = {}) {
  const cache = await caches.open(cacheName);
  // Across every cache of ours, not just this one: the offline shell's
  // chunks are deliberately kept in the shell cache so the trim cannot
  // reach them, and they are ordinary /_next/static requests when the app
  // is running normally. Looking only in the static cache would fetch them
  // a second time and store a duplicate.
  const hit = (await cache.match(request)) || (await caches.match(request));
  if (hit) {
    if (revalidate) {
      // Not awaited: the reader already has their answer.
      fetch(request)
        .then((res) => {
          if (res.ok && res.type !== "opaque") cache.put(request, res.clone());
        })
        .catch(() => {});
    }
    return hit;
  }
  const res = await fetch(request);
  if (res.ok && res.type !== "opaque") {
    cache.put(request, res.clone()).catch(() => {});
    if (cacheName === STATIC_CACHE) trimCache(STATIC_CACHE, STATIC_MAX_ENTRIES);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Writes are never touched. A queued POST is the queue's business, not
  // this worker's — the reader has to be able to see what is waiting and
  // why, and a request swallowed into a background sync store is a request
  // nobody can explain.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Someone else's origin — Supabase, avatars, API.Bible. Not ours to cache.
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, { revalidate: true }));
    return;
  }

  // A page the reader is navigating to. Always from the network, never
  // cached — every signed-in page in this app carries their name, their
  // notes, or somebody's reflection. When the network cannot be reached,
  // the shell answers in its place, at the URL that was asked for, so the
  // address bar, the back button and the next/previous links all keep
  // working and each onward step falls back the same way.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          // Demonstrably online: take the chance to keep the shell current.
          event.waitUntil(refreshShell());
          return res;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const shell = await cache.match(SHELL_URL);
          if (shell) return shell;
          // Nothing stored yet — a first visit that went straight offline.
          // Say so plainly rather than showing the browser's error page.
          return new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
              "<title>Deep Waters</title>" +
              "<body style=\"margin:0;font:16px/1.5 system-ui;padding:2rem;background:#0C0A18;color:#EDEFF2\">" +
              "<p>Deep Waters is offline, and this device hasn&rsquo;t saved anything to read yet.</p>" +
              "<p>Open the app once with a connection and your reading will be here next time.</p>",
            { status: 503, headers: { "content-type": "text/html; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  // Everything else — RSC payloads, /api/*, anything at all — goes to the
  // network untouched and is never stored. Not handled here at all, so the
  // browser does exactly what it did before this worker existed.
});
