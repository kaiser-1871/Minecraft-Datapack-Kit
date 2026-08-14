export declare class EventDispatcher<TEvents extends Record<string, unknown>> {
    #private;
    emit<K extends keyof TEvents & string>(name: K, data: TEvents[K]): void;
    on<K extends keyof TEvents & string>(name: K, listener: (data: TEvents[K]) => unknown, options?: AddEventListenerOptions): this;
}
//# sourceMappingURL=EventDispatcher.d.ts.map