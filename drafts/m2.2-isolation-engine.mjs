import { createHmac } from 'node:crypto';

const RETENTION_DAYS = 30;
const MAX_HISTORY_ITEMS = 10;
const ID_VERSION = 'hmac-sha256-v1';

function requireSecret() {
  const secret = process.env.PASTORAL_ID_HMAC_KEY;
  if (!secret) {
    throw new Error('PASTORAL_ID_HMAC_KEY is required');
  }
  return secret;
}

export function createInternalUserId(syntheticUserReference) {
  if (typeof syntheticUserReference !== 'string' || syntheticUserReference.length === 0) {
    throw new Error('synthetic user reference is required');
  }

  return createHmac('sha256', requireSecret())
    .update(syntheticUserReference, 'utf8')
    .digest('base64url');
}

export function prepareRecord({ consent, syntheticUserReference, content, createdAt }) {
  if (consent !== true) {
    return { action: 'single_turn', record: null };
  }

  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('createdAt must be a valid ISO timestamp');
  }

  return {
    action: 'store',
    record: {
      internalUserId: createInternalUserId(syntheticUserReference),
      identityVersion: ID_VERSION,
      createdAt: timestamp.toISOString(),
      expiresAt: new Date(timestamp.getTime() + RETENTION_DAYS * 86400000).toISOString(),
      content,
    },
  };
}

export function readIsolatedHistory({ consent, currentInternalUserId, records, now }) {
  if (consent !== true) {
    return { action: 'single_turn', history: [], modelAllowed: true };
  }

  const nowMs = new Date(now).getTime();
  if (Number.isNaN(nowMs)) {
    throw new Error('now must be a valid ISO timestamp');
  }

  const cutoffMs = nowMs - RETENTION_DAYS * 86400000;
  const filtered = records
    .filter((record) => record.internalUserId === currentInternalUserId)
    .filter((record) => {
      const createdMs = new Date(record.createdAt).getTime();
      const expiresMs = new Date(record.expiresAt).getTime();
      return createdMs >= cutoffMs && createdMs <= nowMs && expiresMs > nowMs;
    })
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(-MAX_HISTORY_ITEMS);

  if (filtered.some((record) => record.internalUserId !== currentInternalUserId)) {
    return { action: 'blocked', history: [], modelAllowed: false };
  }

  return {
    action: filtered.length === 0 ? 'single_turn' : 'history',
    history: filtered.map(({ content, createdAt }) => ({ content, createdAt })),
    modelAllowed: true,
  };
}

export function guardContext({ currentInternalUserId, records }) {
  if (records.some((record) => record.internalUserId !== currentInternalUserId)) {
    return { action: 'blocked', history: [], modelAllowed: false };
  }

  return {
    action: 'history',
    history: records.map(({ content, createdAt }) => ({ content, createdAt })),
    modelAllowed: true,
  };
}
