import { Dev } from './Dev.js';
export class EventDispatcher {
    #target = new EventTarget();
    emit(name, data) {
        this.#target.dispatchEvent(new CustomEvent(name, { detail: data }));
    }
    on(name, listener, options) {
        this.#target.addEventListener(name, (event) => {
            Dev.assertTrue(event instanceof CustomEvent, 'event must be an instance of CustomEvent');
            listener(event.detail);
        }, options);
        return this;
    }
}
//# sourceMappingURL=EventDispatcher.js.map