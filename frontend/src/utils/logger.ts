export const log = {
  info: (...args: any[]) => console.log('%c[ARTZOOKA]', 'color:#9ac5ff', ...args),
  warn: (...args: any[]) => console.warn('%c[ARTZOOKA]', 'color:#fbbf24', ...args),
  error: (...args: any[]) => console.error('%c[ARTZOOKA]', 'color:#f87171', ...args),
}


