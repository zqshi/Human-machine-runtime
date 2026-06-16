import type { NormalizedMessage } from './message-normalizer.js';

export interface DedupResult {
  isDuplicate: boolean;
  originalMessageId?: string;
  similarity?: number;
}

interface MessageFingerprint {
  messageId: string;
  senderId: string;
  bodyHash: number;
  bodySnippet: string;
  receivedAt: number;
  channelType: string;
}

const DEDUP_WINDOW_MS = 30 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.85;
const MAX_FINGERPRINTS = 10_000;

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

function normalizeForComparison(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^一-鿿\w\s]/g, '')
    .trim()
    .toLowerCase();
}

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

export class DedupEngine {
  private fingerprints: MessageFingerprint[] = [];

  check(msg: NormalizedMessage): DedupResult {
    this.pruneExpired();

    const normalizedBody = normalizeForComparison(msg.body);
    const bodyHash = simpleHash(normalizedBody);

    const exactMatch = this.fingerprints.find(
      (fp) => fp.bodyHash === bodyHash && fp.senderId === msg.sender.id && fp.messageId !== msg.id
    );

    if (exactMatch) {
      return {
        isDuplicate: true,
        originalMessageId: exactMatch.messageId,
        similarity: 1.0,
      };
    }

    for (const fp of this.fingerprints) {
      if (fp.messageId === msg.id) continue;
      if (Math.abs(fp.receivedAt - msg.receivedAt.getTime()) > DEDUP_WINDOW_MS) continue;

      const fpNormalized = normalizeForComparison(fp.bodySnippet);
      const similarity = jaroWinkler(normalizedBody.slice(0, 200), fpNormalized.slice(0, 200));

      if (similarity >= SIMILARITY_THRESHOLD) {
        return {
          isDuplicate: true,
          originalMessageId: fp.messageId,
          similarity,
        };
      }
    }

    this.fingerprints.push({
      messageId: msg.id,
      senderId: msg.sender.id,
      bodyHash,
      bodySnippet: msg.body.slice(0, 200),
      receivedAt: msg.receivedAt.getTime(),
      channelType: msg.channelType,
    });

    if (this.fingerprints.length > MAX_FINGERPRINTS) {
      this.fingerprints = this.fingerprints.slice(-MAX_FINGERPRINTS / 2);
    }

    return { isDuplicate: false };
  }

  private pruneExpired(): void {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    this.fingerprints = this.fingerprints.filter((fp) => fp.receivedAt > cutoff);
  }

  getStats(): { fingerprintCount: number; oldestMs: number } {
    return {
      fingerprintCount: this.fingerprints.length,
      oldestMs: this.fingerprints.length > 0 ? this.fingerprints[0]!.receivedAt : 0,
    };
  }
}
