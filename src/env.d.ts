declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}

declare module '*?raw' {
  const content: string;
  export default content;
}

interface ScriptButton {
  name: string;
  visible: boolean;
}

interface ChatMessage {
  message_id: number;
  role: 'system' | 'assistant' | 'user';
  message: string;
}

interface WorldbookEntry {
  uid: number;
  name: string;
  enabled: boolean;
  strategy: {
    type: 'constant' | 'selective' | 'vectorized';
    keys: Array<string | RegExp>;
    keys_secondary: {
      logic: 'and_any' | 'and_all' | 'not_all' | 'not_any';
      keys: Array<string | RegExp>;
    };
    scan_depth: 'same_as_global' | number;
  };
  position: {
    type: string;
    role: 'system' | 'assistant' | 'user';
    depth: number;
    order: number;
  };
  content: string;
  probability: number;
  extra?: Record<string, any>;
  [key: string]: any;
}

interface NewWorldbookEntry {
  name?: string;
  enabled?: boolean;
  strategy?: Partial<WorldbookEntry['strategy']>;
  position?: Partial<WorldbookEntry['position']>;
  content?: string;
  probability?: number;
  extra?: Record<string, any>;
}

declare function getScriptId(): string;
declare function getButtonEvent(buttonName: string): string;
declare function appendInexistentScriptButtons(buttons: ScriptButton[]): void;
declare function updateScriptButtonsWith(updater: (buttons: ScriptButton[]) => ScriptButton[]): ScriptButton[];

declare function getVariables(option: { type: 'script'; script_id?: string }): Record<string, any>;
declare function insertOrAssignVariables(
  variables: Record<string, any>,
  option: { type: 'script'; script_id?: string },
): Record<string, any>;

declare function getLastMessageId(): number;
declare function getChatMessages(messageId: number): ChatMessage[];
declare function errorCatched<T extends any[], U>(fn: (...args: T) => U): (...args: T) => U;

declare function getWorldbookNames(): string[];
declare function getCharWorldbookNames(characterName: 'current'): { primary: string | null; additional: string[] };
declare function getWorldbook(worldbookName: string): Promise<WorldbookEntry[]>;
declare function createWorldbookEntries(
  worldbookName: string,
  entries: NewWorldbookEntry[],
  options?: { render?: 'debounced' | 'immediate' },
): Promise<{ worldbook: WorldbookEntry[]; new_entries: WorldbookEntry[] }>;
declare function updateWorldbookWith(
  worldbookName: string,
  updater: (entries: WorldbookEntry[]) => WorldbookEntry[] | Promise<WorldbookEntry[]>,
  options?: { render?: 'debounced' | 'immediate' },
): Promise<WorldbookEntry[]>;

declare const tavern_events: { CHAT_CHANGED: string };
declare function eventOn(eventType: string, listener: (...args: any[]) => void): { stop: () => void };
