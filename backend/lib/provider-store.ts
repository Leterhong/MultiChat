const crypto = require('crypto');
const fs = require('fs');
import type { JsonRecord, JsonStore } from '../types';

const PROVIDER_FILE = 'providers.json';
const KEY_FILE = '.provider-secrets.key';
const PREFIX = 'enc:v1:';

function protectFile(file: string) {
  try { fs.chmodSync(file, 0o600); } catch {}
}

function keyFor(store: JsonStore): Buffer {
  const file = store.resolve(KEY_FILE);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32), { mode: 0o600 });
  }
  const key = fs.readFileSync(file);
  if (key.length !== 32) throw new Error('provider secret key is invalid');
  protectFile(file);
  return key;
}

function encrypt(store: JsonStore, value: string): string {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(store), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, encrypted].map(part => part.toString('base64url')).join(':');
}

function decrypt(store: JsonStore, value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value || '';
  const [ivText, tagText, payloadText] = value.slice(PREFIX.length).split(':');
  if (!ivText || !tagText || !payloadText) throw new Error('provider secret payload is invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(store), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payloadText, 'base64url')), decipher.final()]).toString('utf8');
}

function createProviderStore(store: JsonStore) {
  function stored(): JsonRecord[] {
    const rows = store.read<JsonRecord[]>(PROVIDER_FILE, []);
    let migrated = false;
    const protectedRows = rows.map(row => {
      if (row.apiKey && !String(row.apiKey).startsWith(PREFIX)) {
        migrated = true;
        return { ...row, apiKey: encrypt(store, String(row.apiKey)) };
      }
      return row;
    });
    if (migrated) {
      store.write(PROVIDER_FILE, protectedRows);
      // The generic store created its recovery copy from the legacy plaintext
      // file. Replace that copy immediately so no API key remains in a .bak.
      const legacyFile = store.resolve(PROVIDER_FILE);
      if (store.kind === 'json' || fs.existsSync(legacyFile)) {
        fs.writeFileSync(legacyFile, JSON.stringify(protectedRows, null, 2), { mode: 0o600 });
        fs.writeFileSync(`${legacyFile}.bak`, JSON.stringify(protectedRows, null, 2), { mode: 0o600 });
        protectFile(legacyFile);
        protectFile(`${legacyFile}.bak`);
      }
    }
    return protectedRows;
  }

  function list(): JsonRecord[] {
    return stored().map(row => {
      const apiKey = row.apiKey ? decrypt(store, String(row.apiKey)) : '';
      return { ...row, apiKey };
    });
  }

  function save(rows: JsonRecord[]) {
    const protectedRows = rows.map(row => ({
      ...row,
      apiKey: row.apiKey ? encrypt(store, String(row.apiKey)) : '',
    }));
    store.write(PROVIDER_FILE, protectedRows);
    if (store.kind === 'json') protectFile(store.resolve(PROVIDER_FILE));
    const backup = `${store.resolve(PROVIDER_FILE)}.bak`;
    if (fs.existsSync(backup)) protectFile(backup);
  }

  function publicRecord(row: JsonRecord) {
    if (!row) return row;
    const { apiKey, ...rest } = row;
    const capabilities = providerCapabilities(row);
    if (!apiKey) return { ...rest, capabilities };
    const preview = String(apiKey).length > 4 ? String(apiKey).slice(-4) : String(apiKey);
    return { ...rest, capabilities, apiKeyMasked: true, apiKeyPreview: preview };
  }

  function publicList() { return list().map(publicRecord); }

  return { list, save, publicRecord, publicList };
}

function providerCapabilities(provider: JsonRecord) {
  const type = String(provider.apiType || 'openai').toLowerCase();
  const models = Array.isArray(provider.models) ? provider.models.map(String) : [];
  const modelText = models.join(' ').toLowerCase();
  const local = ['ollama', 'lmstudio'].includes(type);
  return {
    streaming: true,
    tools: !['wenxin'].includes(type),
    vision: /vision|vl|gpt-4o|gemini|claude-3/.test(modelText),
    reasoning: /reason|r1|thinking|qwq/.test(modelText),
    usage: 'provider-or-estimated',
    local,
    privateNetwork: Boolean(provider.allowPrivate) || local,
  };
}

module.exports = { PROVIDER_FILE, createProviderStore, providerCapabilities };
