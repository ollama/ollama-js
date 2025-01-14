declare class EventEmitter {
  on(event: string, listener: Function): this;
  off(event: string, listener: Function): this;
  emit(event: string, ...args: any[]): boolean;
  removeAllListeners(event?: string): this;
  once(event: string, listener: Function): this;
  listenerCount(event: string): number;
  listeners(event: string): Function[];
}

declare class MockEventEmitter extends EventEmitter {
  private events: Map<string, Array<Function>>;
}

declare class MockEventTarget extends MockEventEmitter {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  dispatchEvent(event: Event): boolean;
}

declare class MockAbortSignal extends MockEventTarget {
  aborted: boolean;
  reason: any;
  onabort: ((this: AbortSignal, ev: Event) => any) | null;
  throwIfAborted(): void;
}

declare class MockAbortController {
  readonly signal: MockAbortSignal;
  abort(reason?: any): void;
}

declare global {
  var EventEmitter: typeof EventEmitter;
  var EventTarget: typeof MockEventTarget;
  var AbortController: typeof MockAbortController;
  var Event: typeof Event;
  var performance: {
    now(): number;
    mark(name: string): void;
    measure(name: string, startMark?: string, endMark?: string): void;
    getEntriesByName(name: string, type?: string): PerformanceEntry[];
    clearMarks(name?: string): void;
    clearMeasures(name?: string): void;
    timeOrigin: number;
  };
}
