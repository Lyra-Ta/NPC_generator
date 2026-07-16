/**
 * 串行化本脚本对同一本世界书的写操作。
 *
 * Tavern Helper 的 updateWorldbookWith 本质上是“读取 → 修改 → 整体写回”；
 * 如果同一本世界书的多个档案写入并发执行，后写回的旧快照可能覆盖先完成的改动。
 * 这个队列消除本插件内部的并发丢更新；外部脚本造成的修改仍由各写入函数的
 * 内容/UID 校验负责发现。
 */
const mutationTails = new Map<string, Promise<void>>();

export async function withWorldbookMutation<T>(worldbookName: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutationTails.get(worldbookName) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  mutationTails.set(worldbookName, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (mutationTails.get(worldbookName) === tail) mutationTails.delete(worldbookName);
  }
}
