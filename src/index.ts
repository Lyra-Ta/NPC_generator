/*
 * 角色信息归档（NPC Generator 配套脚本）
 * 作者：Lyra芜歌
 */

import { createPinia } from 'pinia';
import { createApp, watch } from 'vue';
import './tailwind.css';
import App from './App.vue';
import { useArchiveStore } from './store';
import { createScriptIdIframe, teleportStyle } from './util/iframe';

const ARCHIVER_WATERMARK = [
  '角色信息归档 — 发布于 Discord 社区',
  '作者: Lyra芜歌, 请搭配 NPC Generator 世界书使用',
  'https://discord.com/channels/1134557553011998840/1494050594653212723',
].join('\n');

const BUTTON_NAME = '角色信息归档';

function init() {
  console.info(`%c[角色信息归档]%c\n${ARCHIVER_WATERMARK}`, 'font-weight:bold;color:#5C6E4D', '');
  appendInexistentScriptButtons([{ name: BUTTON_NAME, visible: true }]);

  const pinia = createPinia();
  const app = createApp(App).use(pinia);
  const store = useArchiveStore(pinia);
  let mounted = false;

  const $iframe = createScriptIdIframe()
    .css({
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      border: 'none',
      'z-index': 9999,
      display: 'none',
      'pointer-events': 'auto',
    })
    .on('load', () => {
      const document = $iframe[0].contentDocument;
      if (!document) throw new Error('角色信息归档 iframe 初始化失败');
      teleportStyle(document.head);
      app.mount(document.body);
      mounted = true;
    })
    .appendTo('body');

  watch(
    () => store.panelVisible,
    visible => $iframe.css('display', visible ? 'block' : 'none'),
  );

  eventOn(getButtonEvent(BUTTON_NAME), () => {
    void store.openWithLatest().catch(error => {
      console.error('[role-info-archive] 打开面板失败', error);
      toastr.error(error instanceof Error ? error.message : String(error));
    });
  });

  // 手选目标在同一聊天内保留；切换聊天/角色后清空，下次打开重新取新角色的 primary 世界书。
  eventOn(tavern_events.CHAT_CHANGED, () => store.handleChatChanged());

  $(window).on('pagehide', () => {
    updateScriptButtonsWith(buttons => buttons.filter(button => button.name !== BUTTON_NAME));
    if (mounted) app.unmount();
    $iframe.remove();
  });
}

$(() => errorCatched(init)());
