import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'script.manifest.json'), 'utf8'));
const content = await readFile(path.join(root, 'dist/index.js'), 'utf8');
const thirdPartyNotices = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
const output = { ...manifest, content };

await writeFile(path.join(root, '酒馆助手脚本-npc生成器.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
await writeFile(path.join(root, 'dist/index.js.LICENSE.txt'), thirdPartyNotices, 'utf8');
console.info('已生成 酒馆助手脚本-npc生成器.json');
