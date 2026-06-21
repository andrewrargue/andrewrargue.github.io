# Andrew Argue — Portfolio Site

Source of truth for Claude Code sessions. Updated to reflect state as of June 2026.

---

## Tech Stack & Constraints

- **Plain HTML, CSS, vanilla JS** — no frameworks, no bundlers, no build step
- **File:// compatible** — all paths are relative; the site must work when opened directly from the filesystem as well as via a local server (`serve.py` is a convenience Python server at the project root)
- **Google Fonts** — `Instrument Sans` (400, 500, 600) and `Instrument Serif` (400) loaded via `@import` in `styles.css`
- **No preprocessors** — CSS custom properties are used for the token system; no Sass, PostCSS, or similar
- **No JS libraries** — vanilla Intersection Observer for scroll animations, vanilla DOM for nav behaviour
- **Canadian English** throughout all copy — use `colour`, `organisation`, `customise`, `analyse`, `dialogue`, etc.

---

## File / Folder Structure

```
andrew-portfolio/
├── index.html                  # Homepage (hero, work list, about teaser, footer)
├── about.html                  # About page (photo, bio, stats, tools, CTA)
├── contact.html                # Contact page (email + LinkedIn links)
├── serve.py                    # Local dev server (python3 serve.py)
├── CLAUDE.md                   # This file
│
├── css/
│   ├── styles.css              # Global styles, design tokens, all non-case-study components
│   ├── about.css               # About page styles (loaded after styles.css)
│   └── contact.css             # Contact page styles (loaded after styles.css)
│
├── js/
│   └── main.js                 # Nav scroll state, mobile nav, active link, scroll animations
│
├── work/
│   ├── case-study.css          # Shared case study template styles (imported by all case study pages)
│   ├── waitwell-website.html   # Case study: WaitWell Website Redesign
│   ├── waitwell-product.html   # Case study: WaitWell Product Redesign
│   ├── tiller-design-system.html  # Case study: Tiller Design System
│   ├── one-exchange.html       # Case study: One Exchange Trading Platform
│   └── arbo.html               # Case study: Arbo Illustration & Visual Direction
│
└── images/
    ├── andrew-argue.jpg        # About page photo
    ├── Arbo/                   # Arbo case study images + homepage thumbnail
    ├── OX/                     # One Exchange images + homepage thumbnail
    ├── Tiller Design System/   # Tiller images + homepage thumbnail
    ├── Waitwell Product/       # WaitWell Product images + homepage thumbnail
    └── Waitwell web/           # WaitWell Website images + homepage thumbnail
```

### Image naming conventions
- Homepage thumbnails: `[Project] - cover.png` (e.g. `OX - cover.png`, `Arbo - cover.png`)
- Case study images: `[Prefix]-NN.png` (e.g. `Waitwell-product-01.png`, `OX Trading - 1.png`, `Arbo-01.png`, `UI Kit-01.png`)
- About photo: `andrew-argue.jpg` in `images/` root
- Images are referenced via **inline `background-image` style attributes** on `<div>` elements — NOT via `<img>` tags. WCAG mitigation: `role="img"` and `aria-label` are applied to these divs.

### Image dimensions
- **Case study hero + body images**: 1344×756px (16:9) at 1x; 2688×1512px at 2x
- **Homepage hover thumbnails**: 755×472px (approx. 16:10)

---

## Design Token System

All tokens defined in `css/styles.css` under `:root`. There is **no primitive → semantic → component hierarchy** in this codebase — tokens are flat, semantic by name, and referenced directly in component styles.

### Colour
```css
--bg:              #000000                /* Page background */
--bg-2:            #111111                /* Alternate section background (e.g. about section, even work rows) */
--bg-3:            #1C1C1C                /* Elevated surface (tags, image placeholders, hover states) */
--text:            #FFFFFF                /* Primary text */
--text-muted:      rgba(255,255,255,0.55) /* Body copy, descriptions, meta values */
--text-dim:        rgba(255,255,255,0.40) /* Labels, captions, eyebrows, secondary UI */
--border:          rgba(255,255,255,0.08) /* Default dividers and outlines */
--border-em:       rgba(255,255,255,0.18) /* Emphasised borders (statement left border, hero CTA underline) */
--nav-bg-scrolled: rgba(0,0,0,0.85)       /* Nav background when scrolled (frosted glass) */
--shadow-card:     rgba(0,0,0,0.6)        /* Work row hover thumbnail drop shadow colour */
```

### Typography
```css
--font: 'Instrument Sans', system-ui, sans-serif
/* Instrument Serif used directly in component rules — no token for it */
```
Serif is applied inline in component declarations (`font-family: 'Instrument Serif', Georgia, serif`) rather than via a token.

### Spacing
8px base unit. 8 named stops:
```css
--space-1:  8px
--space-2:  16px
--space-3:  24px
--space-4:  32px
--space-5:  48px
--space-6:  64px
--space-7:  96px
--space-8:  128px
```

### Layout
```css
--max-width:  1440px   /* Container max-width */
--nav-height: 64px     /* Fixed nav bar height — use in calc() for offset spacing */
/* Container padding: var(--space-5) = 48px inline by default; var(--space-3) = 24px below 768px */
```

### Border radius
```css
--radius:    4px       /* Tags, small pills */
--radius-lg: 12px      /* Image containers, stat grids, cards */
```

### Animation / easing
```css
--transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1)  /* Short expo-out — micro-interactions (hover colours, gaps, icons) */
--ease-out:   cubic-bezier(0.16, 1, 0.3, 1)        /* Expo out reference — inline this value in transition shorthand */
```

> ⚠️ **Critical bug to avoid:** CSS custom properties **cannot** be used as timing function values in `transition` shorthand. `transition: opacity 0.9s var(--ease-out)` silently falls back to `ease`. Always inline the cubic-bezier value directly. `--ease-out` exists for documentation only.

**Spacing note:** `.work-section` and `.about-section` (homepage only) use `padding-block: 120px` — a deliberate large-section value that sits between `--space-7` (96px) and `--space-8` (128px). It does not map to a token by design; do not replace it with a token without designer sign-off.

---

## Naming Conventions

### CSS classes
- **BEM-like**: `block__element--modifier` (e.g. `.work-row__title`, `.cs-hero__eyebrow`, `.nav__links`)
- **Prefixes**: `cs-` for all case-study-specific classes (defined in `work/case-study.css`), no prefix for global classes
- **Modifier pattern**: `cs-split--flip` reverses column order; `nav__hamburger.open` toggles mobile state
- **Shared label class**: `.cs-label` is the single definition for all small-caps eyebrow labels — defined globally in `styles.css`, used on homepage and all case study pages. Do NOT create new label classes; add `cs-label` to the element. The `cs-hero__eyebrow` class adds only the margin-bottom unique to the hero context.
- **Reusable inline CTA**: `.text-cta` is the class for small-caps underline links (like "More about me →"). Defined in `styles.css`. No inline styles needed.

### Files
- **kebab-case** for all HTML files (e.g. `waitwell-website.html`, `tiller-design-system.html`)
- **Title case with spaces** for image folders (e.g. `Tiller Design System/`, `Waitwell web/`)
- **Mixed** image filenames — some use hyphens (`Waitwell-product-01.png`), some use spaces (`OX Trading - 1.png`), some use hyphens without prefix (`Arbo-01.png`). No enforcement; quote all paths carefully.

### HTML attributes
- `data-animate` — single element scroll reveal (fade up from 48px offset)
- `data-stagger` — parent whose direct children reveal with staggered delays (0.12s between each, up to 6 children)
- `is-visible` — added by JS Intersection Observer to trigger transitions

---

## Page Inventory

| Page | File | Status |
|------|------|--------|
| Homepage | `index.html` | ✅ Done |
| About | `about.html` | ✅ Done |
| Contact | `contact.html` | ✅ Done |
| WaitWell Website | `work/waitwell-website.html` | ✅ Done |
| WaitWell Product | `work/waitwell-product.html` | ✅ Done |
| Tiller Design System | `work/tiller-design-system.html` | ✅ Done |
| One Exchange | `work/one-exchange.html` | ✅ Done |
| Arbo | `work/arbo.html` | ✅ Done |

### Case study chain (Next project links)
WaitWell Website → WaitWell Product → Tiller Design System → One Exchange → Arbo → (back to WaitWell Website)

---

## Component Patterns

### Navigation (`<header class="nav">`)
- Fixed, transparent by default; gains `scrolled` class after 8px scroll → frosted glass (`rgba(0,0,0,0.85)` + `backdrop-filter: blur(12px)`)
- Desktop: logo left, links right. Links are sentence case, `1.125rem`, `--text-muted`, underline on hover/active
- Mobile (`≤768px`): links hidden, hamburger shown. Clicking opens full-screen overlay with large type
- Active link detection: JS compares `href` to `window.location.pathname` last segment
- **Same markup on every page** — copy verbatim when adding pages

### Footer (`<footer class="footer">`)
- Name left, year + email right
- Footer year is currently `© 2026`
- **Same markup on every page**

### Work rows (`index.html`)
- Three-column grid: left (index number + title), middle (empty — image floats here), right (tag + desc + CTA)
- Hover thumbnail: positioned absolutely `left: 30%, right: 42%`, reveals on row hover via opacity + transform
- Even rows have `--bg-2` background; all rows transition to `--bg-3` on hover
- Thumbnail images set via inline `background-image` on `.work-row__image-inner`

### Case study template (all `work/*.html`)
Every case study page follows this exact section order:
1. `.cs-hero` — eyebrow, h1 title, subtitle, meta row (client/role/year/team)
2. `.cs-hero-image-wrap` > `.cs-hero-image` — 16:9 full-width hero image
3. `.cs-overview` — 3fr/1fr grid: left = overview body text, right = discipline tags + challenge/objective list
4. `.cs-sections` > multiple `.cs-section` — body content sections (see below)
5. `.cs-results` — label, stats grid (3-col), outcomes list, optional `.cs-quote`
6. `.cs-testimonial` (optional, currently only on waitwell-website.html) — large italic pull quote
7. `.cs-next` — next project link + "All work" back link

#### Body section patterns
Each `.cs-section` contains:
- `.cs-section__header` — `.cs-label` (eyebrow) + `h2.cs-section__title`
- Content in one of:
  - `.cs-split` — text top (75% wide), image bottom (full width)
  - `.cs-split.cs-split--flip` — image top, text below (same on mobile — flip is visual in HTML source order only; no CSS flex-order is used)
  - `.cs-process` — pill tag row (used only in waitwell-website.html Process section)
  - Text only (no `.cs-split__media`) — valid pattern, used for token architecture section

#### Animation attributes on case study pages
- `<div class="container" data-stagger>` on hero inner (staggers eyebrow, title, subtitle, meta)
- `data-animate` on: `.cs-hero-image-wrap`, `.cs-overview__left`, `.cs-overview__right`, every `.cs-section`, `.cs-results`, `.cs-stats` (stagger), `.cs-outcomes`, `.cs-quote`, `.cs-testimonial`, `.cs-next`

---

## Animation System

### Scroll reveals (`js/main.js`)
- **`[data-animate]`**: element starts `opacity: 0; transform: translateY(48px)`, transitions to visible over `1s cubic-bezier(0.16, 1, 0.3, 1)` when 10% in viewport (with −60px bottom margin)
- **`[data-stagger]`**: same as above but applied to each direct child with delays: 0s, 0.12s, 0.24s, 0.36s, 0.48s, 0.60s (supports up to 6 children)
- Once visible, the observer disconnects from that element (one-time trigger)

### Hero load animation (`index.html` only)
- `.hero__eyebrow`, `.hero__name`, `.hero__headline`, `.hero__subtext`, `.hero__cta` start hidden
- `body.hero-loaded` class added via double-`requestAnimationFrame` on `DOMContentLoaded`
- Staggered delays: 0.05s / 0.20s / 0.38s / 0.54s / 0.68s

---

## Known Issues & TODOs

### CSS bugs
- **`--ease-out` token is reference-only** — see warning above. Any new transition must inline the `cubic-bezier()` value directly in the shorthand.

### Missing responsive styles for case study images
- On mobile, `.cs-image` images maintain their `aspect-ratio: 16 / 9` which works fine, but very large sections (many images stacked) aren't tested. No horizontal overflow issues observed but not validated on actual devices.

### `cs-split--flip` has no CSS flip behaviour
- The `--flip` modifier does not use `flex-direction: row-reverse` or `order`. The visual "flip" (image left, text right vs text left, image right) is achieved purely through **HTML source order**. This is fine but means `cs-split` and `cs-split--flip` render identically on mobile. Future sessions should not try to "fix" this with CSS — it's intentional.

### Background images on divs (WCAG)
- Case study images and hero images are `background-image` on `<div>` elements with `role="img"` and `aria-label`. This is the current pattern — do not switch to `<img>` elements without a broader refactor.
- The `aria-label` values are meaningful descriptions, not filenames.

### Unplaced images
- `Waitwell web/Waitwell-07.png` — added to folder but not currently used in any section after the feature pages section was updated to use `WaitWell-06.png`
- `Waitwell web/Waitwell-09.png` — added to folder, was briefly used in the brand guide section but replaced with `Waitwell-05.png`
- Review with the designer before adding or removing sections to accommodate these.

### One Exchange — ongoing project note
- The results section label reads "Status" (not "Results") because the engagement was ongoing when written
- The outcomes list notes "UI kit and component library with semantic variable system delivered" — confirmed completed
- The blockquote "Engagement ongoing — final handoff phase in progress" may need updating when the project closes

---

## WCAG AA Considerations

### Addressed
- **Contrast**: dark background (`#000`) with white text at 55% opacity (`rgba(255,255,255,0.55)`) passes AA for large text; body copy at 1rem meets minimum ratios
- **Focus states**: browser default focus rings are not suppressed (no `outline: none` anywhere)
- **Semantic HTML**: proper use of `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`, `<article>`, `<blockquote>`, `<ul>`/`<li>` throughout
- **ARIA**: `role="banner"`, `role="contentinfo"`, `aria-label` on nav, `aria-modal` on mobile overlay, `aria-expanded` on hamburger toggle (updated by JS), `role="list"` on process pills, `aria-hidden="true"` on all decorative SVGs
- **Skip navigation**: not currently implemented — outstanding TODO
- **Mobile nav**: overlay links dismiss on click, body scroll locked while open
- **Image alt text**: `role="img"` + `aria-label` on background-image divs (reasonable fallback)

### Outstanding / not addressed
- **Skip to main content link**: not present — should be added before any accessibility audit
- **`prefers-reduced-motion`**: scroll animations (`[data-animate]`, `[data-stagger]`, hero load) do not check `prefers-reduced-motion`. Users with vestibular disorders will see all animations regardless of OS setting. Mitigation: wrap animation CSS in `@media (prefers-reduced-motion: no-preference)`.
- **Colour contrast of `--text-muted`**: `rgba(255,255,255,0.55)` on `#000` = approximately 8:1 — passes AA. On `--bg-2` (#111) it remains above 4.5:1. On `--bg-3` (#1C1C1C) it is approximately 6.5:1 — still passes, but should be verified with a contrast tool if background surfaces change.
- **`--text-dim` at 40% opacity**: approximately 5.5:1 on `#000`. Passes AA for normal text at the sizes used (labels at 10px are technically below the 18px threshold for large text — marginal pass at best). Acceptable for decorative/supplementary labels but worth flagging.
- **Keyboard navigation through work rows**: work rows are `<a>` elements and keyboard-focusable, but the hover thumbnail state is purely visual with no focus equivalent.
- **Form on contact page**: contact page has no form — it's a mailto link and LinkedIn, so no form accessibility issues currently.
