import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Literata } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";
import RouteHistory from "@/components/RouteHistory";
import ServiceWorker from "@/components/ServiceWorker";

// Self-hosted at build time rather than pulled from Google at run time.
// globals.css used to open with an @import of the Google Fonts stylesheet,
// which forced the browser to fetch our CSS, then discover the import, then
// fetch Google's CSS (310ms measured), then the font file (1210ms) — four
// steps, each waiting on the one before, all of it in front of first paint.
// next/font emits the files from our own origin with a preload link and
// font-display: swap, so text paints immediately in the fallback face.
// Three faces, three jobs, and the split between them is the hierarchy:
// prose is sans, scripture is serif, and every number or piece of state
// in the app is mono. Poppins is a geometric sans that was doing all
// three jobs at once, which is why nothing on a screen had a rank.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans"
});

// Data. Verse numbers, day counts, timestamps, tab labels. Tabular by
// design, so a column of figures lines up without being asked.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono"
});

// Scripture, and only scripture-adjacent things: references, the verse
// of the day, someone's name over their reflection. Literata was drawn
// for reading at length on a screen, which is this app's one real job.
const literata = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif"
});

export const metadata: Metadata = {
  title: "Deep Waters",
  description: "A 90 day Bible reading plan.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Deep Waters",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDEFF2" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0A18" }
  ]
};

// Runs before React hydrates so we don't flash the wrong theme.
//
// It now applies the rest of the reading settings from the same place, and
// that is what makes the app open correctly with no signal. The settings
// themselves live on the profile row, which is right — they follow a reader
// from their phone to a borrowed laptop. But a profile row needs a network
// to fetch, and someone who reads at large text in dark mode must not open
// the app in a tunnel and find it back at the defaults.
//
// So the browser keeps a mirror, written by PreferencesApply whenever the
// server has told it something, and read here before the first pixel. The
// database is still the truth; this is the truth's last known position.
//
// Only the four that are visible on a reading surface, plus the theme that
// was already here. Anything that is not about how the page looks has no
// business running before paint.
const themeScript = `
(function() {
  var el = document.documentElement;
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') {
      el.dataset.theme = t;
    } else {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      el.dataset.theme = prefersDark ? 'dark' : 'light';
    }
  } catch (e) {}
  try {
    var raw = localStorage.getItem('dw_prefs');
    if (!raw) return;
    var p = JSON.parse(raw);
    // Each guarded on its own: a mirror written by an older build, or one a
    // reader has poked at in devtools, must leave the app on its defaults
    // rather than on an attribute the stylesheet has no rule for.
    if (['small','medium','large','xlarge'].indexOf(p.text_size) >= 0) el.dataset.textSize = p.text_size;
    if (['tight','normal','relaxed'].indexOf(p.line_spacing) >= 0) el.dataset.lineSpacing = p.line_spacing;
    if (['serif','sans'].indexOf(p.reading_font) >= 0) el.dataset.readingFont = p.reading_font;
    if (typeof p.verse_numbers === 'boolean') el.dataset.verseNumbers = p.verse_numbers ? 'on' : 'off';
  } catch (e) {}
})();
`;

// Writes the reader's IANA timezone into a cookie the server reads on the
// next request. Without it the server has no way to know what "today" is
// for someone outside UTC, and the reading plan's current day drifts by
// one. Set with SameSite=Lax so it goes out on top-level navigations, and
// a long max-age so we only pay this on the very first visit and after
// the reader changes timezone.
const tzScript = `
(function() {
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    var cookie = document.cookie || '';
    var existing = cookie.split('; ').find(function(c) { return c.indexOf('dw_tz=') === 0; });
    var existingVal = existing ? decodeURIComponent(existing.slice(6)) : null;
    if (existingVal === tz) return;
    document.cookie = 'dw_tz=' + encodeURIComponent(tz) + '; path=/; max-age=' + (60*60*24*365) + '; SameSite=Lax';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} ${literata.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: tzScript }} />
      </head>
      <body>
        <SplashScreen />
        {/* Counts navigations so every back control in the app can tell
            a page it can pop from a cold arrival it cannot. Inside a
            boundary because it reads the query string. */}
        <Suspense fallback={null}>
          <RouteHistory />
        </Suspense>
        {/* Installs the offline worker after load, on idle. See the file —
            it is deliberately the last thing that happens on a cold visit. */}
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
