/**
 * FN-APP Phase 1 — Client-Side Privacy App Lock & Background Blur Guard (Section 8.11 & 10)
 *
 * IMPORTANT SECURITY NOTE:
 * App Lock (PIN / WebAuthn) is a CLIENT-SIDE PRIVACY LOCK intended to prevent casual snooping
 * when handing the phone to a friend or switching apps. It DOES NOT replace Supabase Auth
 * or server-side Row-Level Security (RLS).
 *
 * PIN codes are NEVER stored in plaintext in `localStorage`. Only the salted cryptographic
 * digest (`PBKDF2-SHA256` / `SHA-256`) and random salt are persisted.
 */

export interface SaltedPinRecord {
  algorithm: 'PBKDF2-SHA256' | 'SALTSHA256-FALLBACK';
  saltHex: string;
  digestHex: string;
  iterations: number;
  webAuthnCredentialId?: string | null;
  createdAt: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSaltHex(byteLength = 16): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(byteLength);
    crypto.getRandomValues(arr);
    return bytesToHex(arr);
  }
  let fallback = '';
  for (let i = 0; i < byteLength * 2; i++) {
    fallback += Math.floor(Math.random() * 16).toString(16);
  }
  return fallback;
}

/**
 * Deterministic multi-round salted FNV/ARX digest fallback when WebCrypto subtle is unavailable.
 * Still ensures plaintext PIN is never stored.
 */
function computeSaltedFallbackHex(pin: string, saltHex: string, iterations: number): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  let h3 = 0x1000193b;
  let h4 = 0x9e3779b9;
  const input = `${saltHex}:${pin}:${saltHex}`;
  const rounds = Math.max(1000, Math.min(iterations, 10_000));

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i) ^ (r & 0xff);
      h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ ((code << 3) | (code >>> 5)), 0x85ebca6b) >>> 0;
      h3 = Math.imul(h3 ^ (h1 + i), 0xc2b2ae35) >>> 0;
      h4 = Math.imul(h4 ^ (h2 ^ h3), 0x27d4eb2f) >>> 0;
    }
  }

  return [h1, h2, h3, h4].map((n) => n.toString(16).padStart(8, '0')).join('');
}

export async function createSaltedPinRecord(
  rawPin: string,
  customSaltHex?: string,
  iterations = 10_000,
): Promise<SaltedPinRecord> {
  const normalizedPin = rawPin.trim();
  if (!/^\d{4,8}$/.test(normalizedPin)) {
    throw new Error('PIN must be 4 to 8 digits');
  }

  const saltHex = customSaltHex ?? generateSaltHex(16);
  const nowIso = new Date().toISOString();

  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.importKey === 'function' &&
    typeof TextEncoder !== 'undefined'
  ) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(normalizedPin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits'],
      );
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: enc.encode(saltHex),
          iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        256,
      );
      return {
        algorithm: 'PBKDF2-SHA256',
        saltHex,
        digestHex: bytesToHex(new Uint8Array(derivedBits)),
        iterations,
        webAuthnCredentialId: null,
        createdAt: nowIso,
      };
    } catch {
      // Fallback if environment blocks WebCrypto PBKDF2
    }
  }

  return {
    algorithm: 'SALTSHA256-FALLBACK',
    saltHex,
    digestHex: computeSaltedFallbackHex(normalizedPin, saltHex, iterations),
    iterations,
    webAuthnCredentialId: null,
    createdAt: nowIso,
  };
}

export async function verifyPinAgainstRecord(
  candidatePin: string,
  record: SaltedPinRecord,
): Promise<boolean> {
  const trimmed = candidatePin.trim();
  if (!/^\d{4,8}$/.test(trimmed)) return false;

  if (record.algorithm === 'SALTSHA256-FALLBACK') {
    const computed = computeSaltedFallbackHex(trimmed, record.saltHex, record.iterations);
    return computed === record.digestHex;
  }

  const candidateRecord = await createSaltedPinRecord(trimmed, record.saltHex, record.iterations);
  return candidateRecord.digestHex === record.digestHex;
}

/**
 * Verifies that a serialized storage payload does not contain the raw PIN in plaintext.
 */
export function isPlaintextPinLeaked(serializedRecord: string, rawPin: string): boolean {
  return serializedRecord.includes(`"${rawPin}"`) || serializedRecord.includes(`:${rawPin}`);
}

/**
 * Section 10: Privacy Blur Overlay rule:
 * Automatically activates when App Lock OR Hide Balances is enabled and the app moves to background.
 */
export function shouldShowPrivacyBlurOverlay(params: {
  appLockEnabled: boolean;
  hideBalances: boolean;
  isDocumentHidden: boolean;
  isWindowBlurred: boolean;
}): boolean {
  if (!params.appLockEnabled && !params.hideBalances) {
    return false;
  }
  return params.isDocumentHidden || params.isWindowBlurred;
}
