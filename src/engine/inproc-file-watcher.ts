// inproc-file-watcher.ts — a headless FileWatcher for the in-process engine.
//
// The LSP server's LspFileWatcher walks each project root with
// `core.fileUtil.getAllFiles(externals, location)` during `ready()` and fills its
// UriStore — Project.ready() reads `watcher.watchedFiles` (via its getter) and
// analyzeProject() builds its file list from that same store. Live fs watching is
// not needed for a one-shot analysis, so this headless watcher only enumerates the
// disk once. It deliberately does NOT emit 'add' for the initial walk (matching
// LspFileWatcher), because the initial population is read straight from watchedFiles.
import * as core from '@spyglassmc/core';

export interface InProcFileWatcherOptions {
  externals: core.Externals;
  /** file:// URIs, ending in '/'. */
  locations: string[];
  /** Return false to exclude a URI (e.g. !project.shouldExclude(uri)). */
  predicate: (uri: string) => boolean;
}

export class InProcFileWatcher extends core.EventDispatcher<core.FileWatcherEventMap> implements core.FileWatcher {
  private readonly watched = new core.UriStore();
  private readonly externals: core.Externals;
  private readonly locations: string[];
  private readonly predicate: (uri: string) => boolean;

  constructor(opts: InProcFileWatcherOptions) {
    super();
    this.externals = opts.externals;
    this.locations = opts.locations.map(uri => core.normalizeUri(uri));
    this.predicate = opts.predicate;
  }

  get watchedFiles(): core.UriStore {
    return this.watched;
  }

  async ready(): Promise<void> {
    for (const location of this.locations) {
      let files: string[];
      try {
        files = await core.fileUtil.getAllFiles(this.externals, location);
      } catch {
        continue; // missing root should not fail initialization
      }
      for (const uri of files) {
        const n = core.normalizeUri(uri);
        if (this.predicate(n) && !this.watched.has(n)) {
          this.watched.add(n);
        }
      }
    }
    this.emit('ready', undefined);
  }

  async close(): Promise<void> {
    this.watched.clear();
  }
}
