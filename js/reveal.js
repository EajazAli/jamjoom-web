// Drives the site's ".reveal" fade/slide-up sections (see .reveal / .reveal.active
// in css/style.css). These were originally revealed by the page's scroll-hijacking
// carousel controller, which never initializes in this static export, so every
// ".reveal" element stayed permanently invisible. This adds "active" as each one
// scrolls into view instead, giving pages their scroll-in motion back.
(function () {
    // Claim the hidden starting state before anything else. The stylesheet
    // only applies "opacity:0" to .reveal when this class is present, so if
    // this file fails to load or throws, the content is simply visible
    // rather than permanently blank.
    document.documentElement.classList.add('reveal-js');

    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;

    function showAll() {
        items.forEach(function (el) { el.classList.add('active'); });
    }

    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || !('IntersectionObserver' in window)) {
        showAll();
        return;
    }

    // threshold 0 with a bottom margin, rather than "15% of the element
    // visible": several of these blocks are taller than the viewport, and a
    // percentage threshold can never be met by an element that does not fit
    // on screen - those sections would stay hidden no matter how far you
    // scrolled.
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });

    items.forEach(function (el) { observer.observe(el); });

    // Last line of defence: anything still hidden once the page has fully
    // loaded and settled gets shown regardless. Copy that never appears is
    // a far worse failure than an animation that does not play.
    window.addEventListener('load', function () {
        setTimeout(function () {
            items.forEach(function (el) {
                if (el.classList.contains('active')) return;
                var r = el.getBoundingClientRect();
                if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('active');
            });
        }, 400);
    });
})();
