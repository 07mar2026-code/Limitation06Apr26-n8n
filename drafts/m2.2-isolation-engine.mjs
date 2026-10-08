import { createHmac } from 'node:crypto';

const RETENTION_DAYS = 30;
const MAX_HISTORY_ITEMS = 10;
const ID_VERSION = 'hmac-sha256-v1';
const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function blocked(reasonCode) {
  return {
    action: 'blocked',
    reasonCode,
    history: [],
    record: null,
    internalUserId: null,
    sendToModel: false,
  };
}

function isValidSourceIdentifier(value) {
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= 128
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function isValidInternalUserId(value) {
  return typeof value === 'string' && INTERNAL_ID_PATTERN.test(value);
}

function parseTimestamp(value) {
  if (typeof value !== 'string' || !UTC_ISO_PATTERN.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return { milliseconds, iso: new Date(milliseconds).toISOString() };
}

export function deriveInternalUserId(sourceIdentifier, hmacFactory = createHmac) {
  if (!isValidSourceIdentifier(sourceIdentifier)) {
    return blocked('INVALID_SOURCE_IDENTIFIER');
  }

  const secret = process.env.PASTORAL_ID_HMAC_KEY;
  if (typeof secret !== 'string' || secret.length === 0) {
    return blocked('MISSING_HMAC_KEY');
  }

  try {
    const internalUserId = hmacFactory('sha256', secret)
      .update(sourceIdentifier, 'utf8')
      .digest('base64url');

    if (!isValidInternalUserId(internalUserId)) {
      return blocked('INVALID_HMAC_OUTPUT');
    }

    return {
      action: 'identity_ready',
      internalUserId,
      identityVersion: ID_VERSION,
      sendToModel: false,
    };
  } catch {
    return blocked('HMAC_COMPUTATION_FAILED');
  }
}

export function createInternalUserId(sourceIdentifier) {
  const result = deriveInternalUserId(sourceIdentifier);
  if (result.action === 'blocked') {
    throw new Error(result.reasonCode);
  }
  return result.internalUserId;
}

export function prepareRecord({ consent, syntheticUserReference, content, createdAt }) {
  if (consent !== true) {
    return blocked('CONSENT_NOT_EXPLICITLY_TRUE');
  }
  if (typeof content !== 'string') {
    return blocked('INVALID_CONTENT');
  }

  const timestamp = parseTimestamp(createdAt);
  if (!timestamp) {
    return blocked('INVALID_CREATED_AT');
  }

  const identity = deriveInternalUserId(syntheticUserReference);
  if (identity.action === 'blocked') return identity;

  return {
    action: 'store',
    record: {
      internalUserId: identity.internalUserId,
      identityVersion: ID_VERSION,
      createdAt: timestamp.iso,
      expiresAt: new Date(timestamp.milliseconds + RETENTION_DAYS * 86400000).toISOString(),
      content,
    },
    history: [],
    sendToModel: false,
  };
}

export function serverSideIdentityQuery({ currentInternalUserId, records }) {
  if (!isValidInternalUserId(currentInternalUserId) || !Array.isArray(records)) {
    return blocked('INVALID_IDENTITY_QUERY');
  }

  return {
    action: 'query_result',
    records: records.filter((record) => record?.internalUserId === currentInternalUserId),
    sendToModel: false,
  };
}

function validateReturnedRecord(record, currentInternalUserId) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'MALFORMED_RECORD';
  if (!isValidInternalUserId(record.internalUserId)) return 'MALFORMED_RECORD';
  if (record.internalUserId !== currentInternalUserId) return 'MIXED_INTERNAL_ID';
  if (typeof record.content !== 'string') return 'MALFORMED_RECORD';
  if (!parseTimestamp(record.createdAt) || !parseTimestamp(record.expiresAt)) return 'INVALID_TIMESTAMP';
  return null;
}

export function readIsolatedHistory({ consent, currentInternalUserId, records, now }) {
  if (consent !== true) return blocked('CONSENT_NOT_EXPLICITLY_TRUE');
  if (!isValidInternalUserId(currentInternalUserId)) return blocked('INVALID_CURRENT_INTERNAL_ID');
  if (!Array.isArray(records)) return blocked('MALFORMED_HISTORY_RESULT');

  const currentTime = parseTimestamp(now);
  if (!currentTime) return blocked('INVALID_NOW');

  for (const record of records) {
    const reasonCode = validateReturnedRecord(record, currentInternalUserId);
    if (reasonCode) return blocked(reasonCode);
  }

  const cutoffMs = currentTime.milliseconds - RETENTION_DAYS * 86400000;
  const history = records
    .filter((record) => {
      const createdMs = Date.parse(record.createdAt);
      const expiresMs = Date.parse(record.expiresAt);
      return createdMs >= cutoffMs
        && createdMs <= currentTime.milliseconds
        && expiresMs > currentTime.milliseconds;
    })
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-MAX_HISTORY_ITEMS)
    .map(({ content, createdAt }) => ({ content, createdAt }));

  return {
    action: history.length === 0 ? 'single_turn' : 'history',
    history,
    sendToModel: true,
  };
}

export function guardContext({ currentInternalUserId, records }) {
  if (!isValidInternalUserId(currentInternalUserId) || !Array.isArray(records)) {
    return blocked('INVALID_CONTEXT_INPUT');
  }

  for (const record of records) {
    const reasonCode = validateReturnedRecord(record, currentInternalUserId);
    if (reasonCode) return blocked(reasonCode);
  }

  return {
    action: 'history',
    history: records.map(({ content, createdAt }) => ({ content, createdAt })),
    sendToModel: true,
  };
}
