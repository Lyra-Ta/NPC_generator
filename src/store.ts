import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { parseCharacterInfo, type ParsedCharacter } from './parser';
import { DEFAULT_THEME_ID, getTheme, themes, type ThemeId } from './themes';
import {
  AmbiguousEntryError,
  DuplicateError,
  getCharacterEntries,
  getDefaultWorldbook,
  listAvailableWorldbooks,
  overwriteCharacterEntry,
  OverwriteConflictError,
  saveCharacterEntry,
  type StrategyType,
} from './worldbook';

export interface ExistingEntryInfo {
  strategyType: 'selective' | 'constant' | 'vectorized';
}

export type LampColor = 'gray' | 'green' | 'blue' | 'purple';
export type View = 'list' | 'detail';

export interface OverwriteProposal {
  worldbookName: string;
  entryUid: number;
  entryName: string;
  oldContent: string;
  newContent: string;
  sourceMessageId: number;
  strategyType: ExistingEntryInfo['strategyType'];
}

interface Settings {
  themeId: ThemeId;
}

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themes.some(theme => theme.id === value);
}

function loadSettings(): Settings {
  try {
    const raw = getVariables({ type: 'script', script_id: getScriptId() });
    return {
      themeId: isThemeId(raw.themeId) ? raw.themeId : DEFAULT_THEME_ID,
    };
  } catch {
    return { themeId: DEFAULT_THEME_ID };
  }
}

export const useArchiveStore = defineStore('role-info-archive', () => {
  const panelVisible = ref(false);
  const messageId = ref(-1);
  const characters = ref<ParsedCharacter[]>([]);
  const activeCharacter = ref<ParsedCharacter | null>(null);
  const view = ref<View>('list');

  const availableWorldbooks = ref<string[]>([]);
  const targetWorldbook = ref<string | null>(null);
  const existingEntries = ref<Map<string, ExistingEntryInfo>>(new Map());
  const checkingExistence = ref(false);
  const nextSaveStrategy = ref<StrategyType>('selective');

  const overwriteProposal = ref<OverwriteProposal | null>(null);
  const preparingOverwrite = ref(false);
  const saving = ref(false);
  const lastMessageId = ref(0);

  const settings = ref<Settings>(loadSettings());
  const themeId = computed<ThemeId>({
    get: () => settings.value.themeId,
    set: value => {
      settings.value = { ...settings.value, themeId: value };
    },
  });
  const themeVars = computed(() => getTheme(themeId.value).vars);
  watch(
    settings,
    value => {
      try {
        insertOrAssignVariables({ ...value }, { type: 'script', script_id: getScriptId() });
      } catch (error) {
        console.warn('[role-info-archive] 保存脚本设置失败', error);
      }
    },
    { deep: true, immediate: true },
  );

  let existingRequestId = 0;
  let openRequestId = 0;

  function getLampColor(name: string): LampColor {
    const info = existingEntries.value.get(name);
    if (!info) return 'gray';
    if (info.strategyType === 'constant') return 'blue';
    if (info.strategyType === 'selective') return 'green';
    return 'purple';
  }

  function isArchived(name: string): boolean {
    return existingEntries.value.has(name);
  }

  function clearOverwriteProposal() {
    overwriteProposal.value = null;
  }

  watch(targetWorldbook, () => {
    clearOverwriteProposal();
    void refreshExistingNames();
  });

  async function refreshExistingNames() {
    const worldbookName = targetWorldbook.value;
    const requestId = ++existingRequestId;

    if (!worldbookName) {
      existingEntries.value = new Map();
      checkingExistence.value = false;
      return;
    }

    checkingExistence.value = true;
    try {
      const entries = await getWorldbook(worldbookName);
      if (requestId !== existingRequestId || targetWorldbook.value !== worldbookName) return;

      const map = new Map<string, ExistingEntryInfo>();
      for (const entry of entries) map.set(entry.name, { strategyType: entry.strategy.type });
      existingEntries.value = map;
    } catch (error) {
      if (requestId !== existingRequestId) return;
      console.warn('[role-info-archive] 读取世界书失败', error);
      existingEntries.value = new Map();
    } finally {
      if (requestId === existingRequestId) checkingExistence.value = false;
    }
  }

  function refreshAvailableWorldbooks() {
    availableWorldbooks.value = listAvailableWorldbooks();
  }

  function ensureCurrentTargetWorldbook() {
    if (targetWorldbook.value && availableWorldbooks.value.includes(targetWorldbook.value)) return;
    targetWorldbook.value = null;
    const primary = getDefaultWorldbook();
    if (primary && availableWorldbooks.value.includes(primary)) targetWorldbook.value = primary;
  }

  async function refreshWorldbookState() {
    refreshAvailableWorldbooks();
    ensureCurrentTargetWorldbook();
    await refreshExistingNames();
  }

  async function openWithLatest() {
    const requestId = ++openRequestId;
    await refreshWorldbookState();
    if (requestId !== openRequestId) return;

    lastMessageId.value = getLastMessageId();
    loadMessage(lastMessageId.value);
    view.value = 'list';
    panelVisible.value = true;
  }

  function close() {
    openRequestId += 1;
    panelVisible.value = false;
    activeCharacter.value = null;
    view.value = 'list';
    clearOverwriteProposal();
  }

  function loadMessage(id: number) {
    clearOverwriteProposal();
    lastMessageId.value = getLastMessageId();
    const clamped = Math.max(0, Math.min(id, lastMessageId.value));
    messageId.value = clamped;
    const text = getChatMessages(clamped)[0]?.message ?? '';
    characters.value = parseCharacterInfo(text);
    view.value = 'list';
    activeCharacter.value = null;
  }

  function gotoPrev() {
    if (messageId.value > 0) loadMessage(messageId.value - 1);
  }

  function gotoNext() {
    if (messageId.value < lastMessageId.value) loadMessage(messageId.value + 1);
  }

  function gotoLatest() {
    loadMessage(getLastMessageId());
  }

  function openDetail(character: ParsedCharacter) {
    clearOverwriteProposal();
    activeCharacter.value = character;
    const existing = existingEntries.value.get(character.name);
    if (existing?.strategyType === 'constant' || existing?.strategyType === 'selective') {
      nextSaveStrategy.value = existing.strategyType;
    }
    view.value = 'detail';
  }

  function backToList() {
    clearOverwriteProposal();
    activeCharacter.value = null;
    view.value = 'list';
  }

  function currentSaveSnapshot() {
    if (!activeCharacter.value || !targetWorldbook.value) return null;
    return {
      worldbookName: targetWorldbook.value,
      name: activeCharacter.value.name,
      content: activeCharacter.value.content,
      sourceMessageId: messageId.value,
      strategyType: nextSaveStrategy.value,
    };
  }

  function snapshotIsStillCurrent(snapshot: NonNullable<ReturnType<typeof currentSaveSnapshot>>): boolean {
    return (
      targetWorldbook.value === snapshot.worldbookName &&
      activeCharacter.value?.name === snapshot.name &&
      activeCharacter.value?.content === snapshot.content &&
      messageId.value === snapshot.sourceMessageId
    );
  }

  async function prepareOverwrite(snapshot: NonNullable<ReturnType<typeof currentSaveSnapshot>>) {
    preparingOverwrite.value = true;
    try {
      const matches = await getCharacterEntries(snapshot.worldbookName, snapshot.name);
      if (!snapshotIsStillCurrent(snapshot)) return;
      if (matches.length > 1) throw new AmbiguousEntryError(snapshot.worldbookName, snapshot.name, matches.length);
      if (matches.length === 0) throw new Error('同名旧档案已不存在，请重新点击保存');

      const entry = matches[0];
      overwriteProposal.value = {
        worldbookName: snapshot.worldbookName,
        entryUid: entry.uid,
        entryName: entry.name,
        oldContent: entry.content,
        newContent: snapshot.content,
        sourceMessageId: snapshot.sourceMessageId,
        strategyType: entry.strategy.type,
      };
    } finally {
      preparingOverwrite.value = false;
    }
  }

  async function saveActive() {
    if (saving.value || preparingOverwrite.value) return;
    const snapshot = currentSaveSnapshot();
    if (!snapshot) return;

    preparingOverwrite.value = true;
    try {
      const matches = await getCharacterEntries(snapshot.worldbookName, snapshot.name);
      if (!snapshotIsStillCurrent(snapshot)) return;
      if (matches.length > 0) {
        if (matches.length > 1) throw new AmbiguousEntryError(snapshot.worldbookName, snapshot.name, matches.length);
        await prepareOverwrite(snapshot);
        return;
      }

      saving.value = true;
      await saveCharacterEntry(snapshot);
      if (targetWorldbook.value === snapshot.worldbookName) {
        const map = new Map(existingEntries.value);
        map.set(snapshot.name, { strategyType: snapshot.strategyType });
        existingEntries.value = map;
      } else {
        await refreshExistingNames();
      }
      toastr.success(`已保存 "${snapshot.name}" 到 "${snapshot.worldbookName}"`);
    } catch (error) {
      if (error instanceof DuplicateError) {
        await prepareOverwrite(snapshot);
      } else {
        console.error(error);
        toastr.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      saving.value = false;
      preparingOverwrite.value = false;
    }
  }

  async function confirmOverwrite() {
    if (saving.value || !overwriteProposal.value) return;
    const proposal = { ...overwriteProposal.value };
    saving.value = true;
    try {
      const updated = await overwriteCharacterEntry({
        worldbookName: proposal.worldbookName,
        entryUid: proposal.entryUid,
        name: proposal.entryName,
        expectedOldContent: proposal.oldContent,
        newContent: proposal.newContent,
        sourceMessageId: proposal.sourceMessageId,
      });
      overwriteProposal.value = null;
      if (targetWorldbook.value === proposal.worldbookName) {
        const map = new Map(existingEntries.value);
        map.set(updated.name, { strategyType: updated.strategy.type });
        existingEntries.value = map;
      } else {
        await refreshExistingNames();
      }
      toastr.success(`已覆盖 "${updated.name}"；原有激活方式与其他设置均已保留`);
    } catch (error) {
      if (error instanceof OverwriteConflictError) {
        toastr.warning(error.message);
        const snapshot = currentSaveSnapshot();
        overwriteProposal.value = null;
        if (snapshot) await prepareOverwrite(snapshot);
      } else {
        console.error(error);
        toastr.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      saving.value = false;
    }
  }

  /** 当前聊天改变时清掉“档案保存目标”；下一次打开将重新取新角色的 primary 世界书。 */
  function handleChatChanged() {
    close();
    targetWorldbook.value = null;
    existingEntries.value = new Map();
    characters.value = [];
    messageId.value = -1;
    lastMessageId.value = 0;
  }

  function setTheme(id: ThemeId) {
    themeId.value = id;
  }

  return {
    panelVisible,
    messageId,
    characters,
    activeCharacter,
    view,
    availableWorldbooks,
    targetWorldbook,
    existingEntries,
    checkingExistence,
    overwriteProposal,
    preparingOverwrite,
    saving,
    lastMessageId,
    themeId,
    themeVars,
    nextSaveStrategy,
    getLampColor,
    isArchived,
    openWithLatest,
    close,
    loadMessage,
    gotoPrev,
    gotoNext,
    gotoLatest,
    openDetail,
    backToList,
    refreshAvailableWorldbooks,
    refreshWorldbookState,
    refreshExistingNames,
    saveActive,
    confirmOverwrite,
    clearOverwriteProposal,
    handleChatChanged,
    setTheme,
  };
});
