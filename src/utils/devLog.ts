type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => {};

/** Production build'lerde sessiz; yalnızca __DEV__ ortamında loglar. */
export const devLog: LogFn = __DEV__ ? (...args) => console.log(...args) : noop;
export const devWarn: LogFn = __DEV__ ? (...args) => console.warn(...args) : noop;
