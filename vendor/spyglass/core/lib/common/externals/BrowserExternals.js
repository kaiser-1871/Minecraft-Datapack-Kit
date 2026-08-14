import { decode as arrayBufferFromBase64, encode as arrayBufferToBase64 } from 'base64-arraybuffer';
import { fileUtil } from '../../service/fileUtil.js';
// TODO: Use Origin Private File System (OPFS) instead
class BrowserFileSystem {
    static LocalStorageKey = 'spyglassmc-browser-fs';
    states;
    constructor() {
        this.states = JSON.parse(localStorage.getItem(BrowserFileSystem.LocalStorageKey) ?? '{}');
    }
    saveStates() {
        localStorage.setItem(BrowserFileSystem.LocalStorageKey, JSON.stringify(this.states));
    }
    async chmod(_location, _mode) {
        return;
    }
    async mkdir(location, _options) {
        location = fileUtil.ensureEndingSlash(location.toString());
        if (this.states[location]) {
            throw new Error(`EEXIST: ${location}`);
        }
        this.states[location] = { type: 'directory' };
        this.saveStates();
    }
    async readdir(_location) {
        // Not implemented
        return [];
    }
    async readFile(location) {
        location = location.toString();
        const entry = this.states[location];
        if (!entry) {
            throw new Error(`ENOENT: ${location}`);
        }
        else if (entry.type === 'directory') {
            throw new Error(`EISDIR: ${location}`);
        }
        return new Uint8Array(arrayBufferFromBase64(entry.content));
    }
    async rm(_location, _options) {
        throw new Error('Not implemented');
    }
    async showFile(_path) {
        throw new Error('showFile not supported on browser');
    }
    async stat(location) {
        location = location.toString();
        const entry = this.states[location];
        if (!entry) {
            throw new Error(`ENOENT: ${location}`);
        }
        return {
            isDirectory: () => entry.type === 'directory',
            isFile: () => entry.type === 'file',
            isSymbolicLink: () => false,
        };
    }
    async unlink(location) {
        location = location.toString();
        const entry = this.states[location];
        if (!entry) {
            throw new Error(`ENOENT: ${location}`);
        }
        delete this.states[location];
        this.saveStates();
    }
    async writeFile(location, data, _options) {
        location = location.toString();
        if (typeof data === 'string') {
            data = new TextEncoder().encode(data);
        }
        data = arrayBufferToBase64(data.buffer);
        this.states[location] = { type: 'file', content: data };
        this.saveStates();
    }
}
export const BrowserExternals = {
    archive: {
        decompressBall(_buffer, _options) {
            throw new Error('decompressBall not supported on browser.');
        },
    },
    error: {
        createKind(kind, message) {
            return new Error(`${kind}: ${message}`);
        },
        isKind(e, kind) {
            return e instanceof Error && e.message.startsWith(kind);
        },
    },
    fs: new BrowserFileSystem(),
    web: {
        getCache: () => window.caches.open('spyglassmc'),
    },
};
Object.freeze(BrowserExternals);
//# sourceMappingURL=BrowserExternals.js.map