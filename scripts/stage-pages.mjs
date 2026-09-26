import { copyFile, mkdir, stat } from 'node:fs/promises';

const output = new URL('../apps/web/dist/', import.meta.url);
const index = new URL('index.html', output);
await stat(index);
await stat(new URL('spatial-review.html', output));
await stat(new URL('.well-known/spatial-review.json', output));
await stat(new URL('brain/graph.bin', output));

for (const route of ['brain', 'setup', 'playback', 'lifecycle', 'fields']) {
  const target = new URL(`lab/${route}/`, output);
  await mkdir(target, { recursive: true });
  await copyFile(index, new URL('index.html', target));
}
