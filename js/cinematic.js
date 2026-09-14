// Scroll choreography for the homepage's five story sections.
//
// Each section sits in a tall .cine-block runway with its .home-screen pinned
// by native position:sticky. Scrolling that runway scrubs a timeline that
// reproduces the transition this template was built around:
//
//   1. step-1 stages in: the two hairlines draw themselves open, then the
//      headline and subtitle rise 50px into place.
//   2. a hold.
//   3. the handover. This is the signature move - step-1's headline and
//      subtitle do not fade out and get replaced, they TRAVEL to the exact
//      position their step-2 counterparts occupy, the subtitle shrinking out
//      of its oversized display scale into body scale on the way and picking
//      up the step-2 accent colour as it goes. step-2's own headline and
//      subtitle make the mirror-image journey, so the two read as one piece
//      of type moving. Underneath, the white panel slides in from off the
//      right edge, the photo slides in behind it, the corner block rises and
//      stretches, and the hairlines dim out.
//   4. the body copy and the link rise 100px, staggered, once the type has
//      landed.
//
// The timings, offsets and easings below are the template's own (GSAP
// TimelineMax with Expo/Sine easing, in seconds); they are laid out here on a
// virtual 2-second timeline and then mapped onto scroll progress, so the
// motion keeps its original shape and rhythm while staying scrubbed to the
// scrollbar rather than hijacking the wheel.
//
// Progress is also eased toward the scroll position each frame rather than
// tracking it 1:1. Straight 1:1 scrubbing feels mushy - it makes the motion
// only ever as smooth as the visitor's trackpad. The lerp gives the timeline
// its own momentum, which is most of what makes a transition feel "animated"
// instead of "dragged".
//
// One hard rule, learned the hard way: several elements carry a PERMANENT
// transform from the stylesheet - the story subtitles are sized by
// font-size + transform:scale(), not by font-size alone, so their layout box
// is much narrower than the text they draw. Every transform written here
// therefore re-states the element's base scale explicitly, and the geometry
// is measured with inline transforms cleared. Never write a bare translate
// onto one of these; it silently resizes the type.
(function () {
    var MIN_WIDTH = 1024;

    var blocks = Array.prototype.slice.call(document.querySelectorAll('.cine-block'));
    if (!blocks.length) return;

    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ------------------------------------------------------------- easing
    function clamp01(n) {
        return n < 0 ? 0 : n > 1 ? 1 : n;
    }

    function expoInOut(t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        return t < 0.5
            ? Math.pow(2, 20 * t - 10) / 2
            : (2 - Math.pow(2, -20 * t + 10)) / 2;
    }

    function expoOut(t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        return 1 - Math.pow(2, -10 * t);
    }

    function sineIn(t) {
        return 1 - Math.cos((clamp01(t) * Math.PI) / 2);
    }

    // --------------------------------------------------- timeline mapping
    // The template's timelines are written in seconds. Keep them in seconds
    // here too - it is the only way to stay honest to the original rhythm -
    // and convert to scroll progress at the point of use.
    var IN_START = 0.0, IN_SPAN = 0.24, IN_SECONDS = 1.6;   // step-1 staging in
    var GO_START = 0.30, GO_SPAN = 0.64, GO_SECONDS = 2.0;  // the handover

    function segIn(p, at, dur, ease) {
        var from = IN_START + (at / IN_SECONDS) * IN_SPAN;
        var to = IN_START + ((at + dur) / IN_SECONDS) * IN_SPAN;
        return ease(clamp01((p - from) / (to - from)));
    }

    function segGo(p, at, dur, ease) {
        var from = GO_START + (at / GO_SECONDS) * GO_SPAN;
        var to = GO_START + ((at + dur) / GO_SECONDS) * GO_SPAN;
        return ease(clamp01((p - from) / (to - from)));
    }

    // ------------------------------------------------------------- helpers
    // The scale baked into an element's stylesheet transform, so we can
    // re-state it instead of destroying it.
    function baseScale(el) {
        if (!el) return 1;
        var t = getComputedStyle(el).transform;
        if (!t || t === 'none') return 1;
        var m = t.match(/matrix\(([^)]+)\)/);
        if (!m) return 1;
        var a = parseFloat(m[1].split(',')[0]);
        return isNaN(a) || a === 0 ? 1 : a;
    }

    function rgb(el, fallback) {
        if (!el) return fallback;
        var c = getComputedStyle(el).color.match(/(\d+(?:\.\d+)?)/g);
        return c ? [+c[0], +c[1], +c[2]] : fallback;
    }

    function mixColor(a, b, t) {
        return 'rgb(' +
            Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
            Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
            Math.round(a[2] + (b[2] - a[2]) * t) + ')';
    }

    function q(block, sel) {
        return block.querySelector(sel);
    }

    // --------------------------------------------------------------- scenes
    var scenes = blocks.map(function (block) {
        return {
            block: block,
            // The pinned panel. Its height is the viewport minus the fixed
            // nav bar, not the whole viewport, so it - not window.innerHeight
            // - is what the runway has to be measured against.
            sticky: q(block, '.cine-sticky'),
            title1: q(block, '.home-screen__step-1__content__title'),
            sub1: q(block, '.home-screen__step-1__content__subtitle'),
            lines1: Array.prototype.slice.call(
                block.querySelectorAll('.home-screen__step-1__lines__line')),
            title2: q(block, '.home-screen__step-2__content__inner__title'),
            sub2: q(block, '.home-screen__step-2__content__inner__subtitle'),
            body2: q(block, '.home-screen__step-2__content__inner__body'),
            link2: q(block, '.home-screen__step-2__content__inner__link'),
            bg2: q(block, '.home-screen__step-2__bg'),
            img2: q(block, '.home-screen__step-2__img'),
            corner2: q(block, '.home-screen__step-2__corner'),
            geo: null
        };
    });

    // Measure the two resting positions the type travels between. Done with
    // inline transforms cleared so we read layout boxes, not animated ones -
    // and because transform-origin on the subtitles is "left top", a scaled
    // subtitle's top-left corner is its layout top-left, which is exactly the
    // point we want to line up.
    function measure(scene) {
        [scene.title1, scene.sub1, scene.title2, scene.sub2,
            scene.body2, scene.link2, scene.bg2, scene.img2, scene.corner2]
            .forEach(function (el) { if (el) el.style.transform = ''; });

        var geo = {
            s1: baseScale(scene.sub1),
            s2: baseScale(scene.sub2),
            white: rgb(scene.sub1, [255, 255, 255]),
            accent: rgb(scene.sub2, [2, 169, 100]),
            titleDX: 0, titleDY: 0, subDX: 0, subDY: 0
        };

        if (scene.title1 && scene.title2) {
            var a = scene.title1.getBoundingClientRect();
            var b = scene.title2.getBoundingClientRect();
            geo.titleDX = b.left - a.left;
            geo.titleDY = b.top - a.top;
        }
        if (scene.sub1 && scene.sub2) {
            var c = scene.sub1.getBoundingClientRect();
            var d = scene.sub2.getBoundingClientRect();
            geo.subDX = d.left - c.left;
            geo.subDY = d.top - c.top;
        }
        scene.geo = geo;
    }

    function draw(scene, p) {
        var g = scene.geo;
        if (!g) return;
        var W = window.innerWidth;

        // --- act one: step-1 stages in --------------------------------
        // .from(line[0], .9, {scaleY:0, Expo.easeInOut}, 0)
        // .from(line[1], 1.2, {scaleY:0, Expo.easeInOut}, 0)
        // .staggerFrom([title, subtitle], .7, {y:50, opacity:0, Expo.easeOut}, .06, .4)
        var inTitle = segIn(p, 0.40, 0.7, expoOut);
        var inSub = segIn(p, 0.46, 0.7, expoOut);

        // --- act three: the handover ----------------------------------
        var goTitle = segGo(p, 0.7, 0.7, expoInOut);   // type travels
        var goSub = segGo(p, 0.8, 0.7, expoInOut);
        var goTint = segGo(p, 0.8, 0.5, sineIn);       // subtitle takes the accent
        var goLines = segGo(p, 0.7, 1.0, function (t) { return t; });
        var goBg = segGo(p, 0.7, 0.8, expoInOut);      // white panel in from the right
        var goImg = segGo(p, 0.7, 1.1, expoOut);       // photo in behind it
        var goCornerY = segGo(p, 0.2, 0.7, expoInOut);
        var goCornerX = segGo(p, 0.8, 0.7, expoInOut);
        var goBody = segGo(p, 1.2, 0.7, expoOut);
        var goLink = segGo(p, 1.3, 0.7, expoOut);

        // step-1 headline: rises in, then flies to where step-2's sits.
        if (scene.title1) {
            scene.title1.style.transform = 'translate3d(' +
                (g.titleDX * goTitle).toFixed(2) + 'px,' +
                (50 * (1 - inTitle) + g.titleDY * goTitle).toFixed(2) + 'px,0)';
            scene.title1.style.opacity = String(inTitle * (1 - goTitle));
        }

        // step-1 subtitle: same journey, but it also unwinds its display
        // scale into step-2's body scale, and tints on the way across.
        if (scene.sub1) {
            var k1 = g.s1 + (g.s2 - g.s1) * goSub;
            scene.sub1.style.transform = 'translate3d(' +
                (g.subDX * goSub).toFixed(2) + 'px,' +
                (50 * (1 - inSub) + g.subDY * goSub).toFixed(2) + 'px,0) scale(' +
                k1.toFixed(4) + ')';
            scene.sub1.style.opacity = String(inSub * (1 - goSub));
            scene.sub1.style.color = mixColor(g.white, g.accent, goTint);
        }

        // Hairlines draw open, then dim out under the handover.
        scene.lines1.forEach(function (line, i) {
            var t = segIn(p, 0, i === 0 ? 0.9 : 1.2, expoInOut);
            line.style.transform = 'scaleY(' + t.toFixed(4) + ')';
            line.style.opacity = String(0.15 * (1 - goLines));
        });

        // step-2 headline and subtitle: the mirror journey, arriving from
        // step-1's resting position and scale.
        if (scene.title2) {
            scene.title2.style.transform = 'translate3d(' +
                (-g.titleDX * (1 - goTitle)).toFixed(2) + 'px,' +
                (-g.titleDY * (1 - goTitle)).toFixed(2) + 'px,0)';
            scene.title2.style.opacity = String(goTitle);
        }
        if (scene.sub2) {
            var k2 = g.s2 + (g.s1 - g.s2) * (1 - goSub);
            scene.sub2.style.transform = 'translate3d(' +
                (-g.subDX * (1 - goSub)).toFixed(2) + 'px,' +
                (-g.subDY * (1 - goSub)).toFixed(2) + 'px,0) scale(' +
                k2.toFixed(4) + ')';
            scene.sub2.style.opacity = String(goSub);
        }

        // Body copy and link rise once the type has landed.
        if (scene.body2) {
            scene.body2.style.transform =
                'translate3d(0,' + (100 * (1 - goBody)).toFixed(2) + 'px,0)';
            scene.body2.style.opacity = String(goBody);
        }
        if (scene.link2) {
            scene.link2.style.transform =
                'translate3d(0,' + (100 * (1 - goLink)).toFixed(2) + 'px,0)';
            scene.link2.style.opacity = String(goLink);
        }

        // Panels slide in off the right edge; the corner rises and stretches.
        if (scene.bg2) {
            scene.bg2.style.transform =
                'translate3d(' + (W * (1 - goBg)).toFixed(2) + 'px,0,0)';
        }
        if (scene.img2) {
            scene.img2.style.transform =
                'translate3d(' + (100 * (1 - goImg)).toFixed(2) + '%,0,0)';
        }
        if (scene.corner2) {
            scene.corner2.style.transformOrigin = 'right bottom';
            scene.corner2.style.transform = 'translate3d(' +
                (0.3 * W * (1 - goCornerX)).toFixed(2) + 'px,' +
                (100 * (1 - goCornerY)).toFixed(2) + '%,0) scaleX(' +
                (0.5 + 0.5 * goCornerX).toFixed(4) + ')';
        }
    }

    function clear(scene) {
        [scene.title1, scene.sub1, scene.title2, scene.sub2, scene.body2,
            scene.link2, scene.bg2, scene.img2, scene.corner2]
            .concat(scene.lines1)
            .forEach(function (el) {
                if (!el) return;
                el.style.opacity = '';
                el.style.transform = '';
                el.style.transformOrigin = '';
                el.style.color = '';
            });
    }

    // ----------------------------------------------------------- the driver
    var running = false;
    var rafId = 0;
    var eased = [];     // per-scene displayed progress
    var target = [];    // per-scene scroll progress

    function readTargets() {
        var vh = window.innerHeight;
        var anyLive = false;
        scenes.forEach(function (scene, i) {
            var rect = scene.block.getBoundingClientRect();
            if (rect.bottom < -vh || rect.top > vh * 2) {
                target[i] = null;
                return;
            }
            anyLive = true;
            // How far the pinned panel has slid down inside its own block:
            // zero until the block reaches the pin point, then growing to
            // fill the runway. Derived from the panel rather than assumed,
            // so it stays correct whatever offset the panel pins at (here,
            // the height of the fixed nav bar).
            var pin = scene.sticky || scene.block;
            var travelled = pin.getBoundingClientRect().top - rect.top;
            var runway = rect.height - pin.offsetHeight;
            target[i] = runway > 0 ? clamp01(travelled / runway) : 0;
        });
        return anyLive;
    }

    function frame() {
        readTargets();
        var settling = false;
        scenes.forEach(function (scene, i) {
            var t = target[i];
            if (t === null || t === undefined) return;
            if (eased[i] === undefined) eased[i] = t;
            // Ease toward the scroll position instead of snapping to it, so
            // the timeline carries its own momentum. Close enough, just land.
            var d = t - eased[i];
            if (Math.abs(d) < 0.0005) {
                eased[i] = t;
            } else {
                eased[i] += d * 0.16;
                settling = true;
            }
            draw(scene, eased[i]);
        });
        // Idle out once everything has caught up; the scroll listener wakes
        // the loop again. No point holding a rAF on a page nobody is moving.
        rafId = settling ? requestAnimationFrame(frame) : 0;
    }

    function wake() {
        if (running && !rafId) rafId = requestAnimationFrame(frame);
    }

    // Snap straight to the scroll position with no easing. Used whenever the
    // geometry has just been re-measured: measure() has to clear the inline
    // transforms to read layout boxes, so something must put them back in the
    // same tick rather than waiting on the next animation frame.
    function paint() {
        readTargets();
        scenes.forEach(function (scene, i) {
            var t = target[i];
            if (t === null || t === undefined) return;
            eased[i] = t;
            draw(scene, t);
        });
    }

    function remeasure() {
        scenes.forEach(measure);
        paint();
    }

    function start() {
        if (running) return;
        running = true;
        document.documentElement.classList.add('cine-mode');
        document.documentElement.classList.remove('cine-fade');
        eased = [];
        // .cine-mode changes the layout these offsets are measured against,
        // so measure only after it is applied.
        remeasure();
        window.addEventListener('scroll', wake, { passive: true });
    }

    function stop() {
        if (!running) return;
        running = false;
        document.documentElement.classList.remove('cine-mode');
        document.documentElement.classList.add('cine-fade');
        window.removeEventListener('scroll', wake);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        scenes.forEach(clear);
    }

    function sync() {
        if (!prefersReduced && window.innerWidth >= MIN_WIDTH) {
            if (running) remeasure();
            else start();
        } else {
            stop();
        }
    }

    sync();

    // Only react to a change in WIDTH. On phones and tablets the browser
    // fires resize every time its own URL bar slides in or out, which is
    // constantly while you scroll - and re-measuring clears every inline
    // transform for an instant, so honouring those events made the page
    // visibly flicker and jump as you scrolled. Height alone never changes
    // any of the geometry measured here.
    var lastWidth = window.innerWidth;
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(sync, 150);
    });

    // Web fonts land after first paint and change the metrics these offsets
    // are measured from, so take the measurements again once they are in.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
            if (running) remeasure();
        });
    }

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
