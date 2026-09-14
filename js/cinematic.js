// Scroll choreography for the homepage's five story sections.
//
// Each section sits in a tall .cine-block runway with its .home-screen pinned
// by native position:sticky. Scrolling through that runway plays a timeline:
// step-1 (the big headline over footage) stages in, holds, then hands over to
// step-2 (the detail panel) while the background layers drift.
//
// Why this exists: the template's original controller lived in js/scripts.js
// and was driven by GSAP, but it never initializes in this static export, so
// every element used to sit frozen in its resting CSS state with no motion at
// all. This drives the same elements directly.
//
// One hard rule, learned the hard way: several elements carry a PERMANENT
// transform from the stylesheet - the story subtitles are sized by
// font-size + transform:scale(), not by font-size alone. Writing a transform
// onto those wipes their scale and silently resizes the type. So every
// element is probed once at startup, and anything already carrying a
// transform is animated by opacity only.
(function () {
    var MIN_WIDTH = 1024;

    var blocks = Array.prototype.slice.call(document.querySelectorAll('.cine-block'));
    if (!blocks.length) return;

    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------------------------------------------------------------- utils
    function clamp01(n) {
        return n < 0 ? 0 : n > 1 ? 1 : n;
    }

    // Normalise p into [from, to], then smooth it so nothing starts or stops
    // with a hard edge.
    function phase(p, from, to) {
        var t = clamp01((p - from) / (to - from));
        return t * t * (3 - 2 * t);
    }

    // An element is "locked" if the stylesheet already gives it a transform we
    // must not overwrite (see the note at the top).
    function track(el) {
        if (!el) return null;
        var base = getComputedStyle(el).transform;
        return { el: el, locked: base && base !== 'none' };
    }

    function apply(item, opacity, shiftY) {
        if (!item) return;
        item.el.style.opacity = String(opacity);
        if (!item.locked) {
            item.el.style.transform = shiftY ? 'translate3d(0,' + shiftY.toFixed(2) + 'px,0)' : 'translate3d(0,0,0)';
        }
    }

    // --------------------------------------------------------------- sections
    var scenes = blocks.map(function (block) {
        var step1 = block.querySelector('.home-screen__step-1');
        var step2 = block.querySelector('.home-screen__step-2');
        return {
            block: block,
            step1: track(step1),
            step2: track(step2),
            title1: track(block.querySelector('.home-screen__step-1__content__title')),
            sub1: track(block.querySelector('.home-screen__step-1__content__subtitle')),
            content1: track(block.querySelector('.home-screen__step-1__content')),
            bg1: track(block.querySelector('.home-screen__step-1__bg')),
            lines: Array.prototype.slice.call(
                block.querySelectorAll('.home-screen__step-1__lines__line')).map(track),
            inner2: track(block.querySelector('.home-screen__step-2__content__inner')),
            bg2: track(block.querySelector('.home-screen__step-2__img') ||
                block.querySelector('.home-screen__step-2__bg')),
            parts2: Array.prototype.slice.call(block.querySelectorAll(
                '.home-screen__step-2__content__inner__title,' +
                '.home-screen__step-2__content__inner__subtitle,' +
                '.home-screen__step-2__content__inner__body,' +
                '.home-screen__step-2__content__inner__link')).map(track)
        };
    });

    function draw(scene, p) {
        // Act one: the headline stages in over the footage, then holds.
        var enter = phase(p, 0, 0.18);
        var exit = phase(p, 0.40, 0.58);

        apply(scene.step1, 1 - exit, -exit * 70);
        apply(scene.content1, 1, (1 - enter) * 44);
        if (scene.title1) scene.title1.el.style.opacity = String(phase(p, 0.01, 0.16));
        if (scene.sub1) scene.sub1.el.style.opacity = String(phase(p, 0.06, 0.24));

        // The thin vertical rules draw themselves down alongside the headline.
        scene.lines.forEach(function (line, i) {
            if (!line || line.locked) return;
            var t = phase(p, 0.04 + i * 0.05, 0.30 + i * 0.05);
            line.el.style.transformOrigin = 'top center';
            line.el.style.transform = 'scaleY(' + t.toFixed(3) + ')';
        });

        // Act two: the detail panel rises in underneath, its parts staggered.
        // Starts as step-1 begins leaving so the two genuinely cross, rather
        // than both sitting faint through the middle of the handover.
        var arrive = phase(p, 0.40, 0.66);
        apply(scene.step2, arrive, (1 - arrive) * 56);
        apply(scene.inner2, 1, (1 - arrive) * 26);
        scene.parts2.forEach(function (part, i) {
            if (!part) return;
            var start = 0.50 + i * 0.05;
            part.el.style.opacity = String(phase(p, start, start + 0.26));
        });

        // Background planes drift slower than the copy, for depth.
        if (scene.bg1) scene.bg1.el.style.transform = 'translate3d(0,' + (p * 46).toFixed(2) + 'px,0)';
        if (scene.bg2 && !scene.bg2.locked) {
            scene.bg2.el.style.transform = 'translate3d(0,' + ((1 - arrive) * 34).toFixed(2) + 'px,0)';
        }
    }

    function clear(scene) {
        [scene.step1, scene.step2, scene.content1, scene.inner2, scene.bg1, scene.bg2,
            scene.title1, scene.sub1]
            .concat(scene.lines, scene.parts2)
            .forEach(function (item) {
                if (!item) return;
                item.el.style.opacity = '';
                item.el.style.transform = '';
            });
    }

    // ----------------------------------------------------------------- driver
    var running = false;
    var ticking = false;

    function render() {
        ticking = false;
        var vh = window.innerHeight;
        scenes.forEach(function (scene) {
            var rect = scene.block.getBoundingClientRect();
            // Leave sections that are nowhere near the viewport alone.
            if (rect.bottom < -vh || rect.top > vh * 2) return;
            var runway = rect.height - vh;
            draw(scene, runway > 0 ? clamp01(-rect.top / runway) : 0);
        });
    }

    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(render);
        }
    }

    function start() {
        if (running) return;
        running = true;
        document.documentElement.classList.add('cine-mode');
        document.documentElement.classList.remove('cine-fade');
        window.addEventListener('scroll', onScroll, { passive: true });
        render();
    }

    function stop() {
        if (!running) return;
        running = false;
        document.documentElement.classList.remove('cine-mode');
        document.documentElement.classList.add('cine-fade');
        window.removeEventListener('scroll', onScroll);
        scenes.forEach(clear);
    }

    function sync() {
        if (!prefersReduced && window.innerWidth >= MIN_WIDTH) start();
        else stop();
    }

    sync();
    window.addEventListener('resize', sync);

    // Narrow screens and reduced-motion visitors keep the panels as a plain
    // stacked page; give them a single gentle fade as each scrolls into view
    // rather than the pinned timeline.
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('cine-seen');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        document.querySelectorAll('#home-page .home-screen__step__content')
            .forEach(function (el) { io.observe(el); });
    }
})();
