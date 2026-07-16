import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AmbiguousEntryError,
  getCharacterEntries,
  overwriteCharacterEntry,
  OverwriteConflictError,
} from '../src/worldbook.ts';

type TestEntry = {
  uid: number;
  name: string;
  enabled: boolean;
  strategy: {
    type: 'constant' | 'selective' | 'vectorized';
    keys: string[];
    keys_secondary: { logic: 'and_any'; keys: string[] };
    scan_depth: 'same_as_global' | number;
  };
  position: { type: string; role: 'system'; depth: number; order: number };
  content: string;
  probability: number;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
};

const books = new Map<string, TestEntry[]>();
let lastRenderOption: unknown;

Object.assign(globalThis, {
  getWorldbook: async (worldbookName: string) => books.get(worldbookName) ?? [],
  updateWorldbookWith: async (
    worldbookName: string,
    updater: (entries: TestEntry[]) => TestEntry[] | Promise<TestEntry[]>,
    options?: { render?: string },
  ) => {
    const current = books.get(worldbookName) ?? [];
    const updated = await updater(current);
    books.set(worldbookName, updated);
    lastRenderOption = options;
    return updated;
  },
});

function archivedEntry(overrides: Partial<TestEntry> = {}): TestEntry {
  return {
    uid: 41,
    name: 'A B-¥$',
    enabled: false,
    strategy: {
      type: 'vectorized',
      keys: ['A B-¥$', '手工关键词'],
      keys_secondary: { logic: 'and_any', keys: ['secondary'] },
      scan_depth: 7,
    },
    position: { type: 'at_depth', role: 'system', depth: 3, order: 88 },
    content: '<A B-¥$_info>旧档案</A B-¥$_info>',
    probability: 73,
    extra: {
      savedAt: '2025-01-02T03:04:05.000Z',
      handEdited: true,
      nested: { keep: 'me' },
    },
    recursion: { prevent_incoming: true, prevent_outgoing: false },
    displayIndex: 9,
    ...overrides,
  };
}

function resetBook(entries: TestEntry[]) {
  books.clear();
  books.set('NPC 档案', entries);
  lastRenderOption = undefined;
}

test('两阶段覆盖只替换正文和审计字段，并保留世界书元数据', async () => {
  const original = archivedEntry();
  const unrelated = archivedEntry({ uid: 99, name: '其他人', content: '不要改我' });
  resetBook([original, unrelated]);

  // 第一阶段：打开对比时，实时取得需要冻结给用户看的旧正文和 uid。
  const matches = await getCharacterEntries('NPC 档案', 'A B-¥$');
  assert.equal(matches.length, 1);
  const proposal = {
    entryUid: matches[0].uid,
    expectedOldContent: matches[0].content,
  };

  // 第二阶段：用户确认后，以 uid + 名称 + 旧正文进行乐观并发校验。
  const updated = await overwriteCharacterEntry({
    worldbookName: 'NPC 档案',
    name: 'A B-¥$',
    ...proposal,
    newContent: '<A B-¥$_info>新档案</A B-¥$_info>',
    sourceMessageId: 208,
  });

  assert.equal(updated.content, '<A B-¥$_info>新档案</A B-¥$_info>');
  assert.equal(updated.uid, original.uid);
  assert.equal(updated.name, original.name);
  assert.equal(updated.enabled, original.enabled);
  assert.deepEqual(updated.strategy, original.strategy);
  assert.deepEqual(updated.position, original.position);
  assert.equal(updated.probability, original.probability);
  assert.deepEqual(updated.recursion, original.recursion);
  assert.equal(updated.displayIndex, original.displayIndex);

  assert.equal(updated.extra?.savedAt, original.extra?.savedAt);
  assert.equal(updated.extra?.handEdited, true);
  assert.deepEqual(updated.extra?.nested, { keep: 'me' });
  assert.equal(updated.extra?.archivedFrom, 'role-info-archiver');
  assert.equal(updated.extra?.sourceMessageId, 208);
  assert.equal(typeof updated.extra?.updatedAt, 'string');
  assert.equal(Number.isNaN(Date.parse(updated.extra?.updatedAt as string)), false);

  assert.strictEqual(books.get('NPC 档案')?.[1], unrelated);
  assert.deepEqual(lastRenderOption, { render: 'immediate' });
});

test('对比打开后旧正文变化时拒绝覆盖', async () => {
  const original = archivedEntry();
  resetBook([original]);
  const [snapshot] = await getCharacterEntries('NPC 档案', original.name);

  const externallyEdited = { ...original, content: '用户在世界书里刚刚手改过' };
  books.set('NPC 档案', [externallyEdited]);

  await assert.rejects(
    overwriteCharacterEntry({
      worldbookName: 'NPC 档案',
      entryUid: snapshot.uid,
      name: snapshot.name,
      expectedOldContent: snapshot.content,
      newContent: '本次准备写入的内容',
    }),
    OverwriteConflictError,
  );
  assert.strictEqual(books.get('NPC 档案')?.[0], externallyEdited);
});

test('确认覆盖时出现多个同名条目会安全中止', async () => {
  const original = archivedEntry();
  resetBook([original]);
  const [snapshot] = await getCharacterEntries('NPC 档案', original.name);
  const duplicate = archivedEntry({ uid: 42, content: '另一个同名档案' });
  books.set('NPC 档案', [original, duplicate]);

  await assert.rejects(
    overwriteCharacterEntry({
      worldbookName: 'NPC 档案',
      entryUid: snapshot.uid,
      name: snapshot.name,
      expectedOldContent: snapshot.content,
      newContent: '不应写入',
    }),
    error =>
      error instanceof AmbiguousEntryError && error.count === 2 && error.worldbookName === 'NPC 档案',
  );
  assert.strictEqual(books.get('NPC 档案')?.[0], original);
  assert.strictEqual(books.get('NPC 档案')?.[1], duplicate);
});

test('对比打开后目标被删除或改名时拒绝覆盖', async t => {
  await t.test('目标被删除', async () => {
    const original = archivedEntry();
    resetBook([original]);
    const [snapshot] = await getCharacterEntries('NPC 档案', original.name);
    const unrelated = archivedEntry({ uid: 99, name: '其他人' });
    books.set('NPC 档案', [unrelated]);

    await assert.rejects(
      overwriteCharacterEntry({
        worldbookName: 'NPC 档案',
        entryUid: snapshot.uid,
        name: snapshot.name,
        expectedOldContent: snapshot.content,
        newContent: '不应写入',
      }),
      OverwriteConflictError,
    );
    assert.strictEqual(books.get('NPC 档案')?.[0], unrelated);
  });

  await t.test('目标被改名', async () => {
    const original = archivedEntry();
    resetBook([original]);
    const [snapshot] = await getCharacterEntries('NPC 档案', original.name);
    const renamed = { ...original, name: '用户刚改的新名字' };
    books.set('NPC 档案', [renamed]);

    await assert.rejects(
      overwriteCharacterEntry({
        worldbookName: 'NPC 档案',
        entryUid: snapshot.uid,
        name: snapshot.name,
        expectedOldContent: snapshot.content,
        newContent: '不应写入',
      }),
      OverwriteConflictError,
    );
    assert.strictEqual(books.get('NPC 档案')?.[0], renamed);
  });
});
