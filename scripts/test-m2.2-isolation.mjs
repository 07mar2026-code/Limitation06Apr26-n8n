import { randomBytes } from 'node:crypto';
import {
  createInternalUserId,
  guardContext,
  prepareRecord,
  readIsolatedHistory,
} from '../drafts/m2.2-isolation-engine.mjs';

process.env.PASTORAL_ID_HMAC_KEY = randomBytes(32).toString('base64url');

const NOW = '2026-10-08T12:00:00.000Z';
const DAY = 86400000;
const results = [];

function isoDaysAgo(days, minute = 0) {
  return new Date(new Date(NOW).getTime() - days * DAY + minute * 60000).toISOString();
}

function record(userId, content, createdAt) {
  return {
    internalUserId: userId,
    createdAt,
    expiresAt: new Date(new Date(createdAt).getTime() + 30 * DAY).toISOString(),
    content,
  };
}

function test(feature, input, expected, check, actual) {
  let pass = false;
  let observed;
  try {
    observed = actual();
    pass = check(observed);
  } catch (error) {
    observed = { error: error.message };
  }
  results.push({ feature, input, expected, actual: observed, status: pass ? 'PASS' : 'FAIL' });
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
  '雙使用者交錯資料隔離',
  '合成使用者 A、B 各三筆交錯訊息',
  'A 只讀到 A-1～A-3；B 只讀到 B-1～B-3',
  (value) => JSON.stringify(value.a) === JSON.stringify(['A-1', 'A-2', 'A-3'])
    && JSON.stringify(value.b) === JSON.stringify(['B-1', 'B-2', 'B-3']),
  () => ({
    a: readIsolatedHistory({ consent: true, currentInternalUserId: userA, records: interleaved, now: NOW }).history.map((item) => item.content),
    b: readIsolatedHistory({ consent: true, currentInternalUserId: userB, records: interleaved, now: NOW }).history.map((item) => item.content),
  }),
);

test(
  '未同意不保存也不讀取',
  '保存同意=false，並提供合成歷史資料',
  '不產生保存紀錄；歷史為空且採單輪模式',
  (value) => value.writeAction === 'single_turn' && value.hasRecord === false
    && value.readAction === 'single_turn' && value.historyCount === 0,
  () => {
    const write = prepareRecord({ consent: false, syntheticUserReference: 'synthetic-user-a', content: '不應保存', createdAt: NOW });
    const read = readIsolatedHistory({ consent: false, currentInternalUserId: userA, records: interleaved, now: NOW });
    return { writeAction: write.action, hasRecord: write.record !== null, readAction: read.action, historyCount: read.history.length };
  },
);

test(
  '排除逾期資料',
  '同一合成使用者含 29 天與 31 天前各一筆',
  '只保留 29 天前資料',
  (value) => JSON.stringify(value) === JSON.stringify(['day-29']),
  () => readIsolatedHistory({
    consent: true,
    currentInternalUserId: userA,
    records: [record(userA, 'day-31', isoDaysAgo(31)), record(userA, 'day-29', isoDaysAgo(29))],
    now: NOW,
  }).history.map((item) => item.content),
);

test(
  '限制最近十筆',
  '同一合成使用者最近 12 筆',
  '依時間由舊到新保留第 3～12 筆，共 10 筆',
  (value) => value.length === 10 && value[0] === 'item-03' && value[9] === 'item-12',
  () => readIsolatedHistory({
    consent: true,
    currentInternalUserId: userA,
    records: Array.from({ length: 12 }, (_, index) => record(userA, `item-${String(index + 1).padStart(2, '0')}`, isoDaysAgo(12 - index))),
    now: NOW,
  }).history.map((item) => item.content),
);

test(
  '錯誤內部 ID 二次阻斷',
  '已篩選上下文中混入另一合成使用者的一筆資料',
  '立即阻斷、清空歷史且不得送入語言模型',
  (value) => value.action === 'blocked' && value.historyCount === 0 && value.modelAllowed === false,
  () => {
    const guarded = guardContext({
      currentInternalUserId: userA,
      records: [record(userA, 'A-safe', isoDaysAgo(1)), record(userB, 'B-wrong-id', isoDaysAgo(1, 1))],
    });
    return { action: guarded.action, historyCount: guarded.history.length, modelAllowed: guarded.modelAllowed };
  },
);

delete process.env.PASTORAL_ID_HMAC_KEY;

for (const result of results) {
  console.log(JSON.stringify(result));
}

if (results.some((result) => result.status !== 'PASS')) {
  process.exit(1);
}
