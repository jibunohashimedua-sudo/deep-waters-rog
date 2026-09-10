import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Literata } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";
import RouteHistory from "@/components/RouteHistory";

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
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.dataset.theme = t;
    } else {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    }
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
        {children}
      </body>
    </html>
  );
}
