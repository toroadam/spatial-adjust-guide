// Regenerates a locale catalogue by translating src/i18n/en-us.json with the Claude API.
//
// This exists because the alternative is worse. Every Core Design re-export changes the string
// keys, and the catalogues have to be rebuilt against the new set — so a translation process that
// can only be run by hand is a process that quietly rots the first time someone re-exports.
// `npm run translate -- --locale fr-fr` makes it a command, and the output is a normal diff.
//
// It writes fragments, not the final file. scripts/assemble-locale.mjs is still what produces
// src/i18n/<locale>.json, so machine output goes through exactly the same completeness and
// unknown-key checks a human's would — see its header.
//
// Usage:
//   node scripts/translate.mjs --locale fr-fr [--chunk 40] [--concurrency 3] [--dry-run]
//
// Credentials: ANTHROPIC_API_KEY, or an `ant auth login` profile — the SDK resolves both.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
// Zod 4 is required, not merely allowed. The SDK's zodOutputFormat calls z.toJSONSchema, which
// does not exist in Zod 3, and the helper resolves 'zod' at the package root — so importing the
// 'zod/v4' subpath here does not help. The SDK's peer range (^3.25 || ^4) does not catch this.
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const locale = arg('locale');
const chunkSize = Number(arg('chunk', 40));
const concurrency = Number(arg('concurrency', 3));
const dryRun = argv.includes('--dry-run');

if (!locale) throw new Error('usage: translate.mjs --locale <code> [--chunk N] [--concurrency N] [--dry-run]');

const LANGUAGE = {
  'de-de': 'German (Germany)', 'es-es': 'Spanish (Spain)', 'fr-fr': 'French (France)',
  'it-it': 'Italian (Italy)', 'nl-nl': 'Dutch (Netherlands)', 'pt-pt': 'Portuguese (Portugal)',
  'ja-jp': 'Japanese', 'ko-ko': 'Korean', 'th-th': 'Thai', 'zh-cn': 'Simplified Chinese',
};
if (!LANGUAGE[locale]) throw new Error(`unknown locale ${locale} — add it to LANGUAGE`);

const source = JSON.parse(await readFile('src/i18n/en-us.json', 'utf8')).strings;
const glossary = JSON.parse(await readFile('src/i18n/glossary.json', 'utf8'))[locale] || {};

// Resume rather than restart. A run that dies two thirds of the way through has still done two
// thirds of the work, and re-translating what is already correct costs money and churns the diff.
const fragmentDir = join('.translate', locale);
await mkdir(fragmentDir, { recursive: true });
const done = {};
for (const f of (await readdir(fragmentDir)).filter((f) => f.endsWith('.json'))) {
  Object.assign(done, JSON.parse(await readFile(join(fragmentDir, f), 'utf8')));
}

// Written by scripts/retranslate-drift.mjs: for a targeted drift re-run, the exact screen
// labels each string must name. Absent on a normal full translation.
let requiredTerms = {};
try {
  requiredTerms = JSON.parse(await readFile(join('.translate', `${locale}.terms.json`), 'utf8'));
  console.log(`${locale}: ${Object.keys(requiredTerms).length} string(s) carry required-label constraints`);
} catch { /* not a drift re-run */ }

const todo = Object.keys(source).filter((k) => !(k in done));
console.log(`${locale}: ${Object.keys(source).length} strings, ${Object.keys(done).length} already done, ${todo.length} to translate`);
if (!todo.length) {
  console.log(`nothing to do — run: node scripts/assemble-locale.mjs ${locale} ${fragmentDir}`);
  process.exit(0);
}

const chunks = [];
for (let i = 0; i < todo.length; i += chunkSize) chunks.push(todo.slice(i, i + chunkSize));
console.log(`${chunks.length} chunk(s) of up to ${chunkSize}${dryRun ? ' — dry run, no API calls' : ''}`);

if (dryRun) {
  console.log(`first chunk sample:\n  ${chunks[0].slice(0, 3).map((s) => s.slice(0, 70)).join('\n  ')}`);
  process.exit(0);
}

// The system prompt is identical across every chunk of a locale, so it goes first with a cache
// breakpoint and the volatile per-chunk strings go in the user turn — the prefix stays byte-stable
// and every chunk after the first reads the glossary from cache instead of paying for it again.
const SYSTEM = `You are translating in-product documentation for Toro's Spatial Adjust, a golf-course
irrigation feature inside IntelliDash. Translate from English into ${LANGUAGE[locale]}.

These guides tell superintendents how to make real irrigation decisions on real turf. A mistranslated
term sends someone looking for a control that does not exist, or waters a green wrongly. Accuracy
outranks fluency.

Rules:
- Return a translation for EVERY string given, in the same order, with the source echoed back exactly.
- Preserve meaning precisely. Do not summarise, expand, localise examples, or improve the prose.
- Keep product and brand names untranslated: Toro, IntelliDash, Spatial Adjust, Lynx, TurfRad, VWC, ET.
- Keep station identifiers (3AP1, 11AP2), numbers, percentages and URLs exactly as they are, but use
  the decimal separator normal for the target language.
- Preserve typographic characters: curly apostrophes, en dashes, arrows, ellipses.
- UI labels quoted in the prose must match what the product itself displays — use the glossary.
  Where the list below gives a rendering, reproduce it verbatim, character for character. It is
  the text on the reader's own screen; prose that paraphrases it sends them hunting for a control
  they cannot find, which is the one failure these guides exist to prevent.
- Match register: these are instructions to a professional. Use the polite/formal register standard
  for software documentation in the target language, and be consistent across every string.
- A string that is genuinely identical in the target language (a URL, a product name) should be
  returned unchanged rather than forced.

Terminology from IntelliDash's own shipped translations — use these renderings for these terms:
${Object.entries(glossary).map(([en, tr]) => `  ${en} = ${tr}`).join('\n')}`;

const Schema = z.object({
  translations: z.array(z.object({
    source: z.string().describe('the English string, echoed back exactly as given'),
    translation: z.string().describe(`the ${LANGUAGE[locale]} translation`),
  })),
});

const client = new Anthropic();

async function translateChunk(strings, index) {
  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Translate all ${strings.length} strings:\n\n`
        + strings.map((s, i) => `${i + 1}. ${JSON.stringify(s)}`).join('\n')
        // Naming the constraint per string, next to the string, rather than trusting the model to
        // find the right rows in a 649-entry glossary. This is the rule the previous run lost.
        + (strings.some((s) => requiredTerms[s]?.length)
          ? `\n\nThese strings name a control on the reproduced IntelliDash screen. The listed text is
what the control is labelled in ${LANGUAGE[locale]} and MUST appear verbatim, character for
character, in your translation of that string. Where this conflicts with keeping a name
untranslated, this wins — the label is what the reader sees on their own screen.\n`
            + strings.map((s, i) => (requiredTerms[s]?.length
              ? `${i + 1}. must contain: ${requiredTerms[s].map((x) => JSON.stringify(x)).join(', ')}`
              : null)).filter(Boolean).join('\n')
          : ''),
    }],
    output_config: { format: zodOutputFormat(Schema) },
  });

  // Safety classifiers can decline with HTTP 200 — content is empty, not an exception.
  if (response.stop_reason === 'refusal') {
    throw new Error(`chunk ${index}: refused (${response.stop_details?.category ?? 'unknown'})`);
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`chunk ${index}: response did not parse against the schema`);

  // Match on the echoed source rather than on position. A model that drops or reorders one entry
  // would otherwise shift every subsequent translation onto the wrong key — silently, and in a way
  // that looks like a bad translation rather than a bug.
  const bySource = new Map(parsed.translations.map((t) => [t.source, t.translation]));
  const out = {};
  const missed = [];
  const violations = [];
  for (const s of strings) {
    const hit = bySource.get(s);
    if (hit === undefined) { missed.push(s); continue; }
    // A required label that did not survive is the exact defect this run exists to fix, so the
    // string goes back in the queue instead of into the catalogue.
    // Same case/whitespace tolerance as validate-locales.mjs — rejecting a correctly inflected
    // lowercase form would send the model back to write worse prose.
    const flat = (x) => x.toLowerCase().replace(/[\s\u00a0]+/g, ' ');
    const absent = (requiredTerms[s] || []).filter((term) => !flat(hit).includes(flat(term)));
    if (absent.length) {
      violations.push(`${s.slice(0, 55)} :: missing ${absent.map((a) => JSON.stringify(a)).join(', ')}`);
      missed.push(s);
      continue;
    }
    out[s] = hit;
  }
  return { out, missed, violations };
}

let completed = 0;
const missedAll = [];
const queue = chunks.map((c, i) => ({ c, i }));

async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    try {
      const { out, missed, violations } = await translateChunk(job.c, job.i);
      for (const v of violations) console.error(`    constraint unmet — ${v}`);
      await writeFile(join(fragmentDir, `chunk-${String(job.i).padStart(3, '0')}.json`),
        JSON.stringify(out, null, 2) + '\n');
      missedAll.push(...missed);
      completed++;
      console.log(`  chunk ${job.i + 1}/${chunks.length} — ${Object.keys(out).length} translated${missed.length ? `, ${missed.length} missed` : ''}`);
    } catch (err) {
      // Leave the fragment unwritten: the next run picks these strings up again rather than
      // baking a half-chunk into the catalogue.
      console.error(`  chunk ${job.i + 1}/${chunks.length} FAILED — ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));

console.log(`\n${completed}/${chunks.length} chunks written to ${fragmentDir}`);
if (missedAll.length) console.log(`${missedAll.length} string(s) not returned — re-run to pick them up`);
console.log(`\nnext: node scripts/assemble-locale.mjs ${locale} ${fragmentDir}`);
console.log('(assemble refuses to emit a partial catalogue, so re-run this until it is happy)');
