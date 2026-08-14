import type { Externals, Logger } from '../common/index.js';
export interface FetcherOptions {
    retryBaseMs?: number;
    retryMaxAttempts?: number;
    perTryTimeoutMs?: number;
    totalTimeoutMs?: number;
}
export declare function fetchWithCache({ web }: Externals, logger: Logger, input: RequestInfo | URL, init?: RequestInit, options?: FetcherOptions): Promise<Response>;
export declare function isStaleFetcherResponse(response: Response): boolean;
export declare function fetchJson<T>({ externals, logger, input, init, typeAsserter, }: {
    externals: Externals;
    logger: Logger;
    input: RequestInfo | URL;
    init?: RequestInit;
    typeAsserter: (val: unknown) => asserts val is T;
}): Promise<T | undefined>;
//# sourceMappingURL=fetcher.d.ts.map