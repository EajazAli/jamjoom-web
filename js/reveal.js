// Drives the site's ".reveal" fade/slide-up sections (see .reveal / .reveal.active
// in css/style.css). These were originally revealed by the page's scroll-hijacking
// carousel controller, which never initializes in this static export, so every
// ".reveal" element stayed permanently invisible. This adds "active" as each one
// scrolls into view instead, giving pages their scroll-in motion back.
(function () {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || !('IntersectionObserver' in window)) {
        items.forEach(function (el) { el.classList.add('active'); });
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

    items.forEach(function (el) { observer.observe(el); });
})();
