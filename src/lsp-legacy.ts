// lsp-legacy.ts — the original stdio JSON-RPC driver over the Spyglass LSP server.
// Kept as the --engine=lsp fallback and as the parity reference for the in-process engine.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SERVER } from './paths.js';
import type { CompletionItemDTO, RawDiagnostic } from './types.js';
import type { CheckEngine, EngineCheckOptions, EngineCheckResult, EngineCompleteOptions } from './engine/types.js';

const KIND_NAMES: Record<number, string> = {
  1:'文本',2:'方法',3:'函数',4:'构造',5:'字段',6:'变量',7:'类',8:'接口',9:'模块',10:'属性',11:'单位',12:'值',13:'枚举',14:'关键字',15:'片段',16:'颜色',17:'文件',18:'引用',19:'文件夹',20:'枚举成员',21:'常量',22:'结构',23:'事件',24:'操作符',25:'类型参数',
};

export function completionItemsOf(res: unknown): CompletionItemDTO[] {
  return (Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? [])).map(it => {
    const item = it as { label?: string; kind?: number; detail?: string | null; documentation?: unknown };
    let documentation: string | null = null;
    if (item.documentation != null) {
      if (typeof item.documentation === 'object') {
        const v = (item.documentation as { value?: unknown })?.value;
        documentation = v == null ? '' : String(v);
      } else {
        documentation = String(item.documentation);
      }
    }
    return { label: item.label ?? '', kind: KIND_NAMES[item.kind ?? 0] ?? null, detail: item.detail ?? null, documentation };
  });
}

// Mirror @spyglassmc/core's normalizeUriPathname: lowercase Windows drive letters.
const normUri = (uri: string): string => uri.replace(/^file:\/\/\/[A-Z]:\//, m => m.toLowerCase());

interface PendingEntry { resolve: (v: unknown) => void; reject: (e: unknown) => void }

/**
 * A minimal JSON-RPC-over-stdio session to one Spyglass language server process.
 * Server log lines are collected (for version/error reporting) and echoed to `onLog`
 * with their [server]/[server-msg] prefix; callers decide whether to surface them.
 */
class LspSession {
  private child = spawn(process.execPath, [SERVER, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
  private buf = Buffer.alloc(0);
  private nextId = 1000; // client ids start high, server-initiated request ids start at 1
  private pending = new Map<number, PendingEntry>();
  private diagnostics = new Map<string, RawDiagnostic[]>(); // normUri -> array (last wins)
  private failed = new Set<string>(); // normUri -> server threw during check
  private opened = new Set<string>(); // normUri
  readonly serverLog: string[] = [];
  private readyFlag = false;
  private readyWaiters: (() => void)[] = [];
  private settleWaiters: (() => void)[] = [];
  private closed = false;

  /** Echo for server log lines, already prefixed ([server] / [server-msg]). */
  onLog: ((msg: string) => void) | null = null;

  constructor() {
    this.child.stdout.on('data', (d: Buffer) => this.#onData(d));
    this.child.stderr.on('data', (d: Buffer) => process.stderr.write(d));
    this.child.on('error', err => {
      this.#rejectAll(new Error(`failed to start Spyglass server: ${err.message}\n[check] is node_modules installed? (run: npm install)  server=${SERVER}`));
    });
    this.child.on('exit', (code, sig) => {
      if (!this.closed) {
        this.onLog?.(`[check] server exited early code=${code} sig=${sig}`);
        if (!this.readyFlag) this.#rejectAll(new Error(`server exited early code=${code} sig=${sig}`));
      }
    });
  }

  send(obj: unknown): void {
    const body = JSON.stringify(obj);
    this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.nextId;
    this.send({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  notify(method: string, params: unknown): void { this.send({ jsonrpc: '2.0', method, params }); }

  #onData(d: Buffer): void {
    this.buf = Buffer.concat([this.buf, d]);
    let headerEnd;
    while ((headerEnd = this.buf.indexOf('\r\n\r\n')) !== -1) {
      const header = this.buf.slice(0, headerEnd).toString('utf8');
      const m = /Content-Length: (\d+)/i.exec(header);
      if (!m) { this.buf = this.buf.slice(headerEnd + 4); continue; }
      const len = +m[1], total = headerEnd + 4;
      if (this.buf.length < total + len) break;
      const body = this.buf.slice(total, total + len).toString('utf8');
      this.buf = this.buf.slice(total + len);
      this.#handleMessage(JSON.parse(body));
    }
  }

  #handleMessage(msg: { id?: unknown; method?: string; error?: unknown; result?: unknown; params?: any }): void {
    if (msg.id !== undefined && msg.id !== null) {
      const entry = this.pending.get(msg.id as number);
      if (entry) {
        this.pending.delete(msg.id as number);
        if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
        else entry.resolve(msg.result);
        return;
      }
      // server-initiated request — respond with null
      if (msg.method === 'workspace/configuration' || msg.method === 'workspace/workspaceFolders'
          || msg.method === 'client/registerCapability' || msg.method === 'client/unregisterCapability'
          || msg.method === 'window/workDoneProgress/create') {
        this.send({ jsonrpc: '2.0', id: msg.id, result: null });
      } else {
        console.error(`[check] unhandled server request: ${msg.method}`);
        this.send({ jsonrpc: '2.0', id: msg.id, result: null });
      }
      return;
    }
    switch (msg.method) {
      case 'textDocument/publishDiagnostics': {
        const uri = normUri(msg.params.uri);
        if (!this.opened.has(uri)) return; // ignore diagnostics for non-client-managed files
        this.diagnostics.set(uri, msg.params.diagnostics ?? []);
        this.#checkSettled();
        break;
      }
      case 'window/logMessage': {
        this.serverLog.push(msg.params.message);
        const m = msg.params.message.match(/\[Project\] \[check\] Failed for (file:\/\/\S+)/);
        if (m) {
          this.failed.add(normUri(m[1]));
          this.#checkSettled();
        }
        this.onLog?.(`[server] ${msg.params.message}`);
        break;
      }
      case 'window/showMessage':
        this.onLog?.(`[server-msg] ${msg.params.message}`);
        break;
      case '$/progress': {
        if (msg.params.token === 'initialize' && msg.params.value?.kind === 'end') {
          this.readyFlag = true;
          for (const w of this.readyWaiters.splice(0)) w();
        }
        break;
      }
    }
  }

  #checkSettled(): void {
    if (this.opened.size > 0 && this.diagnostics.size + this.failed.size >= this.opened.size) {
      for (const w of this.settleWaiters.splice(0)) w();
    }
  }

  /** Resolves once the project reports ready (initialize progress ended). */
  waitReady(timeoutMs: number): Promise<void> {
    if (this.readyFlag) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.readyWaiters.push(resolve);
      setTimeout(() => reject(new Error(`project never became ready within ${timeoutMs}ms. Server log:\n${this.serverLog.join('\n')}`)), timeoutMs);
    });
  }

  /** Resolves once every opened file has emitted diagnostics or been marked failed. */
  waitSettled(timeoutMs: number): Promise<void> {
    if (this.opened.size > 0 && this.diagnostics.size + this.failed.size >= this.opened.size) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.settleWaiters.push(resolve);
      setTimeout(() => reject(new Error(`timed out waiting for diagnostics (received ${this.diagnostics.size}/${this.opened.size}). Server log:\n${this.serverLog.join('\n')}`)), timeoutMs);
    });
  }

  /** Wait until a specific URI has diagnostics (for the --complete flow). */
  waitForDiagnostics(uri: string, timeoutMs: number): Promise<void> {
    if (this.diagnostics.has(uri)) return Promise.resolve();
    return new Promise((resolve) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (this.diagnostics.has(uri) || Date.now() - t0 > timeoutMs) { clearInterval(iv); resolve(); }
      }, 100);
    });
  }

  markOpened(uri: string): void { this.opened.add(uri); }

  getDiagnostics(uri: string): RawDiagnostic[] | undefined { return this.diagnostics.get(uri); }

  isFailed(uri: string): boolean { return this.failed.has(uri); }

  #rejectAll(e: Error): void {
    for (const entry of this.pending.values()) entry.reject(e);
    this.pending.clear();
    for (const w of this.settleWaiters.splice(0)) w(); // don't hang the settle wait on a dead server
  }

  close(): void {
    this.closed = true;
    this.child.kill();
  }
}

// Matches the original's `log()` filter: server lines only surface when verbose or alarming.
const SERVER_LOG_FILTER = /Error|error|resolveConfiguredVersion|check] Failed|Cannot create|does not exist|expected|unknown/i;

export function createLspEngine(): CheckEngine {
  async function boot(opts: { version: string; datapack: string; verbose: boolean; onLog?: (msg: string) => void }): Promise<LspSession> {
    const session = new LspSession();
    session.onLog = (msg) => {
      if (opts.verbose || SERVER_LOG_FILTER.test(msg)) opts.onLog?.(msg);
    };
    const initResult = await session.request('initialize', {
      processId: null,
      rootUri: pathToFileURL(opts.datapack).href,
      workspaceFolders: [{ uri: pathToFileURL(opts.datapack).href, name: 'datapack' }],
      capabilities: { window: { workDoneProgress: true }, textDocument: {}, workspace: { workspaceFolders: true, didChangeConfiguration: { dynamicRegistration: true }, didChangeWatchedFiles: { dynamicRegistration: true } } },
      initializationOptions: { defaultConfig: { env: { gameVersion: opts.version } } },
      locale: 'en',
    }) as { serverInfo?: { name?: string; version?: string } } | undefined;
    opts.onLog?.(`[check] server: ${initResult?.serverInfo?.name ?? '?'} ${initResult?.serverInfo?.version ?? ''}`.trim());
    session.notify('initialized', {});
    await session.waitReady(180000);
    return session;
  }

  function resolveVersion(session: LspSession): string | null {
    for (const l of session.serverLog) {
      const m = l.match(/selecting version (\S+)/);
      if (m) return m[1];
    }
    return null;
  }

  const engine: CheckEngine = {
    async check(opts: EngineCheckOptions): Promise<EngineCheckResult> {
      const { datapack, version, files, rels, mode, verbose, onLog } = opts;
      const uriToRel = new Map<string, string>();
      for (let i = 0; i < files.length; i++) uriToRel.set(normUri(pathToFileURL(files[i]).href), rels[i]);

      const session = await boot({ version, datapack, verbose: verbose ?? false, onLog });
      try {
        for (const f of files) {
          const uri = normUri(pathToFileURL(f).href);
          session.markOpened(uri);
          if (mode !== 'analyze') {
            const languageId = f.endsWith('.mcfunction') ? 'mcfunction' : 'json';
            session.notify('textDocument/didOpen', { textDocument: { uri, languageId, version: 1, text: readFileSync(f, 'utf8') } });
          }
        }
        if (mode === 'analyze') {
          const dummyToken = { isCancellationRequested: false, onCancellationRequested: () => {} };
          session.request('spyglassmc/analyzeProject', dummyToken).catch(() => {});
        } else {
          // didOpen alone parses/binds/checks but never emits documentUpdated → the server only
          // pushes publishDiagnostics when a client request touches ensureClientManagedChecked().
          // Fire one lightweight request per file (documentSymbol) to force the diagnostics out.
          for (const uri of uriToRel.keys()) {
            session.request('textDocument/documentSymbol', { textDocument: { uri } }).catch(() => {});
          }
        }

        await session.waitSettled(150000);

        const diagnosticsByRel = new Map<string, RawDiagnostic[]>();
        for (const [uri, rel] of uriToRel) {
          const ds = session.getDiagnostics(uri);
          if (ds) diagnosticsByRel.set(rel, ds);
        }
        const failedRels = new Set<string>();
        for (const [uri, rel] of uriToRel) if (session.isFailed(uri)) failedRels.add(rel);

        return { resolvedVersion: resolveVersion(session), diagnosticsByRel, failedRels };
      } finally {
        session.close();
      }
    },

    async complete(opts: EngineCompleteOptions): Promise<CompletionItemDTO[]> {
      const { datapack, version, file, rel, line, column, verbose, onLog } = opts;
      const session = await boot({ version, datapack, verbose: verbose ?? false, onLog });
      try {
        const uri = normUri(pathToFileURL(file).href);
        session.markOpened(uri);
        const languageId = file.endsWith('.mcfunction') ? 'mcfunction' : 'json';
        session.notify('textDocument/didOpen', { textDocument: { uri, languageId, version: 1, text: readFileSync(file, 'utf8') } });
        // Force the engine to parse + bind the file (completions need it checked first), then
        // wait for its diagnostics to land so a big project doesn't return empty lists.
        session.request('textDocument/documentSymbol', { textDocument: { uri } }).catch(() => {});
        await session.waitForDiagnostics(uri, 6000);
        const res = await session.request('textDocument/completion', {
          textDocument: { uri },
          position: { line: line - 1, character: column - 1 },
          context: { triggerKind: 1 },
        });
        return completionItemsOf(res);
      } finally {
        session.close();
      }
    },

    async close(): Promise<void> { /* each op closes its own session */ },
  };

  return engine;
}
