import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import tarStream from 'tar-stream';
import decompress from '../../scripts/safe-decompress.mjs';

function makeTar(entries) {
  return new Promise((resolve, reject) => {
    const pack = tarStream.pack();
    const chunks = [];
    pack.on('data', (chunk) => chunks.push(chunk));
    pack.on('error', reject);
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    for (const entry of entries) {
      if (entry.type === 'symlink') {
        pack.entry({ name: entry.name, type: 'symlink', linkname: entry.linkname });
      } else {
        pack.entry({ name: entry.name }, entry.data ?? Buffer.alloc(0));
      }
    }
    pack.finalize();
  });
}

test('safe-decompress extracts a gzipped tar and applies strip', async () => {
  const tar = await makeTar([
    { name: 'pack/data/a.txt', data: Buffer.from('hello') },
    { name: 'pack/data/b.txt', data: Buffer.from('world') },
  ]);
  const files = await decompress(gzipSync(tar), { strip: 1 });
  assert.deepEqual(
    files.map(f => f.path).sort(),
    ['data/a.txt', 'data/b.txt'],
  );
  assert.equal(files.find(f => f.path === 'data/a.txt').data.toString(), 'hello');
  assert.equal(files.find(f => f.path === 'data/a.txt').type, 'file');
});

test('safe-decompress accepts a plain (non-gzipped) tar', async () => {
  const tar = await makeTar([{ name: 'a.txt', data: Buffer.from('plain') }]);
  const files = await decompress(tar);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'a.txt');
  assert.equal(files[0].data.toString(), 'plain');
});

test('safe-decompress rejects path traversal entries', async () => {
  const tar = await makeTar([{ name: '../evil.txt', data: Buffer.from('bad') }]);
  await assert.rejects(() => decompress(gzipSync(tar)), /unsafe archive entry path/);
});

test('safe-decompress rejects absolute paths', async () => {
  const tar = await makeTar([{ name: '/etc/passwd', data: Buffer.from('bad') }]);
  await assert.rejects(() => decompress(gzipSync(tar)), /unsafe archive entry path/);
});

test('safe-decompress skips symlinks and only returns regular files', async () => {
  const tar = await makeTar([
    { name: 'real.txt', data: Buffer.from('ok') },
    { name: 'link.txt', type: 'symlink', linkname: 'real.txt' },
  ]);
  const files = await decompress(gzipSync(tar));
  assert.deepEqual(files.map(f => f.path), ['real.txt']);
});
