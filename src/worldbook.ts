/** 世界书读写：新建角色档案、读取同名条目、经确认后覆盖正文。 */

import { withWorldbookMutation } from '#worldbook-mutation';

export class DuplicateError extends Error {
  public worldbookName: string;
  public entryName: string;

  constructor(worldbookName: string, entryName: string) {
    super(`世界书 "${worldbookName}" 中已存在条目 "${entryName}"`);
    this.name = 'DuplicateError';
    this.worldbookName = worldbookName;
    this.entryName = entryName;
  }
}

export class OverwriteConflictError extends Error {
  constructor(message = '档案在对比后已发生变化，请重新打开对比后再覆盖') {
    super(message);
    this.name = 'OverwriteConflictError';
  }
}

export class AmbiguousEntryError extends Error {
  public worldbookName: string;
  public entryName: string;
  public count: number;

  constructor(worldbookName: string, entryName: string, count: number) {
    super(`世界书 "${worldbookName}" 中有 ${count} 个同名条目 "${entryName}"，无法安全判断要覆盖哪一个`);
    this.name = 'AmbiguousEntryError';
    this.worldbookName = worldbookName;
    this.entryName = entryName;
    this.count = count;
  }
}

export type StrategyType = 'selective' | 'constant';

export interface SaveOptions {
  worldbookName: string;
  name: string;
  content: string;
  sourceMessageId?: number;
  strategyType?: StrategyType;
}

export interface OverwriteOptions {
  worldbookName: string;
  entryUid: number;
  name: string;
  expectedOldContent: string;
  newContent: string;
  sourceMessageId?: number;
}

/** 新建档案；同名时不写入，由上层打开覆盖对比。 */
export async function saveCharacterEntry({
  worldbookName,
  name,
  content,
  sourceMessageId,
  strategyType = 'selective',
}: SaveOptions): Promise<void> {
  await withWorldbookMutation(worldbookName, async () => {
    const existing = await getWorldbook(worldbookName);
    if (existing.some(entry => entry.name === name)) {
      throw new DuplicateError(worldbookName, name);
    }

    await createWorldbookEntries(
      worldbookName,
      [
        {
          name,
          enabled: true,
          strategy: {
            type: strategyType,
            keys: [name],
            keys_secondary: { logic: 'and_any', keys: [] },
            scan_depth: 'same_as_global',
          },
          position: {
            type: 'after_character_definition',
            order: 100,
            role: 'system',
            depth: 0,
          },
          content,
          probability: 100,
          extra: {
            archivedFrom: 'role-info-archiver',
            sourceMessageId: sourceMessageId ?? null,
            savedAt: new Date().toISOString(),
          },
        },
      ],
      { render: 'immediate' },
    );
  });
}

/** 每次准备覆盖时实时读取，不能把 UI 的灯色缓存当成世界书真相。 */
export async function getCharacterEntries(worldbookName: string, name: string): Promise<WorldbookEntry[]> {
  return (await getWorldbook(worldbookName)).filter(entry => entry.name === name);
}

/**
 * 只覆盖已经向用户展示过的新旧正文；保留 UID、灯型、关键词、位置、概率等手工设置。
 * 确认时再次校验 uid/name/旧正文，避免覆盖掉对比框打开后发生的外部修改。
 */
export async function overwriteCharacterEntry({
  worldbookName,
  entryUid,
  name,
  expectedOldContent,
  newContent,
  sourceMessageId,
}: OverwriteOptions): Promise<WorldbookEntry> {
  let updatedEntry: WorldbookEntry | null = null;

  await withWorldbookMutation(worldbookName, async () => {
    await updateWorldbookWith(
      worldbookName,
      entries => {
        const sameNameEntries = entries.filter(entry => entry.name === name);
        if (sameNameEntries.length > 1) {
          throw new AmbiguousEntryError(worldbookName, name, sameNameEntries.length);
        }

        const index = entries.findIndex(entry => entry.uid === entryUid && entry.name === name);
        if (index < 0 || entries[index].content !== expectedOldContent) {
          throw new OverwriteConflictError();
        }

        const previous = entries[index];
        const now = new Date().toISOString();
        updatedEntry = {
          ...previous,
          content: newContent,
          extra: {
            ...previous.extra,
            archivedFrom: 'role-info-archiver',
            sourceMessageId: sourceMessageId ?? null,
            savedAt: previous.extra?.savedAt ?? now,
            updatedAt: now,
          },
        };

        return entries.map((entry, entryIndex) => (entryIndex === index ? updatedEntry! : entry));
      },
      { render: 'immediate' },
    );
  });

  if (!updatedEntry) throw new OverwriteConflictError();
  return updatedEntry;
}

export function listAvailableWorldbooks(): string[] {
  return getWorldbookNames();
}

export function getDefaultWorldbook(): string | null {
  try {
    return getCharWorldbookNames('current').primary;
  } catch {
    return null;
  }
}
