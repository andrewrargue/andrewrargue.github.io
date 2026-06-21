// ─── Nav scroll state ─────────────────────────────────────
const nav = document.querySelector('.nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ─── Mobile nav ───────────────────────────────────────────
const hamburger = document.querySelector('.nav__hamburger');
const overlay   = document.querySelector('.nav__overlay');
if (hamburger && overlay) {
  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
    overlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  overlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ─── Active nav link ──────────────────────────────────────
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a').forEach(a => {
  if (a.getAttribute('href') === currentPath) a.classList.add('active');
});

// ─── Hero load animation ──────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('hero-loaded');
    });
  });
});

// ─── Scroll animations (Intersection Observer) ────────────
const animateObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        animateObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  }
);

document.querySelectorAll('[data-animate], [data-stagger]').forEach(el => {
  animateObserver.observe(el);
});
