# NPC Generator / 角色信息归档

这是从 `tavern_helper_template-main` 独立出来的项目。模板仓库只保留指导与参考；NPC
Generator 的源码、构建配置、测试和发布文件都在这里维护。

## 获取发布文件

- [酒馆助手脚本（可直接导入）](https://cdn.jsdelivr.net/gh/Lyra-Ta/NPC_generator@main/%E9%85%92%E9%A6%86%E5%8A%A9%E6%89%8B%E8%84%9A%E6%9C%AC-npc%E7%94%9F%E6%88%90%E5%99%A8.json)
- [角色生成器世界书 v1.4](https://cdn.jsdelivr.net/gh/Lyra-Ta/NPC_generator@main/-%E8%A7%92%E8%89%B2%E7%94%9F%E6%88%90%E5%99%A8v1.4-.json)
- [单文件 bundle](https://cdn.jsdelivr.net/gh/Lyra-Ta/NPC_generator@main/dist/index.js)

这些链接跟随 `main` 分支，适合获取当前版。需要固定版本时应改用 Git tag 或 commit SHA。

## 文件层次

- `-角色生成器v1.4-.json`：NPC 生成协议世界书。
- `src/`：可维护的 TypeScript / Vue 源码。
- `dist/index.js`：webpack 生成的单文件脚本，不要手改。
- `酒馆助手脚本-npc生成器.json`：供酒馆助手导入的发布外壳，由构建脚本自动写入 `dist/index.js`。
- 本地 `archive/`：修复前发布包及旧 bundle，仅供追溯；它被排除在 GitHub 默认分支之外。

## 运行逻辑

```text
生成器世界书提示模型输出 <角色名_info>
                  ↓
parser.ts 从指定聊天楼层提取角色档案
                  ↓
App.vue / store.ts 展示、选择世界书
                  ↓
worldbook.ts 新建，或先比较再确认覆盖
```

脚本允许从任意消息角色（user / assistant / system）的楼层归档；这是有意保留的行为。

标签名采用宽松匹配：除尖括号和换行外，空格、下划线、横线、`¥`、`$` 等字符都可使用，例如
`<A B_info>...</A B_info>`。开闭标签中的原始名称仍须完全一致。解析器使用兼容旧 Android WebView 的 `RegExp.exec`
循环，不依赖 `String.matchAll` 或 Unicode 正则标志，并容忍 `_info` 与 `>` 之间的多余空白。

同名档案已存在时不会直接写入：脚本会实时读取旧条目，展示“旧内容 / 新内容”，确认后只替换正文与审计时间。UID、灯型、关键词、位置、概率、递归和其他手工字段都会保留；若对比期间旧内容又被修改，本次覆盖会安全中止。

## A / B 模式

- a版常驻800tk，直接在正文中生成完整档案
- b版常驻400tk，正文中只生成短档案（只包含4条基础性格和九型人格）；在遇到想要的保留的角色时，使用“生成角色档案”激活绿灯条目，单独生成更完整的角色信息，完成归档后可以直接删除本楼层

脚本只显示以上说明，不自动安装、查找或切换角色生成器世界书；请在世界书界面自行启用对应版本。

“档案保存到”会在切换聊天时清空，下次打开优先取当前角色有效的 primary 世界书；没有可靠 primary时保持未选择，必须手动指定，不会静默落到世界书列表第一项。

## 开发

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

`pnpm build` 会依次类型检查、生成 `dist/index.js`，并刷新 `酒馆助手脚本-npc生成器.json`。

## GitHub Actions / jsDelivr

推送到 `main` 后，`purge-jsdelivr.yml` 会重新安装锁定依赖、运行测试、构建发布文件，并确认提交的
`dist/index.js`、许可声明和酒馆助手 JSON 与源码一致。全部通过后才请求刷新对应的 jsDelivr `main`
分支缓存。也可以从 GitHub Actions 页面手动运行该 workflow。

项目自身暂未另行声明开源许可证；第三方组件的授权与版权声明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 2026-07 Pinia 崩溃说明

旧 bundle 将 Pinia 外置到未锁版本的 `https://testingcf.jsdelivr.net/npm/pinia/+esm`。该地址后来解析到 Pinia
4，运行时读取未定义的 `__VUE_PROD_DEVTOOLS__`，导致脚本加载即崩溃。

独立项目会把锁定的 Pinia 3.0.4 本地打入 bundle，只把宿主已经提供的 Vue 设为 external；因此不再依赖该浮动 CDN 模块。
