/**
 * d3jusdevspace — Application constants.
 */

/** Base path for the backend API (relative to the proxy). */
export const API_V1 = "/api/v1";

/**
 * Site-wide branding. Single source of truth — nothing else hardcodes the name.
 *
 * Every value falls back to the upstream (d3jusdevspace) default, so a merge
 * back into DejusDevspace/my-blog leaves that site unchanged. Forks override
 * via .env.local instead of editing this file — that keeps the brand diff at
 * zero and avoids conflicts on every upstream sync.
 */
export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "d3jusdevspace",
  tagline: process.env.NEXT_PUBLIC_SITE_TAGLINE ?? "AI engineer, builder, thinker",
  /** Short display name — the hero pill and the sidebar byline. */
  author: process.env.NEXT_PUBLIC_SITE_AUTHOR ?? "d3ju",
  /** Role line under the byline. Kept short; it's set in uppercase mono. */
  role: process.env.NEXT_PUBLIC_SITE_ROLE ?? "AI/ML Engineer",
  /** Hero paragraph. Plain prose — no markup. */
  intro:
    process.env.NEXT_PUBLIC_SITE_INTRO ??
    "I'm just another human finding my voice in a noisy world. Here, I'm a Full-Stack AI/ML Engineer, and I document my projects, lessons, ideas, thoughts, and basically, just ME. Hope you find something for you!",
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ??
    "Personal knowledge hub, blog, and AI Agent collaboration blogging platform",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  repo: process.env.NEXT_PUBLIC_SITE_REPO ?? "https://github.com/DejusDevspace/my-blog",
  github: process.env.NEXT_PUBLIC_SITE_GITHUB ?? "https://github.com/DejusDevspace",
  twitter: process.env.NEXT_PUBLIC_SITE_TWITTER ?? "https://x.com/adejo_deju",
  linkedin: process.env.NEXT_PUBLIC_SITE_LINKEDIN ?? "https://linkedin.com/in/deju-adejo",
  /** Footer strapline, shown after the copyright. */
  motto: process.env.NEXT_PUBLIC_SITE_MOTTO ?? "BUILT FOR THE AGENTIC AGE",
  /**
   * Favicon, served from public/. Deliberately NOT the app/icon.* file
   * convention: that resolves from the filesystem at build time, so it can be
   * neither gitignored (CI builds from a clean clone — the file wouldn't
   * exist) nor overridden per-fork. Pointing at public/ via metadata makes it
   * one env var, and emits exactly one <link rel="icon"> instead of letting
   * the browser choose between two.
   */
  icon: process.env.NEXT_PUBLIC_SITE_ICON ?? "/favicon.ico",
  /**
   * Visual skin — one file in src/styles/themes/, applied as data-skin on
   * <html>. Independent of the light/dark toggle, which still works within
   * whichever skin is active. Defaults to upstream's original look, so a
   * merge back into DejusDevspace/my-blog changes nothing visually.
   */
  skin: process.env.NEXT_PUBLIC_SITE_SKIN ?? "cyber-luxury",
} as const;

/** Pagination defaults. */
export const PAGINATION = {
  defaultPage: 1,
  defaultLimit: 10,
  adminDefaultLimit: 20,
} as const;
