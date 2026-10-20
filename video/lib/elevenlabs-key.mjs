// Resolves the ElevenLabs API key at run time from the elevenlabs MCP entry in ~/.claude.json.
//
// THE KEY IS SECRET. This repository is public, so a leaked key is a revocation event. Callers
// must never print, log, write, commit or pass the key on a command line (ps shows argv to
// every user on the machine). Hand it to an HTTP client in process, or compare it in process,
// and nothing else. Nothing in this module prints it, and its error messages name the file only.
//
// Lookup order, first hit wins:
//   1. SA_HYGIENE_TEST_KEY, when set (tests only: lets the hygiene tests plant a fake key
//      without touching ~/.claude.json).
//   2. mcpServers.elevenlabs.env.ELEVENLABS_API_KEY at the top level of ~/.claude.json
//      (a user-scoped MCP entry).
//   3. projects[<any path>].mcpServers.elevenlabs.env.ELEVENLABS_API_KEY, in file order
//      (a project-scoped entry). Every project is searched, so the resolver keeps working if
//      the entry moves between projects.
// Returns null when no key is configured.

import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_CLAUDE_JSON = path.join(os.homedir(), '.claude.json');
export const TEST_KEY_ENV = 'SA_HYGIENE_TEST_KEY';

export class ElevenLabsKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ElevenLabsKeyError';
  }
}

const keyIn = (scope) => {
  const value = scope?.mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

function loadConfig(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new ElevenLabsKeyError(`cannot read ${file} (${err.code ?? 'error'})`);
  }
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    // The JSON.parse message quotes part of the input, which could include the key. Drop it.
    throw new ElevenLabsKeyError(`${file} is not valid JSON`);
  }
  return config !== null && typeof config === 'object' ? config : null;
}

// Every distinct configured key, in lookup order (top level first, then projects in file
// order). The hygiene check scans for all of them, so a key left behind in another project
// scope is caught too. Same options as readElevenLabsKey.
export function readElevenLabsKeys({ file = DEFAULT_CLAUDE_JSON, env = process.env } = {}) {
  const override = env[TEST_KEY_ENV];
  if (typeof override === 'string' && override !== '') return [override];
  const config = loadConfig(file);
  if (!config) return [];
  const scopes = [config];
  if (config.projects && typeof config.projects === 'object') scopes.push(...Object.values(config.projects));
  const keys = [];
  for (const scope of scopes) {
    const key = keyIn(scope);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

// The key to use. file: path to the Claude config (default ~/.claude.json); env: environment
// to read the test override from (default process.env).
export function readElevenLabsKey(options = {}) {
  return readElevenLabsKeys(options)[0] ?? null;
}
