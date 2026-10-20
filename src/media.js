// The "Watch the Double Click" panel: a native video player at the top of every guide that has a
// verified episode, and the showcase on the catalogue home.
//
// Where it goes. src/transform-export.mjs adds two empty mount points to the guide document:
// [data-sa-media-slot="guide"] above the walkthrough and [data-sa-media-slot="home"] between the
// home hero and the task grid. The runtime renders them childless and leaves alone whatever is put
// inside them for as long as their parent stays mounted (proved before this file was written), so
// the panel is built once per video and never re-created by a re-render. That matters: a playing
// <video> that is removed from the document stops.
//
// What it plays. build.mjs replaces the manifest placeholder below with the shipped items only,
// every path relative to the page, so the video, its poster and its caption tracks all load from
// the site's own origin. A guide with no item gets no panel and no gap. window.__saMediaManifest
// overrides the built manifest so the tests can inject fixture media (scripts/lib/media-fixture.mjs).
//
// How it behaves.
//   - preload="none": nothing of the video downloads until the reader presses play, which protects
//     the Pages bandwidth budget. The poster still loads. Never autoplay, muted or loop.
//   - Eleven caption tracks, one per locale, labelled with the language's own name and never
//     translated; the reader's locale is the default. A locale switch moves showing captions to the
//     new language, or leaves them off if the reader turned them off.
//   - The transcript is the same caption text, fetched when the reader opens it, in their language.
//   - Panel strings are written in English and src/i18n-apply.js translates them like any other page
//     text, which keeps them right after a language switch; a t() call here would freeze whichever
//     language was active when the panel was built (see src/feedback.js). The transcript body is
//     already localized, so i18n-apply skips it.
//
// Elements are built with createElement and textContent only. Nothing from the manifest is ever
// parsed as HTML.
(function () {
  'use strict';

  var MANIFEST = window.__saMediaManifest || __SA_MEDIA_MANIFEST__;

  var SLOT = '[data-sa-media-slot]';
  var RAW_TEMPLATE = 'x-dc, sc-if, sc-for';
  var PANEL = 'lsa-media';
  var HEADING_ID = 'lsa-media-h';
  var SUMMARY_ID = 'lsa-media-tx';
  // Every path the panel loads must be a plain relative path under media/: no scheme, no host, no
  // leading slash, no "..". Anything else is dropped, so a bad manifest cannot point the page at
  // another origin or outside the published media directory.
  var SAFE_PATH = /^media\/[a-z0-9_.\/-]+$/;
  var SAFE_KEY = /^[a-z0-9-]+$/;
  var SHOWCASE = 'showcase';

  // Used only when src/i18n.js failed to load, so the panel still plays with English captions.
  var FALLBACK_LOCALES = [{ code: 'en-us', htmlLang: 'en-US', nativeName: 'English' }];

  // ---- manifest ----------------------------------------------------------------
  function safePath(p) {
    return typeof p === 'string' && SAFE_PATH.test(p) && p.indexOf('..') === -1;
  }

  function validItem(key, item) {
    if (!SAFE_KEY.test(key) || !item || typeof item !== 'object') return false;
    if (item.kind !== 'episode' && item.kind !== SHOWCASE) return false;
    if (!safePath(item.src) || !safePath(item.poster)) return false;
    var caps = item.captions;
    if (!caps || typeof caps !== 'object') return false;
    for (var code in caps) {
      if (Object.prototype.hasOwnProperty.call(caps, code) && !safePath(caps[code])) return false;
    }
    return true;
  }

  var ITEMS = {};
  (function () {
    var items = (MANIFEST && MANIFEST.items) || {};
    for (var key in items) {
      if (!Object.prototype.hasOwnProperty.call(items, key)) continue;
      if (validItem(key, items[key])) ITEMS[key] = items[key];
      else if (window.console) console.warn('[sa] media item ignored, its paths are not under media/:', key);
    }
  })();

  // ---- helpers -----------------------------------------------------------------
  function track() { if (window.__saTrack) window.__saTrack.apply(null, arguments); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function locales() {
    var loc = window.__saLocale;
    return (loc && loc.locales && loc.locales.length) ? loc.locales : FALLBACK_LOCALES;
  }

  // The locale whose words are actually on the page: the one whose htmlLang src/i18n.js put on
  // <html>. That is the reader's choice whenever a catalogue exists for it, which today is all of
  // them, and English otherwise. Captions and the transcript follow it, so they never claim a
  // language the rest of the page is not in.
  function servedLocale() {
    var lang = document.documentElement.getAttribute('lang') || '';
    var list = locales();
    for (var i = 0; i < list.length; i++) if (list[i].htmlLang === lang) return list[i];
    var loc = window.__saLocale;
    var code = loc && loc.get ? loc.get() : 'en-us';
    for (var j = 0; j < list.length; j++) if (list[j].code === code) return list[j];
    return list[0];
  }

  // 94.2 -> "1:34". Episodes are capped at 900 seconds, so minutes never need an hours field.
  function clock(seconds) {
    var s = Math.max(0, Math.round(seconds));
    var r = s % 60;
    return Math.floor(s / 60) + ':' + (r < 10 ? '0' : '') + r;
  }

  function slotKey(slot) {
    if (slot.getAttribute('data-sa-media-slot') === 'home') return SHOWCASE;
    return (location.hash || '').replace(/^#\//, '');
  }

  // ---- panel -------------------------------------------------------------------
  var mounted = [];   // every panel built and not yet torn down, in or out of the document

  function render(key, item) {
    var served = servedLocale();

    var panel = el('section', PANEL);
    panel.setAttribute('aria-labelledby', HEADING_ID);
    panel.setAttribute('data-sa-media-key', key);

    var h = el('h2', 'lsa-media-title');
    h.id = HEADING_ID;
    h.appendChild(el('span', '', item.kind === SHOWCASE ? 'Watch the Spatial Adjust overview' : 'Watch the Double Click'));
    if (typeof item.duration === 'number' && isFinite(item.duration) && item.duration > 0) {
      h.appendChild(document.createTextNode(' '));
      h.appendChild(el('span', 'lsa-media-dur', '(' + clock(item.duration) + ')'));
    }
    panel.appendChild(h);

    var frame = el('div', 'lsa-media-frame');
    var video = el('video');
    video.setAttribute('controls', '');
    video.setAttribute('preload', 'none');
    video.setAttribute('playsinline', '');
    video.setAttribute('poster', item.poster);
    video.setAttribute('aria-labelledby', HEADING_ID);

    var source = el('source');
    source.setAttribute('src', item.src);
    source.setAttribute('type', 'video/mp4');
    video.appendChild(source);

    var list = locales();
    for (var i = 0; i < list.length; i++) {
      var l = list[i];
      var path = item.captions[l.code];
      if (!path) continue;
      var t = el('track');
      t.setAttribute('kind', 'captions');
      t.setAttribute('src', path);
      t.setAttribute('srclang', l.htmlLang);       // ko-KR, never IntelliDash's ko-ko
      t.setAttribute('label', l.nativeName);       // an endonym: never translated
      if (l.code === served.code) t.setAttribute('default', '');
      video.appendChild(t);
    }
    video.appendChild(document.createTextNode('Your browser cannot play this video. Read the transcript below.'));
    frame.appendChild(video);
    panel.appendChild(frame);

    var details = el('details', 'lsa-media-transcript');
    var summary = el('summary', '', 'Transcript');
    summary.id = SUMMARY_ID;
    details.appendChild(summary);
    var body = el('div', 'lsa-media-transcript-body');
    // Scrollable once it is longer than its max-height, so it has to be reachable by keyboard.
    body.setAttribute('tabindex', '0');
    body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', SUMMARY_ID);
    details.appendChild(body);
    panel.appendChild(details);

    panel.__sa = { key: key, item: item, video: video, details: details, body: body, request: 0 };
    // Bound to the element rather than delegated: toggle does not bubble, and this element is never
    // re-created by the runtime, so the listener lives exactly as long as the panel.
    details.addEventListener('toggle', function () { if (details.open) loadTranscript(panel); });
    return panel;
  }

  // Stop the video and abandon its download. Removing the source and calling load() is the
  // documented way to make a media element drop a request in flight; pausing alone keeps buffering.
  function abort(panel) {
    var v = panel.__sa && panel.__sa.video;
    if (!v) return;
    try { v.pause(); } catch (e) { /* already detached */ }
    var sources = v.getElementsByTagName('source');
    for (var i = 0; i < sources.length; i++) sources[i].removeAttribute('src');
    v.removeAttribute('src');
    try { v.load(); } catch (e) { /* nothing to abort */ }
  }

  function unmount(panel) {
    abort(panel);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
    var i = mounted.indexOf(panel);
    if (i !== -1) mounted.splice(i, 1);
  }

  function panelIn(slot) {
    for (var c = slot.firstElementChild; c; c = c.nextElementSibling) {
      if (c.classList && c.classList.contains(PANEL)) return c;
    }
    return null;
  }

  // ---- transcript --------------------------------------------------------------
  var transcripts = {};   // caption URL -> parsed cues, so reopening costs no second request

  var ENTITIES = { amp: '&', lt: '<', gt: '>', nbsp: ' ', lrm: '‎', rlm: '‏' };
  function decode(text) {
    return text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-z]+));/g, function (all, dec, hex, name) {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : all;
    });
  }

  function seconds(stamp) {
    var m = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(stamp);
    if (!m) return null;
    return (Number(m[1] || 0) * 60 + Number(m[2])) * 60 + Number(m[3]);
  }

  // WebVTT to [{ at, text }]. Blocks are separated by blank lines; the first is the header, NOTE,
  // STYLE and REGION blocks are skipped, and a cue's text is every line after its "-->" line.
  function parseVtt(text) {
    var blocks = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/);
    var cues = [];
    for (var i = 1; i < blocks.length; i++) {
      var lines = blocks[i].replace(/^\n+/, '').split('\n');
      if (/^(NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) continue;
      var at = -1;
      for (var j = 0; j < lines.length; j++) if (lines[j].indexOf('-->') !== -1) { at = j; break; }
      if (at === -1) continue;
      var start = seconds(lines[at].split('-->')[0].trim());
      var cueText = decode(lines.slice(at + 1).join(' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
      if (start === null || !cueText) continue;
      cues.push({ at: start, text: cueText });
    }
    return cues;
  }

  function showTranscript(panel, cues, served) {
    var body = panel.__sa.body;
    body.textContent = '';
    body.setAttribute('lang', served.htmlLang);
    for (var i = 0; i < cues.length; i++) {
      var p = el('p');
      p.appendChild(el('span', 'lsa-media-ts', clock(cues[i].at)));
      p.appendChild(document.createTextNode(' ' + cues[i].text));
      body.appendChild(p);
    }
  }

  // The failure message sits outside the transcript body, which i18n-apply skips, so it is
  // translated like the rest of the panel's own words.
  function transcriptError(panel, show) {
    var details = panel.__sa.details;
    var old = details.querySelector('.lsa-media-transcript-error');
    if (old) old.parentNode.removeChild(old);
    if (!show) return;
    var msg = el('p', 'lsa-media-transcript-error', 'The transcript could not be loaded.');
    msg.setAttribute('role', 'status');
    details.appendChild(msg);
  }

  function loadTranscript(panel) {
    var state = panel.__sa;
    var served = servedLocale();
    var url = state.item.captions[served.code] || state.item.captions['en-us'];
    // A reader who switches language while a fetch is in flight gets the newer language only.
    var request = ++state.request;
    var done = function (cues) {
      if (request !== state.request) return;
      transcriptError(panel, false);
      showTranscript(panel, cues, served);
    };
    var fail = function () {
      if (request !== state.request) return;
      state.body.textContent = '';
      state.body.removeAttribute('lang');
      transcriptError(panel, true);
    };
    if (!url) return fail();
    if (transcripts[url]) return done(transcripts[url]);
    state.body.setAttribute('aria-busy', 'true');
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        var cues = parseVtt(text);
        if (!cues.length) throw new Error('no cues');
        transcripts[url] = cues;
        state.body.removeAttribute('aria-busy');
        done(cues);
      })
      .catch(function () { state.body.removeAttribute('aria-busy'); fail(); });
  }

  // ---- locale ------------------------------------------------------------------
  // Captions follow the page language only if the reader has them on. A reader who turned them off
  // is not handed them back by a language switch. The video element is left exactly as it is, so a
  // video that is playing keeps playing.
  function onLocaleChange() {
    var served = servedLocale();
    for (var i = 0; i < mounted.length; i++) {
      var state = mounted[i].__sa;
      var tracks = state.video.textTracks;
      var showing = false;
      for (var j = 0; j < tracks.length; j++) if (tracks[j].mode === 'showing') showing = true;
      if (showing) {
        for (var k = 0; k < tracks.length; k++) {
          tracks[k].mode = tracks[k].language === served.htmlLang ? 'showing' : 'disabled';
        }
      }
      if (state.details.open) loadTranscript(mounted[i]);
    }
  }

  // ---- lifecycle ---------------------------------------------------------------
  // Per slot: no item -> no panel; the same key already mounted -> leave it alone (it may be
  // playing); another key -> stop and abandon the old video, then build the new one. Guide-to-guide
  // navigation keeps the same slot, so this is what swaps the episode.
  function sync() {
    // Panels the runtime removed with their slot (going home unmounts the guide) stop downloading.
    for (var i = mounted.length - 1; i >= 0; i--) {
      if (!document.documentElement.contains(mounted[i])) unmount(mounted[i]);
    }
    var slots = document.querySelectorAll(SLOT);
    for (var s = 0; s < slots.length; s++) {
      var slot = slots[s];
      // The export's raw template sits in the page, inside <x-dc>, until the runtime replaces it,
      // and it holds both slots at once, unevaluated. Mounting there would request the showcase
      // poster and captions on every deep link to a guide, for a panel nobody ever sees.
      if (slot.closest(RAW_TEMPLATE)) continue;
      var key = slotKey(slot);
      var item = key && Object.prototype.hasOwnProperty.call(ITEMS, key) ? ITEMS[key] : null;
      var panel = panelIn(slot);
      if (panel && item && panel.__sa && panel.__sa.key === key) continue;
      if (panel) unmount(panel);
      if (!item) continue;
      panel = render(key, item);
      slot.appendChild(panel);
      mounted.push(panel);
    }
  }

  // Coalesced exactly as src/feedback.js does: the runtime mutates the tree constantly, and the
  // panel's own insertion would otherwise re-enter this synchronously.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; sync(); });
  }

  // ---- keyboard ----------------------------------------------------------------
  // The guide binds Space (Play all), the arrow keys (previous and next step) and Escape (back to
  // the catalogue) on window. Inside the panel those keys belong to the player: Space plays and
  // pauses, the arrows seek, and Space opens the transcript. Stopping propagation at document keeps
  // the guide's window listener from also acting on them, and from cancelling the native action
  // with preventDefault, the same way src/a11y.js lets a focused control win.
  document.addEventListener('keydown', function (ev) {
    var target = ev.target;
    if (!target || typeof target.closest !== 'function' || !target.closest('.' + PANEL)) return;
    var key = ev.key;
    if (key === ' ' || key === 'Spacebar' || key === 'ArrowLeft' || key === 'ArrowRight') { ev.stopPropagation(); return; }
    if (key === 'Escape' && target.closest('video')) ev.stopPropagation();
  });

  // ---- events ------------------------------------------------------------------
  // Media events do not bubble, but every event passes document in the capture phase on its way to
  // its target, so one listener here sees the video of whichever panel is mounted, real playback and
  // synthetic test events alike. video_played counts playthroughs, not presses of play: the flag on
  // the element is set by the first play after the panel was built or after the video last ended,
  // so pausing to try a step in IntelliDash and resuming records nothing new. Key, locale and kind
  // only; no watch position (see src/analytics.js).
  function panelOf(ev) {
    var v = ev.target;
    if (!v || v.tagName !== 'VIDEO' || typeof v.closest !== 'function') return null;
    var panel = v.closest('.' + PANEL);
    return panel && panel.__sa && panel.__sa.video === v ? panel : null;
  }

  function eventProps(panel) {
    var loc = window.__saLocale;
    return { key: panel.__sa.key, locale: (loc && loc.get && loc.get()) || 'en-us', kind: panel.__sa.item.kind };
  }

  document.addEventListener('play', function (ev) {
    var panel = panelOf(ev);
    if (!panel || ev.target.__saPlayed) return;
    ev.target.__saPlayed = true;
    track('video_played', eventProps(panel));
  }, true);

  document.addEventListener('ended', function (ev) {
    var panel = panelOf(ev);
    if (!panel) return;
    ev.target.__saPlayed = false;
    track('video_completed', eventProps(panel));
  }, true);

  if (window.__saLocale && window.__saLocale.onChange) window.__saLocale.onChange(onLocaleChange);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('popstate', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

  // For the tests: the keys of the items that passed the path check.
  window.__saMedia = { items: function () { return Object.keys(ITEMS); } };
})();
