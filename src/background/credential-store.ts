import type { GitHubTokenSource } from '../shared/types'
import { base64ToBytes, bytesToBase64, toPlainArrayBuffer } from '../shared/encoding'

// ── Storage keys ────────────────────────────────────────────

/** @deprecated Legacy key — only read during migration */
const LEGACY_TOKEN_KEY = 'github_token_enc'
/** @deprecated Legacy key — only read during migration */
const LEGACY_TOKEN_SOURCE_KEY = 'github_token_source'
/** @deprecated Legacy key — only read during migration */
const LEGACY_AI_KEY_KEY = 'ai_api_key_enc'

const GITHUB_OAUTH_CLIENT_ID_KEY = 'github_oauth_client_id'
const CREDENTIAL_KEY_MATERIAL_KEY = 'credential_key_material_v2'
const SECURE_CREDENTIAL_STORE_KEY = 'secure_credentials_v3'

const DEFAULT_GITHUB_OAUTH_CLIENT_ID = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID ?? ''

// ── Types ───────────────────────────────────────────────────

export type SecureCredentialSlot = 'githubToken' | 'aiKey'
type LegacySecretScheme = 'install-key-v1' | 'runtime-id-v1'

interface StoredSecretEnvelopeV2 {
  version: 2
  kind: SecureCredentialSlot
  iv: string
  ciphertext: string
  updatedAt: number
  source?: GitHubTokenSource
  migratedFrom?: LegacySecretScheme
}

interface SecureCredentialStore {
  version: 1
  githubToken?: StoredSecretEnvelopeV2
  aiKey?: StoredSecretEnvelopeV2
}

const SECRET_SCOPE_SUFFIX: Record<SecureCredentialSlot, string> = {
  githubToken: 'github-token',
  aiKey: 'ai-key',
}

const AES_GCM_IV_LENGTH = 12 // bytes (96 bits)

// ── Helpers ─────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function emptyCredentialStore(): SecureCredentialStore {
  return { version: 1 }
}

// ── Envelope validation ─────────────────────────────────────

function isStoredSecretEnvelope(
  value: unknown,
  kind: SecureCredentialSlot,
): value is StoredSecretEnvelopeV2 {
  if (!isRecord(value)) return false
  return (
    value.version === 2 &&
    value.kind === kind &&
    typeof value.iv === 'string' &&
    typeof value.ciphertext === 'string' &&
    typeof value.updatedAt === 'number'
  )
}

// ── Credential store read/write ─────────────────────────────

async function readCredentialStore(): Promise<SecureCredentialStore> {
  const data = await chrome.storage.local.get(SECURE_CREDENTIAL_STORE_KEY)
  const raw = data[SECURE_CREDENTIAL_STORE_KEY]
  if (!isRecord(raw) || raw.version !== 1) return emptyCredentialStore()

  return {
    version: 1,
    githubToken: isStoredSecretEnvelope(raw.githubToken, 'githubToken') ? raw.githubToken : undefined,
    aiKey: isStoredSecretEnvelope(raw.aiKey, 'aiKey') ? raw.aiKey : undefined,
  }
}

async function writeCredentialStore(store: SecureCredentialStore): Promise<void> {
  await chrome.storage.local.set({
    [SECURE_CREDENTIAL_STORE_KEY]: store,
  })
}

// ── Key derivation ──────────────────────────────────────────

let credentialKeyMaterialPromise: Promise<string> | null = null

async function deriveKeyFromText(rawText: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(rawText)
  const base = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('treepad-salt'), iterations: 100000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function getCredentialKeyMaterial(): Promise<string> {
  if (!credentialKeyMaterialPromise) {
    credentialKeyMaterialPromise = (async () => {
      const data = await chrome.storage.local.get(CREDENTIAL_KEY_MATERIAL_KEY)
      const existing = data[CREDENTIAL_KEY_MATERIAL_KEY]
      if (typeof existing === 'string' && existing.trim()) return existing.trim()

      const bytes = crypto.getRandomValues(new Uint8Array(32))
      const generated = bytesToBase64(bytes)
      await chrome.storage.local.set({ [CREDENTIAL_KEY_MATERIAL_KEY]: generated })
      return generated
    })()
  }

  return credentialKeyMaterialPromise
}

async function getDerivedKey(kind: SecureCredentialSlot): Promise<CryptoKey> {
  const keyMaterial = await getCredentialKeyMaterial()
  return deriveKeyFromText(`${keyMaterial}:${SECRET_SCOPE_SUFFIX[kind]}:v2`)
}

async function getLegacyInstallDerivedKey(): Promise<CryptoKey> {
  return deriveKeyFromText(await getCredentialKeyMaterial())
}

async function getLegacyRuntimeDerivedKey(): Promise<CryptoKey> {
  return deriveKeyFromText(chrome.runtime.id)
}

// ── Encrypt / Decrypt ───────────────────────────────────────

async function encryptSecret(
  kind: SecureCredentialSlot,
  secret: string,
  options: {
    source?: GitHubTokenSource
    migratedFrom?: LegacySecretScheme
  } = {},
): Promise<StoredSecretEnvelopeV2> {
  const key = await getDerivedKey(kind)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret))
  return {
    version: 2,
    kind,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(enc)),
    updatedAt: Date.now(),
    ...(options.source ? { source: options.source } : {}),
    ...(options.migratedFrom ? { migratedFrom: options.migratedFrom } : {}),
  }
}

async function decryptSecretEnvelope(envelope: StoredSecretEnvelopeV2): Promise<string> {
  const key = await getDerivedKey(envelope.kind)
  const iv = toPlainArrayBuffer(base64ToBytes(envelope.iv))
  const data = toPlainArrayBuffer(base64ToBytes(envelope.ciphertext))
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(dec)
}

async function decryptLegacySecretWithKey(stored: string, key: CryptoKey): Promise<string> {
  const buf = base64ToBytes(stored)
  const iv = toPlainArrayBuffer(buf.slice(0, AES_GCM_IV_LENGTH))
  const data = toPlainArrayBuffer(buf.slice(AES_GCM_IV_LENGTH))
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(dec)
}

async function decryptLegacySecret(
  stored: string,
): Promise<{ value: string; scheme: LegacySecretScheme }> {
  try {
    return {
      value: await decryptLegacySecretWithKey(stored, await getLegacyInstallDerivedKey()),
      scheme: 'install-key-v1',
    }
  } catch {
    // Fall back to runtime-derived key; error propagates if this also fails
    return {
      value: await decryptLegacySecretWithKey(stored, await getLegacyRuntimeDerivedKey()),
      scheme: 'runtime-id-v1',
    }
  }
}

// ── Credential CRUD (public API) ────────────────────────────

async function writeCredential(
  kind: SecureCredentialSlot,
  value: string,
  options: {
    source?: GitHubTokenSource
    migratedFrom?: LegacySecretScheme
  } = {},
): Promise<void> {
  const trimmed = value.trim()
  const store = await readCredentialStore()

  if (!trimmed) {
    delete store[kind]
  } else {
    store[kind] = await encryptSecret(kind, trimmed, options)
  }

  await writeCredentialStore(store)
}

/**
 * Read a credential from the v2 store.
 * Does NOT attempt legacy fallback — use `runPostInstallMigration()` to migrate first.
 */
async function readStoredSecret(kind: SecureCredentialSlot): Promise<string | undefined> {
  const store = await readCredentialStore()
  const current = store[kind]
  if (!current) return undefined

  try {
    return await decryptSecretEnvelope(current)
  } catch {
    console.warn(`[TreePad] Failed to decrypt ${kind} — credential may be corrupted`)
    return undefined
  }
}

// ── GitHub token ────────────────────────────────────────────

export async function readStoredGitHubCredential(): Promise<{
  token: string | undefined
  source: GitHubTokenSource | undefined
}> {
  const store = await readCredentialStore()
  const current = store.githubToken

  if (!current) {
    return { token: undefined, source: undefined }
  }

  try {
    return {
      token: await decryptSecretEnvelope(current),
      source: current.source,
    }
  } catch {
    console.warn('[TreePad] Failed to decrypt GitHub token')
    return { token: undefined, source: undefined }
  }
}

export async function setStoredToken(
  token: string,
  source: GitHubTokenSource = 'manual',
): Promise<void> {
  if (!token.trim()) {
    await writeCredential('githubToken', '')
    return
  }
  await writeCredential('githubToken', token, { source })
}

// ── AI key ──────────────────────────────────────────────────

export async function getStoredAiKey(): Promise<string | undefined> {
  return readStoredSecret('aiKey')
}

export async function setStoredAiKey(key: string): Promise<void> {
  if (!key.trim()) {
    await writeCredential('aiKey', '')
    return
  }
  await writeCredential('aiKey', key)
}

// ── GitHub OAuth Client ID ──────────────────────────────────

export async function getStoredGitHubOAuthClientId(): Promise<string> {
  const data = await chrome.storage.local.get(GITHUB_OAUTH_CLIENT_ID_KEY)
  const stored = data[GITHUB_OAUTH_CLIENT_ID_KEY]
  if (typeof stored === 'string' && stored.trim()) return stored.trim()
  return DEFAULT_GITHUB_OAUTH_CLIENT_ID.trim()
}

export async function setStoredGitHubOAuthClientId(clientId: string): Promise<void> {
  const trimmed = clientId.trim()
  if (!trimmed) {
    await chrome.storage.local.remove(GITHUB_OAUTH_CLIENT_ID_KEY)
    return
  }
  await chrome.storage.local.set({ [GITHUB_OAUTH_CLIENT_ID_KEY]: trimmed })
}

// ── Legacy migration (run once on install/update) ───────────

async function readLegacyStoredSecret(storageKey: string): Promise<{
  value: string
  scheme: LegacySecretScheme
} | null> {
  const data = await chrome.storage.local.get(storageKey)
  const raw = data[storageKey]
  if (typeof raw !== 'string' || !raw.trim()) return null

  try {
    return await decryptLegacySecret(raw)
  } catch {
    return null
  }
}

async function getLegacyStoredTokenSource(): Promise<GitHubTokenSource | undefined> {
  const data = await chrome.storage.local.get(LEGACY_TOKEN_SOURCE_KEY)
  const source = data[LEGACY_TOKEN_SOURCE_KEY]
  if (source === 'manual' || source === 'oauth-device') return source
  return undefined
}

/**
 * Run once on install/update to eagerly migrate legacy credentials
 * into the v2 envelope format, then remove the old keys.
 */
export async function runPostInstallMigration(): Promise<void> {
  const store = await readCredentialStore()
  let changed = false

  // Migrate legacy GitHub token if v2 store doesn't have one
  if (!store.githubToken) {
    const legacy = await readLegacyStoredSecret(LEGACY_TOKEN_KEY)
    if (legacy) {
      const source = await getLegacyStoredTokenSource()
      store.githubToken = await encryptSecret('githubToken', legacy.value, {
        source: source ?? 'manual',
        migratedFrom: legacy.scheme,
      })
      changed = true
      console.info('[TreePad] Migrated legacy GitHub token to v2 store')
    }
  }

  // Migrate legacy AI key if v2 store doesn't have one
  if (!store.aiKey) {
    const legacy = await readLegacyStoredSecret(LEGACY_AI_KEY_KEY)
    if (legacy) {
      store.aiKey = await encryptSecret('aiKey', legacy.value, {
        migratedFrom: legacy.scheme,
      })
      changed = true
      console.info('[TreePad] Migrated legacy AI key to v2 store')
    }
  }

  if (changed) {
    await writeCredentialStore(store)
  }

  // Remove legacy keys regardless (they are either migrated or already gone)
  await chrome.storage.local.remove([LEGACY_TOKEN_KEY, LEGACY_TOKEN_SOURCE_KEY, LEGACY_AI_KEY_KEY])
}

/**
 * Verify all stored credentials are still readable.
 * Logs warnings for any that fail decryption.
 */
export async function verifyCredentialHealth(): Promise<void> {
  const store = await readCredentialStore()
  const slots: SecureCredentialSlot[] = ['githubToken', 'aiKey']

  for (const kind of slots) {
    const envelope = store[kind]
    if (!envelope) continue

    try {
      await decryptSecretEnvelope(envelope)
      console.info(`[TreePad] ✓ ${kind} is readable`)
    } catch {
      console.warn(`[TreePad] ✗ ${kind} is stored but cannot be decrypted — it may need to be re-entered`)
    }
  }
}
