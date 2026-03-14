import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "./globals.css";
import iconDark from "@/app/icon-dark.png";
import iconLight from "@/app/icon-light.png";
import { AppToaster } from "@/components/app-toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { config } from "@/lib/config";

const themedIcons = [
  {
    url: iconLight.src,
    media: "(prefers-color-scheme: light)",
    sizes: "500x500",
    type: "image/png",
  },
  {
    url: iconDark.src,
    media: "(prefers-color-scheme: dark)",
    sizes: "500x500",
    type: "image/png",
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(config.appUrl),
  title: config.appTitle ?? config.appName,
  description: config.appDescription,
  icons: {
    icon: themedIcons,
    shortcut: themedIcons,
    apple: "/apple-icon.png",
  },
  openGraph: {
    siteName: config.appName,
    url: config.appUrl,
    title: config.appTitle ?? config.appName,
    description: config.appDescription,
  },
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
  interactiveWidget: "resizes-content" as const,
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const LIGHT_FAVICON = iconLight.src;
const DARK_FAVICON = iconDark.src;
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true";
const THEME_HEAD_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function ensureIconLink(id, rel) {
    var link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('id', id);
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }
    return link;
  }
  var icon = ensureIconLink('theme-favicon', 'icon');
  var shortcut = ensureIconLink('theme-shortcut-favicon', 'shortcut icon');
  function updateThemeHead() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
    var href = isDark ? '${DARK_FAVICON}' : '${LIGHT_FAVICON}';
    icon.setAttribute('href', href);
    icon.setAttribute('sizes', '500x500');
    icon.setAttribute('type', 'image/png');
    shortcut.setAttribute('href', href);
    shortcut.setAttribute('sizes', '500x500');
    shortcut.setAttribute('type', 'image/png');
  }
  var observer = new MutationObserver(updateThemeHead);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeHead();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable}`}
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-head-script" strategy="beforeInteractive">
          {THEME_HEAD_SCRIPT}
        </Script>
        {process.env.NODE_ENV !== "production" ? (
          <Script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            strategy="beforeInteractive"
          />
        ) : null}
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <AppToaster />
          {children}
        </ThemeProvider>
        {ANALYTICS_ENABLED ? <Analytics /> : null}
        {ANALYTICS_ENABLED ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
