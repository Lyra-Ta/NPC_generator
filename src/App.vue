<template>
  <!-- 全屏遮罩 + 居中卡片; 通过 :style 注入主题变量 -->
  <div
    v-if="store.panelVisible"
    class="archive-root fixed inset-0 flex items-center justify-center z-50 p-3 sm:p-4"
    :style="store.themeVars as any"
    @click.self="store.close()"
  >
    <div
      class="archive-card flex flex-col overflow-hidden rounded-xl w-full sm:w-[min(95vw,560px)] max-h-[90vh] sm:max-h-[85vh]"
    >
      <!-- 顶栏: 标题 + 快捷按钮 + 主题切换 + 关闭 -->
      <header class="archive-header flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3">
        <h2 class="font-medium text-[15px] truncate shrink">角色信息归档</h2>

        <!-- "生成角色档案"快捷按钮: 点击后填入酒馆输入框 -->
        <button
          class="archive-shortcut-btn flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-[12px] transition"
          @click="triggerGeneratePrompt"
          :title="`把'${GENERATE_PROMPT}'填入酒馆输入框, 然后按回车发送`"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 2L4.09 12.97 11 13l0 9 8.91-10.97L13 11z" />
          </svg>
          <span class="hidden sm:inline">生成角色档案</span>
        </button>

        <!-- 三/四色主题切换器 -->
        <div class="flex items-center gap-1.5 ml-auto mr-1">
          <button
            v-for="t in themes"
            :key="t.id"
            class="archive-swatch w-5 h-5 rounded-full border-2 transition"
            :class="store.themeId === t.id ? 'archive-swatch--active' : ''"
            :style="{ background: t.swatch }"
            :title="t.name"
            :aria-label="`切换到 ${t.name} 配色`"
            @click="store.setTheme(t.id)"
          />
        </div>

        <button class="archive-icon-btn p-1 rounded transition" @click="store.close()" aria-label="关闭">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <!-- 楼层导航条 -->
      <div class="archive-toolbar flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-[13px]">
        <button class="archive-btn px-2 py-1 rounded" :disabled="store.messageId <= 0" @click="store.gotoPrev()">
          ← <span class="hidden sm:inline">上一楼</span>
        </button>
        <input
          type="number"
          class="archive-input w-14 sm:w-16 px-2 py-1 rounded text-center"
          :value="store.messageId"
          :min="0"
          :max="store.lastMessageId"
          @change="onFloorInput"
          @keydown.enter="onFloorInput"
        />
        <span class="archive-text-muted text-xs whitespace-nowrap">/ {{ store.lastMessageId }}</span>
        <button
          class="archive-btn px-2 py-1 rounded"
          :disabled="store.messageId >= store.lastMessageId"
          @click="store.gotoNext()"
        >
          <span class="hidden sm:inline">下一楼</span> →
        </button>
        <button class="archive-btn ml-auto px-2 py-1 rounded" @click="store.gotoLatest()">最新楼层</button>
      </div>

      <!-- 这里只解释 a/b 的区别，不自动安装、查找或修改世界书。 -->
      <details class="archive-protocol border-b px-3 py-1.5 text-[13px] sm:px-4">
        <summary class="archive-protocol-summary flex min-h-[40px] cursor-pointer items-center gap-2">
          <span class="font-medium">a/b版本说明</span>
          <span class="archive-text-muted ml-auto text-[12px]">展开查看</span>
        </summary>

        <div class="archive-text-muted space-y-2 pb-3 text-[12px] leading-relaxed">
          <p><strong>a版</strong>常驻800tk，直接在正文中生成完整档案</p>
          <p>
            <strong>b版</strong
            >常驻400tk，正文中只生成短档案（只包含4条基础性格和九型人格）；在遇到想要的保留的角色时，使用“生成角色档案”激活绿灯条目，单独生成更完整的角色信息，完成归档后可以直接删除本楼层
          </p>
          <p class="archive-protocol-note rounded px-2.5 py-2">
            请在“角色生成器”世界书中自行启用对应版本；本脚本不会安装或切换世界书。
          </p>
        </div>
      </details>

      <!-- 主区域 -->
      <main class="archive-main min-h-0 flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4">
        <!-- 列表视图 -->
        <template v-if="store.view === 'list'">
          <p v-if="store.characters.length === 0" class="archive-text-muted text-sm py-8 text-center">
            该楼层未发现 &lt;name_info&gt; 标签
          </p>
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              v-for="char in store.characters"
              :key="char.name"
              class="archive-char-btn px-3 py-3 rounded-lg text-left flex items-center gap-2 transition min-h-[56px]"
              @click="store.openDetail(char)"
            >
              <span
                class="archive-lamp"
                :class="`archive-lamp--${store.getLampColor(char.name)}`"
                :title="lampTooltip(store.getLampColor(char.name))"
                aria-hidden="true"
              />
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate text-sm">{{ char.name }}</div>
                <div v-if="char.occurrences > 1" class="text-[11px] archive-text-muted mt-0.5">
                  ×{{ char.occurrences }}
                </div>
              </div>
              <span
                v-if="store.isArchived(char.name)"
                class="archive-badge text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
              >
                已存档
              </span>
            </button>
          </div>
        </template>

        <!-- 详情视图 -->
        <template v-else-if="store.view === 'detail' && store.activeCharacter">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <button class="archive-btn-text text-[13px]" @click="store.backToList()">← 返回列表</button>
            <span
              class="archive-lamp"
              :class="`archive-lamp--${store.getLampColor(store.activeCharacter.name)}`"
              :title="lampTooltip(store.getLampColor(store.activeCharacter.name))"
              aria-hidden="true"
            />
            <span class="font-medium text-sm">{{ store.activeCharacter.name }}</span>
            <span
              v-if="store.isArchived(store.activeCharacter.name)"
              class="archive-badge text-[10px] px-1.5 py-0.5 rounded-full"
            >
              已存档
            </span>
            <span v-if="store.activeCharacter.occurrences > 1" class="archive-text-muted text-[11px]">
              (本楼出现 {{ store.activeCharacter.occurrences }} 次, 已合并)
            </span>
          </div>

          <pre class="archive-content whitespace-pre-wrap text-[13px] rounded p-3 max-h-[40vh] overflow-y-auto">{{
            store.activeCharacter.content
          }}</pre>

          <!-- 目标世界书选择 -->
          <div class="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            <label class="archive-text-muted shrink-0">保存到</label>
            <select
              :value="store.targetWorldbook ?? ''"
              class="archive-input flex-1 min-w-0 px-2 py-1 rounded"
              :disabled="store.saving || store.preparingOverwrite"
              @change="store.targetWorldbook = ($event.target as HTMLSelectElement).value || null"
            >
              <option v-if="!store.availableWorldbooks.length" value="" disabled>没有可用世界书</option>
              <option v-for="wb in store.availableWorldbooks" :key="wb" :value="wb">{{ wb }}</option>
            </select>
            <button
              class="archive-btn px-2 py-1 rounded"
              :disabled="store.saving || store.preparingOverwrite"
              @click="refreshWorldbooks"
              title="刷新世界书列表"
            >
              ⟳
            </button>
          </div>

          <!-- 灯型选择 + 保存按钮 -->
          <div
            v-if="!store.isArchived(store.activeCharacter.name)"
            class="mt-3 flex flex-wrap items-center gap-2 text-[13px]"
          >
            <label class="archive-text-muted shrink-0">激活方式</label>
            <div class="archive-segment inline-flex rounded overflow-hidden">
              <button
                class="archive-seg-btn px-2.5 py-1 text-[12px] flex items-center gap-1.5"
                :class="store.nextSaveStrategy === 'selective' ? 'archive-seg-btn--active' : ''"
                @click="store.nextSaveStrategy = 'selective'"
              >
                <span class="archive-lamp archive-lamp--green" aria-hidden="true" />
                绿灯
              </button>
              <button
                class="archive-seg-btn px-2.5 py-1 text-[12px] flex items-center gap-1.5"
                :class="store.nextSaveStrategy === 'constant' ? 'archive-seg-btn--active' : ''"
                @click="store.nextSaveStrategy = 'constant'"
              >
                <span class="archive-lamp archive-lamp--blue" aria-hidden="true" />
                蓝灯
              </button>
            </div>
            <span class="archive-text-muted text-[11px]">
              {{ store.nextSaveStrategy === 'constant' ? '常驻激活' : '按关键词触发' }}
            </span>
          </div>

          <p v-else class="archive-text-muted mt-3 text-[11px] leading-relaxed">
            覆盖只会替换档案正文与更新时间；现有灯型、关键词、位置、概率等设置都会保留。
          </p>

          <div class="mt-4 flex justify-end gap-2">
            <button
              class="archive-btn-primary px-4 py-2 rounded font-medium text-sm transition"
              :disabled="!store.targetWorldbook || store.saving || store.preparingOverwrite"
              @click="store.saveActive()"
            >
              <template v-if="store.saving">保存中…</template>
              <template v-else-if="store.preparingOverwrite">正在读取旧档案…</template>
              <template v-else-if="store.isArchived(store.activeCharacter.name)"> 对比并选择是否覆盖… </template>
              <template v-else> 保存为{{ store.nextSaveStrategy === 'constant' ? '蓝灯' : '绿灯' }}条目 </template>
            </button>
          </div>
        </template>
      </main>
    </div>

    <!-- 已有档案：先冻结新旧内容并展示，确认后才按 uid 覆盖正文。 -->
    <div
      v-if="store.overwriteProposal"
      class="fixed inset-0 flex items-center justify-center z-[60] p-3"
      :style="{ background: 'var(--archive-overlay)' }"
      @click.self="cancelOverwrite"
    >
      <div class="archive-card flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg">
        <header class="archive-header px-4 py-3 sm:px-5">
          <h3 class="text-base font-medium">对比后覆盖档案</h3>
          <p class="archive-text-muted mt-1 text-[12px] leading-relaxed">
            世界书 <code class="archive-code rounded px-1">{{ store.overwriteProposal.worldbookName }}</code> · 条目
            <code class="archive-code rounded px-1">{{ store.overwriteProposal.entryName }}</code>
          </p>
        </header>

        <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
          <section class="flex min-h-0 flex-col">
            <div class="archive-text-muted mb-1.5 text-[12px] font-medium">当前已存档内容</div>
            <pre class="archive-compare-content archive-compare-old">{{ store.overwriteProposal.oldContent }}</pre>
          </section>
          <section class="flex min-h-0 flex-col">
            <div class="archive-text-muted mb-1.5 text-[12px] font-medium">本次准备写入内容</div>
            <pre class="archive-compare-content archive-compare-new">{{ store.overwriteProposal.newContent }}</pre>
          </section>
        </div>

        <div class="archive-header flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
          <span class="archive-text-muted text-[11px]">
            {{
              store.overwriteProposal.oldContent === store.overwriteProposal.newContent
                ? '两边内容完全相同，无需覆盖'
                : '仅替换正文；灯型和其他世界书设置保持不变'
            }}
          </span>
          <div class="ml-auto flex gap-2">
            <button class="archive-btn rounded px-4 py-1.5" :disabled="store.saving" @click="cancelOverwrite">
              保留旧档案
            </button>
            <button
              class="archive-btn-primary rounded px-4 py-1.5 font-medium"
              :disabled="store.saving || store.overwriteProposal.oldContent === store.overwriteProposal.newContent"
              @click="store.confirmOverwrite()"
            >
              {{ store.saving ? '覆盖中…' : '确认覆盖' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useArchiveStore, type LampColor } from './store';
import { themes } from './themes';

/** 快捷按钮点击后填入输入框的文本; 想改成别的提示词就改这里 */
const GENERATE_PROMPT = '生成角色档案';

const store = useArchiveStore();

function onFloorInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (!Number.isNaN(v)) store.loadMessage(v);
}

/**
 * 把 GENERATE_PROMPT 填进酒馆输入框 (#send_textarea), 触发 input 事件让酒馆响应,
 * 然后关闭面板并把焦点交给输入框, 用户直接按回车就能发送.
 */
function triggerGeneratePrompt() {
  // $ 是 window.parent.$, 所以选的是酒馆主页面的输入框
  const $input = $('#send_textarea');
  if (!$input.length) {
    toastr.error('未找到酒馆输入框 (#send_textarea)');
    return;
  }
  $input.val(GENERATE_PROMPT).trigger('input').trigger('change').focus();
  store.close();
  toastr.success(`已填入 "${GENERATE_PROMPT}", 按回车发送`);
}

function cancelOverwrite() {
  if (!store.saving) store.clearOverwriteProposal();
}

async function refreshWorldbooks() {
  try {
    await store.refreshWorldbookState();
  } catch (error) {
    console.error(error);
    toastr.error(error instanceof Error ? error.message : String(error));
  }
}

function lampTooltip(color: LampColor): string {
  switch (color) {
    case 'green':
      return '已存档 · 绿灯 (按关键词触发)';
    case 'blue':
      return '已存档 · 蓝灯 (常驻激活)';
    case 'purple':
      return '已存档 · 向量灯';
    default:
      return '未存档';
  }
}
</script>

<style scoped>
.archive-root {
  background: var(--archive-overlay);
  color: var(--archive-text);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}
.archive-card {
  background: var(--archive-card);
  border: 1px solid var(--archive-border);
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.25);
  color: var(--archive-text);
}
.archive-header {
  border-bottom: 1px solid var(--archive-border);
}
.archive-toolbar {
  border-bottom: 1px solid var(--archive-border);
  background: var(--archive-row);
}
.archive-protocol {
  border-color: var(--archive-border);
  background: var(--archive-card);
}
.archive-protocol-summary {
  list-style: none;
}
.archive-protocol-summary::-webkit-details-marker {
  display: none;
}
.archive-protocol-note {
  background: var(--archive-row);
  border: 1px solid var(--archive-border);
}
.archive-text-muted {
  color: var(--archive-text-muted);
}
.archive-input {
  background: var(--archive-card);
  border: 1px solid var(--archive-border);
  color: var(--archive-text);
}
.archive-input:focus {
  outline: 2px solid var(--archive-accent);
  outline-offset: -1px;
}
.archive-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.archive-btn {
  background: var(--archive-card);
  border: 1px solid var(--archive-border);
  color: var(--archive-text);
}
.archive-btn:hover:not(:disabled) {
  background: var(--archive-row-hover);
}
.archive-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.archive-btn-text {
  color: var(--archive-text-muted);
  background: transparent;
  border: none;
  padding: 2px 6px;
}
.archive-btn-text:hover {
  color: var(--archive-text);
}
.archive-icon-btn {
  color: var(--archive-text-muted);
  background: transparent;
  border: none;
}
.archive-icon-btn:hover {
  background: var(--archive-row-hover);
  color: var(--archive-text);
}
.archive-char-btn {
  background: var(--archive-row);
  border: 1px solid var(--archive-border);
  color: var(--archive-text);
}
.archive-char-btn:hover {
  background: var(--archive-row-hover);
  border-color: var(--archive-accent);
}
.archive-badge {
  background: var(--archive-accent);
  color: var(--archive-accent-text);
  font-weight: 500;
  letter-spacing: 0.02em;
}
.archive-content {
  background: var(--archive-row);
  border: 1px solid var(--archive-border);
  color: var(--archive-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'PingFang SC', 'Microsoft YaHei', monospace;
}
.archive-btn-primary {
  background: var(--archive-accent);
  color: var(--archive-accent-text);
  border: 1px solid var(--archive-accent);
}
.archive-btn-primary:hover:not(:disabled) {
  background: var(--archive-accent-hover);
  border-color: var(--archive-accent-hover);
}
.archive-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.archive-code {
  background: var(--archive-row);
  color: var(--archive-text);
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}
.archive-swatch {
  border-color: transparent;
  cursor: pointer;
  padding: 0;
}
.archive-swatch:hover {
  transform: scale(1.1);
}
.archive-swatch--active {
  border-color: var(--archive-text);
  box-shadow: 0 0 0 2px var(--archive-card);
}

/* 灯泡指示器: 通用尺寸 + 4 种颜色 */
.archive-lamp {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}
.archive-lamp--gray {
  background: rgba(127, 127, 127, 0.32);
  border: 1px solid rgba(127, 127, 127, 0.18);
}
.archive-lamp--green {
  background: #51a862;
  box-shadow: 0 0 6px rgba(81, 168, 98, 0.55);
}
.archive-lamp--blue {
  background: #4d85c8;
  box-shadow: 0 0 6px rgba(77, 133, 200, 0.55);
}
.archive-lamp--purple {
  background: #8b5cb8;
  box-shadow: 0 0 6px rgba(139, 92, 184, 0.55);
}

/* 头部"生成角色档案"快捷按钮: 用强调色填充, 醒目又不抢戏 */
.archive-shortcut-btn {
  background: var(--archive-accent);
  color: var(--archive-accent-text);
  border: 1px solid var(--archive-accent);
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}
.archive-shortcut-btn:hover {
  background: var(--archive-accent-hover);
  border-color: var(--archive-accent-hover);
}

/* 灯型选择: 分段按钮 */
.archive-segment {
  border: 1px solid var(--archive-border);
  background: var(--archive-card);
}
.archive-seg-btn {
  background: transparent;
  border: none;
  color: var(--archive-text-muted);
  cursor: pointer;
  border-right: 1px solid var(--archive-border);
}
.archive-seg-btn:last-child {
  border-right: none;
}
.archive-seg-btn:hover {
  background: var(--archive-row-hover);
  color: var(--archive-text);
}
.archive-seg-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.archive-seg-btn--active {
  background: var(--archive-row);
  color: var(--archive-text);
  font-weight: 500;
}
.archive-compare-content {
  min-height: 160px;
  max-height: 34vh;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border: 1px solid var(--archive-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--archive-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'PingFang SC', 'Microsoft YaHei', monospace;
  font-size: 12px;
  line-height: 1.55;
}
.archive-compare-old {
  background: color-mix(in srgb, #b75d55 7%, var(--archive-row));
}
.archive-compare-new {
  background: color-mix(in srgb, #4f8a61 8%, var(--archive-row));
}

@media (max-width: 639px) {
  .archive-compare-content {
    max-height: none;
    overflow: visible;
  }
}

@media (min-width: 640px) {
  .archive-compare-content {
    min-height: 280px;
    max-height: 54vh;
  }
}
</style>
