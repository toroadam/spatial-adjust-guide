// Locale registry and language resolution for the Spatial Adjust guides.
//
// SOURCE OF TRUTH for the supported language set is IntelliDash itself, specifically the
// translateService.addLangs() call in:
//
//   site/src/app/common/services/app-initializer.service.ts:32-38
//
// Eleven locales: English plus ten translations. Do NOT derive this list from
// ToroEnums.LanguageCode (site/src/app/common/enumerations/toro.enums.ts:69) — that enum
// declares eighteen, but seven of them (Swedish, Vietnamese, Russian, Bulgarian, Danish,
// Norwegian, Czech) are commented out in app-initializer and have no catalogue behind them.
// Reading the enum would offer readers a language the product itself cannot display.
//
// `code` is the wire value and matches IntelliDash exactly, including its mistakes.
// `htmlLang` is the corrected BCP-47 tag for <html lang> and Intl. These differ for Korean:
// IntelliDash uses 'ko-ko', but KO is not an ISO-3166 country code — Korean is ko-KR. Passing
// 'ko-ko' to Intl or a screen reader gets you wrong pronunciation and wrong collation, so the
// platform stores the IntelliDash value and emits the correct one.
(function () {
  'use strict';

  var STORAGE_KEY = 'sa-guides-locale';
  var URL_PARAM = 'lang';
  var DEFAULT = 'en-us';

  var LOCALES = [
    { code: 'en-us', htmlLang: 'en-US', nativeName: 'English',    flag: '🇺🇸' },
    { code: 'de-de', htmlLang: 'de-DE', nativeName: 'Deutsch',    flag: '🇩🇪' },
    { code: 'es-es', htmlLang: 'es-ES', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr-fr', htmlLang: 'fr-FR', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'it-it', htmlLang: 'it-IT', nativeName: 'Italiano',   flag: '🇮🇹' },
    { code: 'nl-nl', htmlLang: 'nl-NL', nativeName: 'Nederlands', flag: '🇳🇱' },
    { code: 'pt-pt', htmlLang: 'pt-PT', nativeName: 'Português', flag: '🇵🇹' },
    { code: 'ja-jp', htmlLang: 'ja-JP', nativeName: '日本語', flag: '🇯🇵' },
    // IntelliDash's 'ko-ko' is not valid BCP-47; ko-KR is. See the header note.
    { code: 'ko-ko', htmlLang: 'ko-KR', nativeName: '한국어', flag: '🇰🇷' },
    { code: 'th-th', htmlLang: 'th-TH', nativeName: 'ไทย', flag: '🇹🇭' },
    { code: 'zh-cn', htmlLang: 'zh-CN', nativeName: '简体中文', flag: '🇨🇳' },
  ];

  var byCode = {};
  LOCALES.forEach(function (l) { byCode[l.code] = l; });

  function isSupported(code) {
    return !!(code && byCode[String(code).toLowerCase()]);
  }

  // ---- BCP-47 matching --------------------------------------------------------
  // Two passes, in order of specificity. The second pass is what makes this correct:
  // a naive lowercase compare against the code list drops de-AT, pt-BR, zh-TW and en-GB
  // readers to English even though a perfectly good catalogue exists for their language.
  //
  //   'de-DE'   -> de-de   (exact)
  //   'de-AT'   -> de-de   (primary subtag)
  //   'de'      -> de-de   (primary subtag)
  //   'pt-BR'   -> pt-pt   (primary subtag; we ship European Portuguese only)
  //   'zh-Hans' -> zh-cn   (primary subtag; we ship Simplified only)
  //   'zh-TW'   -> zh-cn   (primary subtag — imperfect, but far better than English)
  //   'ko-KR'   -> ko-ko   (primary subtag; our code carries IntelliDash's spelling)
  function matchTag(tag) {
    if (!tag) return null;
    var norm = String(tag).toLowerCase().replace(/_/g, '-');
    if (byCode[norm]) return byCode[norm];

    var primary = norm.split('-')[0];
    for (var i = 0; i < LOCALES.length; i++) {
      if (LOCALES[i].code.split('-')[0] === primary) return LOCALES[i];
    }
    return null;
  }

  function negotiate() {
    var tags = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : (navigator.language ? [navigator.language] : []);
    // navigator.languages is ordered by the reader's own preference, so the first hit
    // wins and the walk stops there. Collecting candidates and picking later would
    // silently override that ordering.
    for (var i = 0; i < tags.length; i++) {
      var hit = matchTag(tags[i]);
      if (hit) return hit.code;
    }
    return null;
  }

  function urlLocale() {
    try {
      var v = new URLSearchParams(location.search).get(URL_PARAM);
      var hit = matchTag(v);
      return hit ? hit.code : null;
    } catch (e) { return null; }
  }

  function storedLocale() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return isSupported(v) ? String(v).toLowerCase() : null;
    } catch (e) { return null; }
  }

  // ---- resolution -------------------------------------------------------------
  // Precedence, highest first. Defaulting every first-time reader to English until they
  // discover the selector is the behaviour this exists to avoid.
  //
  //   1. ?lang=       a shared guide link carries its language. The platform deep-links to
  //                   individual guides, so without this, sending a colleague a specific
  //                   translated guide silently reverts to whatever their browser prefers.
  //   2. stored       an explicit choice is durable and always beats detection.
  //   3. navigator    the reader's own browser preference order.
  //   4. en-us
  //
  // Deliberately NOT used: IP geolocation and timezone. Location is not language — a German
  // speaker in Arizona should get German, and a tourist in Bangkok should not get Thai.
  var resolvedFrom = 'default';

  function resolveInitial() {
    var fromUrl = urlLocale();
    if (fromUrl) { resolvedFrom = 'url'; return fromUrl; }

    var fromStore = storedLocale();
    if (fromStore) { resolvedFrom = 'stored'; return fromStore; }

    var fromNav = negotiate();
    if (fromNav) { resolvedFrom = 'navigator'; return fromNav; }

    resolvedFrom = 'default';
    return DEFAULT;
  }

  var current = resolveInitial();
  var listeners = [];

  function applyDocumentLang(code) {
    var l = byCode[code] || byCode[DEFAULT];
    // Emit the corrected tag, never the raw code — see the ko-ko note in the header.
    document.documentElement.setAttribute('lang', l.htmlLang);
  }

  // Runs at top level, not on DOMContentLoaded, so the document language is correct as
  // early as this file executes rather than arriving as a visible change afterwards.
  applyDocumentLang(current);

  function set(code, opts) {
    var hit = matchTag(code);
    if (!hit) return false;                 // unknown input never clears a good value
    var next = hit.code;
    if (next === current) return true;

    current = next;
    resolvedFrom = 'selected';
    applyDocumentLang(next);

    // A ?lang= link governs its page view only. Persisting it would mean following one
    // shared link permanently rewrote the recipient's preference, which is not what either
    // party intended. Only an explicit choice — the selector — writes to storage.
    if (!opts || opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* private mode */ }
    }

    listeners.forEach(function (fn) {
      try { fn(next); } catch (e) { /* one bad listener must not block the rest */ }
    });
    return true;
  }

  window.__saLocale = {
    get: function () { return current; },
    set: set,
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    },
    locales: LOCALES.slice(),
    meta: function (code) { return byCode[code || current] || byCode[DEFAULT]; },
    isSupported: isSupported,
    match: function (tag) { var h = matchTag(tag); return h ? h.code : null; },
    resolvedFrom: function () { return resolvedFrom; },
  };

  // How readers arrive at their language: 'url', 'stored', 'navigator' or 'default'.
  // Without this there is no way to tell whether detection is doing anything, or whether
  // per-locale demand is real or an artefact of everyone being defaulted to English.
  if (window.__saTrack) {
    window.__saTrack('locale_resolved', { locale: current, via: resolvedFrom });
  }
})();
