// safe-decompress.mjs — build-time replacement for the `decompress` npm package.
//
// Spyglass core's NodeJsExternals calls `decompress(buffer, { strip })` to turn upstream
// vanilla tarballs into an in-memory file list. The real `decompress@4.2.1` has known
// zip-slip / arbitrary-file-write advisories (GHSA-mp2f-45pm-3cg9 etc.), and it is bundled
// into the published dist. This replacement keeps the same call shape but:
//   - never writes to disk (in-memory only),
//   - rejects absolute paths, drive letters, and `..` traversal,
//   - ignores symlinks/hardlinks/devices and only returns regular files,
//   - caps total extracted bytes.
//
// It is only used by scripts/build-bundle.mjs (esbuild aliases `decompress` to this file),
// so it is not part of the published source map surface.
import { Readable } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import { extract } from 'tar-stream';

const MAX_TOTAL_BYTES = 512 * 1024 * 1024; // 512 MiB, same spirit as src/zip-datapack.ts

function isUnsafeSegment(seg) {
  return seg === '..' || /^[a-zA-Z]:/.test(seg);
}

/** Normalize a tar entry name, apply `strip`, and reject unsafe paths. Returns null for
 * entries that should be skipped (e.g. the root after stripping all segments). */
function safeEntryPath(name, strip) {
  const raw = name.replace(/\\/g, '/');
  // Absolute paths and Windows drive paths are never acceptable.
  if (raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) {
    throw new Error(`unsafe archive entry path: ${name}`);
  }
  const segments = raw.split('/').filter(seg => seg && seg !== '.');
  if (segments.some(isUnsafeSegment)) {
    throw new Error(`unsafe archive entry path: ${name}`);
  }
  const stripped = strip > 0 ? segments.slice(strip) : segments;
  if (stripped.length === 0) return null;
  const out = stripped.join('/');
  if (!out || out.startsWith('/') || /^[a-zA-Z]:/.test(out)) {
    throw new Error(`unsafe archive entry path: ${name}`);
  }
  return out;
}

/**
 * Drop-in for `decompress(buffer, { strip })`.
 * @param {Uint8Array|Buffer} input
 * @param {{ strip?: number }} [options]
 * @returns {Promise<Array<{ path: string, data: Buffer }>>}
 */
export default function decompress(input, options = {}) {
  return new Promise((resolve, reject) => {
    const strip = Number.isInteger(options.strip) && options.strip > 0 ? options.strip : 0;
    const files = [];
    let total = 0;
    let done = false;

    const fail = (err) => {
      if (done) return;
      done = true;
      extractor.destroy(err);
      reject(err);
    };

    const extractor = extract();
    extractor.on('entry', (header, stream, next) => {
      if (done) {
        stream.resume();
        return next();
      }
      // Always consume/destroy entry streams safely; an unhandled stream error would otherwise
      // escape after the promise settles.
      stream.on('error', (err) => extractor.destroy(err));
      // Only regular files are useful to the engine. Skip symlinks, hardlinks, devices,
      // directories and tar meta entries without following/creating anything unsafe.
      if (header.type !== 'file' && header.type !== 'contiguous-file') {
        stream.resume();
        return next();
      }
      let path;
      try {
        path = safeEntryPath(header.name, strip);
      } catch (err) {
        stream.resume();
        extractor.destroy(err);
        return;
      }
      if (path === null) {
        stream.resume();
        return next();
      }
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        if (done) return next();
        const data = Buffer.concat(chunks);
        total += data.length;
        if (total > MAX_TOTAL_BYTES) {
          extractor.destroy(new Error(`archive expands beyond ${MAX_TOTAL_BYTES / 1024 / 1024} MiB`));
          return;
        }
        // `type: 'file'` is required by Spyglass core's FileService: it treats any entry whose
        // `type` is not `'file'` as a directory and refuses to read it.
        files.push({ path, data, type: 'file' });
        next();
      });
    });
    extractor.on('error', (err) => {
      if (!done) {
        done = true;
        reject(err);
      }
    });
    extractor.on('finish', () => {
      if (!done) {
        done = true;
        resolve(files);
      }
    });

    try {
      const buf = input instanceof Uint8Array
        ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
        : Buffer.from(input);
      // The engine's tarballs are gzip-compressed; plain tar is also accepted.
      const tarData = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b
        ? gunzipSync(buf)
        : buf;
      const source = Readable.from(tarData);
      source.on('error', (err) => {
        if (!done) {
          done = true;
          reject(err);
        }
      });
      source.pipe(extractor);
    } catch (err) {
      fail(err);
    }
  });
}
