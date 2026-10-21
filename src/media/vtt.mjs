// Plain-text WebVTT: parse a caption file into cues and write cues back out.
//
// Why so narrow. A caption track here is a list of spoken sentences that go through the translation
// catalogue (see src/media/captions.mjs), keyed on their exact English text. Anything a translator
// could break, or that would make the key unstable, is refused at parse time rather than carried:
//
//   - STYLE and REGION blocks are rejected. Styling belongs to the player's CSS, and a region names
//     screen geometry that every locale shares anyway.
//   - Cue text containing "<" is rejected. That is WebVTT markup (<i>, <b>, <v Speaker>, <00:01.000>),
//     and markup does not survive translation: the model reorders words around tags, or drops them.
//     The error names the cue by its start time so the author can find it.
//   - A multi-line cue is joined into one line with a single space. The catalogue key has to be a
//     stable sentence, and browsers wrap caption lines to the video width themselves.
//
// NOTE blocks are comments and are skipped. Cue ids and cue settings (line:, position:, align: ...)
// are kept as they are and written back unchanged, so every locale's track has the same timing and
// the same placement as the English one.
//
// Timestamps are normalized to HH:MM:SS.mmm. WebVTT also allows MM:SS.mmm and more than two hour
// digits; both parse, and the value is unchanged.
//
// Pure ESM with no DOM and no build imports, so build.mjs, scripts/ and node:test can all use it.

const TIMESTAMP = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/;
const TIMING = /^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t]+(.*))?$/;

/** Milliseconds from a WebVTT timestamp ("01:02:03.456" or "02:03.456"). Throws on anything else. */
export function parseTimestamp(text) {
  const m = TIMESTAMP.exec(String(text).trim());
  if (!m) throw new Error(`"${text}" is not a WebVTT timestamp (HH:MM:SS.mmm or MM:SS.mmm)`);
  const [, h = '0', min, s, ms] = m;
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000 + Number(ms);
}

/** HH:MM:SS.mmm from milliseconds. Hours keep at least two digits and grow past 99 if they must. */
export function formatTimestamp(ms) {
  if (!Number.isInteger(ms) || ms < 0) throw new Error(`timestamp must be a whole, non-negative number of milliseconds; received ${ms}`);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const h = Math.floor(ms / 3_600_000);
  const min = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${pad(h)}:${pad(min)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** A timestamp in canonical HH:MM:SS.mmm form. */
export const normalizeTimestamp = (text) => formatTimestamp(parseTimestamp(text));

// The character references WebVTT defines for cue text, plus numeric ones. Decoded on parse so the
// catalogue holds the sentence a reader sees ("Fairways & greens"), not its encoding.
const NAMED = { amp: '&', lt: '<', gt: '>', nbsp: ' ', lrm: '‎', rlm: '‏' };
const decode = (text) => text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-z]+));/g, (all, dec, hex, name) => {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  return name in NAMED ? NAMED[name] : all;
});
// "<" would open a tag and "-->" would end the cue, so both are escaped on the way out. A translation
// may legitimately contain either; "&" is escaped so a literal "&lt;" in a translation stays literal.
const encode = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isBlank = (line) => line.trim() === '';
const startsBlock = (line, word) => line === word || line.startsWith(`${word} `) || line.startsWith(`${word}\t`);

/**
 * Parse WebVTT text into { cues: [{ id, start, end, settings, text }] }. `id` and `settings` are ''
 * when absent; `start` and `end` are HH:MM:SS.mmm; `text` is the cue's lines joined with one space.
 * Throws on a missing WEBVTT header, a STYLE or REGION block, a cue without a valid timing line, a
 * cue that ends before it starts, an empty cue, or cue text containing markup.
 */
export function parseVtt(text) {
  const lines = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  if (!/^WEBVTT(?:[ \t].*)?$/.test(lines[0])) throw new Error('not a WebVTT file: the first line must be "WEBVTT"');

  // Blocks are runs of non-blank lines. The first is the header (WEBVTT plus any header lines).
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (isBlank(line)) { current = null; continue; }
    if (!current) blocks.push(current = []);
    current.push(line);
  }

  const cues = [];
  for (const block of blocks.slice(1)) {
    const first = block[0].trim();
    if (startsBlock(first, 'NOTE')) continue;
    if (startsBlock(first, 'STYLE') || startsBlock(first, 'REGION')) {
      throw new Error(`${first.split(/[ \t]/)[0]} blocks are not supported: style captions in the player, not in the track`);
    }
    const hasId = !block[0].includes('-->');
    const id = hasId ? block[0].trim() : '';
    const timingLine = hasId ? block[1] : block[0];
    const timing = timingLine === undefined ? null : TIMING.exec(timingLine.trim());
    if (!timing) throw new Error(`cue${id ? ` "${id}"` : ''} has no "start --> end" timing line`);
    let start, end;
    try {
      start = normalizeTimestamp(timing[1]);
      end = normalizeTimestamp(timing[2]);
    } catch (err) {
      throw new Error(`cue${id ? ` "${id}"` : ''} at ${timing[1]}: ${err.message}`);
    }
    if (parseTimestamp(end) <= parseTimestamp(start)) throw new Error(`cue at ${start}: ends at ${end}, which is not after its start`);

    const raw = block.slice(hasId ? 2 : 1).map((l) => l.trim()).join(' ').trim();
    if (raw.includes('<')) {
      throw new Error(`cue at ${start}: markup ("<") is not supported in caption text, because it does not survive translation; use plain text`);
    }
    const cueText = decode(raw).replace(/[ \t]+/g, ' ').trim();
    if (!cueText) throw new Error(`cue at ${start}: has no text`);
    cues.push({ id, start, end, settings: (timing[3] || '').trim(), text: cueText });
  }
  return { cues };
}

/**
 * WebVTT text for a list of cues: the WEBVTT line, a blank line, then one block per cue (optional id
 * line, "start --> end settings", the text on one line) followed by a blank line.
 */
export function serializeVtt(cues) {
  let out = 'WEBVTT\n\n';
  for (const cue of cues) {
    const timing = `${normalizeTimestamp(cue.start)} --> ${normalizeTimestamp(cue.end)}${cue.settings ? ` ${cue.settings}` : ''}`;
    const text = encode(String(cue.text).replace(/\s*\n\s*/g, ' ').trim());
    if (!text) throw new Error(`cue at ${cue.start}: has no text`);
    out += `${cue.id ? `${cue.id}\n` : ''}${timing}\n${text}\n\n`;
  }
  return out;
}
