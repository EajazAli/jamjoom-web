// Original scroll-driven controller for the homepage's five ".cine-block"
// story sections (see .cine-mode rules in css/style.css). Each block is a
// tall (220vh) runway with its ".home-screen" pinned via native
// position:sticky. As the visitor scrolls through that runway, this pins the
// section in place while step-1 (the big title over video) fades/lifts out
// and step-2 (the detailed content panel, with a background parallax layer)
// fades/rises in underneath it, then releases into the next block.
//
// Progressive enhancement: only activates on wide viewports when the visitor
// hasn't asked for reduced motion. Otherwise the blocks are left exactly as
// the sitewide fallback (see the plain ".js .home-screen" rules in
// css/style.css) already renders them: a normal stacked, reveal-on-scroll page.

// Unconditional, independent of the above: the homepage has six background
// videos (hero + one per story section) that all carry "autoplay", so a
// browser will happily decode all six at once even though at most one or two
// are ever on screen. Play only the ones near the viewport; pause the rest.
// Runs regardless of viewport width or reduced-motion, since it's purely a
// bandwidth/battery/performance fix, not a motion effect.
(function () {
    var videos = Array.prototype.slice.call(document.querySelectorAll('#home-page video[autoplay]'));
    if (!videos.length || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var v = entry.target;
            if (entry.isIntersecting) {
                v.play().catch(function () {});
            } else {
                v.pause();
            }
        });
    }, { rootMargin: '50% 0px 50% 0px' });

    videos.forEach(function (v) { io.observe(v); });
})();

(function () {
    var MIN_WIDTH = 1024;
    var blocks = Array.prototype.slice.call(document.querySelectorAll('.cine-block'));
    if (!blocks.length) return;

    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    var entries = blocks.map(function (block) {
        return {
            block: block,
            step1: block.querySelector('.home-screen__step-1'),
            step2: block.querySelector('.home-screen__step-2'),
            bg1: block.querySelector('.home-screen__step-1__bg'),
            bg2: block.querySelector('.home-screen__step-2__img, .home-screen__step-2__bg')
        };
    });

    var active = false;
    var ticking = false;

    function clamp01(n) {
        return Math.max(0, Math.min(1, n));
    }

    function render() {
        ticking = false;
        var vh = window.innerHeight;
        entries.forEach(function (entry) {
            var rect = entry.block.getBoundingClientRect();
            var runway = rect.height - vh;
            var progress = runway > 0 ? clamp01(-rect.top / runway) : 0;

            var out1 = clamp01(progress / 0.45);
            var in2 = clamp01((progress - 0.4) / 0.6);

            if (entry.step1) {
                entry.step1.style.opacity = String(1 - out1);
                entry.step1.style.transform = 'translateY(' + (out1 * -60) + 'px)';
            }
            if (entry.step2) {
                entry.step2.style.opacity = String(in2);
                entry.step2.style.transform = 'translateY(' + ((1 - in2) * 50) + 'px)';
            }
            if (entry.bg1) {
                entry.bg1.style.transform = 'translateY(' + (progress * 40) + 'px)';
            }
            if (entry.bg2) {
                entry.bg2.style.transform = 'translateY(' + ((1 - in2) * 30) + 'px)';
            }
        });
    }

    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(render);
        }
    }

    function reset() {
        entries.forEach(function (entry) {
            [entry.step1, entry.step2, entry.bg1, entry.bg2].forEach(function (el) {
                if (el) {
                    el.style.opacity = '';
                    el.style.transform = '';
                }
            });
        });
    }

    function enable() {
        if (active) return;
        active = true;
        document.documentElement.classList.add('cine-mode');
        window.addEventListener('scroll', onScroll, { passive: true });
        render();
    }

    function disable() {
        if (!active) return;
        active = false;
        document.documentElement.classList.remove('cine-mode');
        window.removeEventListener('scroll', onScroll);
        reset();
    }

    function sync() {
        if (window.innerWidth >= MIN_WIDTH) {
            enable();
        } else {
            disable();
        }
    }

    sync();
    window.addEventListener('resize', sync);
})();
