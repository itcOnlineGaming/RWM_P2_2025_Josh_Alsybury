// src/lib/tokensStore.ts
import fs from 'fs';
const TOKEN_PATH = '.tokens.json';

export function saveTokens(tokens: unknown) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

export function loadTokens(): any | null {
  try {
    const raw = fs.readFileSync(TOKEN_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
