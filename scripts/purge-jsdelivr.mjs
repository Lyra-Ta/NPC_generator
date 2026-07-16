const repository = process.env.GITHUB_REPOSITORY;
const ref = process.env.JSDELIVR_REF ?? 'main';

if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error('GITHUB_REPOSITORY 必须是 owner/repository 格式');
}

const releasePaths = [
  'dist/index.js',
  'dist/index.js.LICENSE.txt',
  '酒馆助手脚本-npc生成器.json',
  '-角色生成器v1.4-.json',
];

async function purge(pathname) {
  const url = new URL(`https://purge.jsdelivr.net/gh/${repository}@${ref}/${pathname}`);
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': `${repository} GitHub Actions` },
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.text();

      if (response.ok) {
        console.info(`已刷新 ${url.href}`);
        return;
      }

      lastError = new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 4_000));
  }

  throw new Error(`刷新 ${url.href} 失败`, { cause: lastError });
}

for (const pathname of releasePaths) await purge(pathname);
