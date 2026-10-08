import { randomBytes } from 'node:crypto';
import {
  createInternalUserId,
  deriveInternalUserId,
  guardContext,
  prepareRecord,
  readIsolatedHistory,
  serverSideIdentityQuery,
} from '../drafts/m2.2-isolation-engine.mjs';

process.env.PASTORAL_ID_HMAC_KEY = randomBytes(32).toString('base64url');

const NOW = '2026-10-08T12:00:00.000Z';
const DAY = 86400000;
const results = [];

function isoDaysAgo(days, minute = 0) {
  return new Date(Date.parse(NOW) - days * DAY + minute * 60000).toISOString();
}

function record(userId, content, createdAt) {
  return {
    internalUserId: userId,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 30 * DAY).toISOString(),
    content,
  };
}

function summarize(value) {
  if (value?.action === 'blocked') {
    return {
      action: value.action,
      reasonCode: value.reasonCode,
      historyCount: value.history.length,
      sendToModel: value.sendToModel,
    };
  }
  if (value?.write?.action === 'blocked') {
    return { write: summarize(value.write), read: summarize(value.read) };
  }
  return value;
}

function test(feature, input, expected, check, actual) {
  let pass = false;
  let observed;
  try {
    observed = actual();
    pass = check(observed);
  } catch (error) {
    observed = { unexpectedError: error.message };
  }
  results.push({ feature, input, expected, actual: summarize(observed), status: pass ? 'PASS' : 'FAIL' });
}

function expectBlocked(reasonCode) {
  return (value) => value.action === 'blocked'
    && value.reasonCode === reasonCode
    && value.history.length === 0
    && value.sendToModel === false;
}

const userA = createInternalUserId('synthetic-user-a');
const userB = createInternalUserId('synthetic-user-b');
const interleaved = [
  record(userA, 'A-1', isoDaysAgo(3, 1)),
  record(userB, 'B-1', isoDaysAgo(3, 2)),
  record(userA, 'A-2', isoDaysAgo(2, 1)),
  record(userB, 'B-2', isoDaysAgo(2, 2)),
  record(userA, 'A-3', isoDaysAgo(1, 1)),
  record(userB, 'B-3', isoDaysAgo(1, 2)),
];

test(
  '雙使用者交錯資料隔離回歸',
  '合成使用者 A、B 各三筆交錯資料，先依內部 ID 做服務端等值查詢',
  'A 只讀到 A-1～A-3；B 只讀到 B-1～B-3',
  (value) => JSON.stringify(value.a) === JSON.stringify(['A-1', 'A-2', 'A-3'])
    && JSON.stringify(value.b) === JSON.stringify(['B-1', 'B-2', 'B-3']),
  () => {
    const queryA = serverSideIdentityQuery({ currentInternalUserId: userA, records: interleaved });
    const queryB = serverSideIdentityQuery({ currentInternalUserId: userB, records: interleaved });
    return {
      a: readIsolatedHistory({ consent: true, currentInternalUserId: userA, records: queryA.records, now: NOW }).history.map((item) => item.content),
      b: readIsolatedHistory({ consent: true, currentInternalUserId: userB, records: queryB.records, now: NOW }).history.map((item) => item.content),
    };
  },
);

test('缺少使用者識別', 'source identifier 為空值', '立即阻斷且不得送入模型', expectBlocked('INVALID_SOURCE_IDENTIFIER'), () => deriveInternalUserId(''));

test(
  '缺少 HMAC 金鑰',
  '暫時移除 PASTORAL_ID_HMAC_KEY 後產生內部 ID',
  '立即阻斷且不得送入模型',
  expectBlocked('MISSING_HMAC_KEY'),
  () => {
    const temporaryKey = process.env.PASTORAL_ID_HMAC_KEY;
    delete process.env.PASTORAL_ID_HMAC_KEY;
    const result = deriveInternalUserId('synthetic-user-a');
    process.env.PASTORAL_ID_HMAC_KEY = temporaryKey;
    return result;
  },
);

test(
  'HMAC 計算失敗',
  '合成 HMAC provider 主動拋出錯誤',
  '立即阻斷且不得送入模型',
  expectBlocked('HMAC_COMPUTATION_FAILED'),
  () => deriveInternalUserId('synthetic-user-a', () => { throw new Error('synthetic failure'); }),
);

for (const consent of [false, null, undefined]) {
  test(
    `同意狀態 fail-closed：${String(consent)}`,
    `consent=${String(consent)}`,
    '不得保存、不得讀取歷史、不得送入模型',
    (value) => expectBlocked('CONSENT_NOT_EXPLICITLY_TRUE')(value.write)
      && expectBlocked('CONSENT_NOT_EXPLICITLY_TRUE')(value.read),
    () => ({
      write: prepareRecord({ consent, syntheticUserReference: 'synthetic-user-a', content: '不應保存', createdAt: NOW }),
      read: readIsolatedHistory({ consent, currentInternalUserId: userA, records: [], now: NOW }),
    }),
  );
}

test(
  '錯誤內部 ID 整批阻斷',
  'D4 回傳結果混入另一合成使用者的一筆資料',
  '不得只濾掉錯誤筆；整批阻斷、歷史清空、不送入模型',
  expectBlocked('MIXED_INTERNAL_ID'),
  () => guardContext({ currentInternalUserId: userA, records: [record(userA, 'A-safe', isoDaysAgo(1)), record(userB, 'B-wrong-id', isoDaysAgo(1, 1))] }),
);

test(
  '畸形紀錄整批阻斷',
  'D4 回傳一筆缺少 content 的紀錄',
  '整批阻斷、歷史清空、不送入模型',
  expectBlocked('MALFORMED_RECORD'),
  () => readIsolatedHistory({ consent: true, currentInternalUserId: userA, records: [{ internalUserId: userA, createdAt: isoDaysAgo(1), expiresAt: isoDaysAgo(-29) }], now: NOW }),
);

test(
  '無效時間整批阻斷',
  'D4 回傳一筆 createdAt 無法解析的紀錄',
  '整批阻斷、不得回傳未篩選資料、不送入模型',
  expectBlocked('INVALID_TIMESTAMP'),
  () => readIsolatedHistory({ consent: true, currentInternalUserId: userA, records: [{ internalUserId: userA, content: 'invalid-time', createdAt: 'not-a-time', expiresAt: isoDaysAgo(-29) }], now: NOW }),
);

test(
  '排除逾期資料',
  '同一合成使用者含 29 天與 31 天前各一筆',
  '只保留 29 天前資料',
  (value) => JSON.stringify(value) === JSON.stringify(['day-29']),
  () => readIsolatedHistory({ consent: true, currentInternalUserId: userA, records: [record(userA, 'day-31', isoDaysAgo(31)), record(userA, 'day-29', isoDaysAgo(29))], now: NOW }).history.map((item) => item.content),
);

test(
  '限制最近十筆',
  '同一合成使用者最近 12 筆',
  '依時間由舊到新保留第 3～12 筆，共 10 筆',
  (value) => value.length === 10 && value[0] === 'item-03' && value[9] === 'item-12',
  () => readIsolatedHistory({ consent: true, currentInternalUserId: userA, records: Array.from({ length: 12 }, (_, index) => record(userA, `item-${String(index + 1).padStart(2, '0')}`, isoDaysAgo(12 - index))), now: NOW }).history.map((item) => item.content),
);

delete process.env.PASTORAL_ID_HMAC_KEY;

for (const result of results) console.log(JSON.stringify(result));
if (results.some((result) => result.status !== 'PASS')) process.exit(1);
