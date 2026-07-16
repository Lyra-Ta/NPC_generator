import assert from 'node:assert/strict';
import test from 'node:test';
import { withWorldbookMutation } from '../src/worldbook-mutation.ts';

test('同一本世界书的写操作严格串行执行', async () => {
  const events: string[] = [];
  let releaseFirst!: () => void;
  let markFirstStarted!: () => void;
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });
  const firstStarted = new Promise<void>(resolve => {
    markFirstStarted = resolve;
  });

  const first = withWorldbookMutation('同一本', async () => {
    events.push('first:start');
    markFirstStarted();
    await firstGate;
    events.push('first:end');
  });
  const second = withWorldbookMutation('同一本', async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await firstStarted;
  assert.deepEqual(events, ['first:start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('前一个写操作失败后，队列仍会继续', async () => {
  await assert.rejects(
    withWorldbookMutation('失败恢复', async () => {
      throw new Error('预期失败');
    }),
    /预期失败/,
  );

  const result = await withWorldbookMutation('失败恢复', async () => 42);
  assert.equal(result, 42);
});
