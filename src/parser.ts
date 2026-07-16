/**
 * 解析 <{name}_info>...</{name}_info> 标签
 *
 * 同一段正文里可能出现多个标签;
 * 同名 name 出现多次时, 多段内容会按出现顺序合并 (用 \n\n 分隔), 并在按钮上展示出现次数.
 */

export interface ParsedCharacter {
  /** 标签里的 {name} 部分 */
  name: string;
  /**
   * 该 name 在本楼层正文中所有出现的"完整标签块" (包含 <X_info> 与 </X_info>),
   * 多次出现用 \n\n 拼接。这是详情视图展示和保存到世界书时使用的内容。
   */
  content: string;
  /** 出现次数, 用于在按钮上加 ×N 标记 */
  occurrences: number;
  /** 每次出现的"完整标签块"原始片段 */
  fragments: string[];
}

/**
 * 角色名只禁止会破坏标签边界的 `<`、`>` 和换行。
 *
 * 因为闭合标签使用的是正则反向引用，而不是把 name 再拼成一段正则，
 * 所以空格、横线、下划线、`¥`、`$` 等字符都可以安全地出现在名称里。
 * 例如：`<A B_info>`、`<Jean-Luc_info>`、`<¥$_info>`。
 */
// 不使用 String.matchAll 或 Unicode 正则标志，兼容部分较旧的 Android WebView。
// 同时容忍模型在 _info 与 > 之间多输出空白。
const TAG_REGEX = /<([^<>\r\n]+?)_info\s*>([\s\S]*?)<\/\1_info\s*>/g;

export function parseCharacterInfo(messageText: string): ParsedCharacter[] {
  const map = new Map<string, ParsedCharacter>();
  TAG_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TAG_REGEX.exec(messageText)) !== null) {
    const [fullBlock, name, rawInner] = match;
    // 内层为空则跳过 (避免 <X_info></X_info> 这种空壳被收录)
    if (!rawInner.trim()) continue;

    const normalizedName = name.trim();
    if (!normalizedName) continue;

    const block = fullBlock.trim();
    const existing = map.get(normalizedName);
    if (existing) {
      existing.fragments.push(block);
      existing.occurrences += 1;
      existing.content = existing.fragments.join('\n\n');
    } else {
      map.set(normalizedName, {
        name: normalizedName,
        content: block,
        occurrences: 1,
        fragments: [block],
      });
    }
  }

  return Array.from(map.values());
}
