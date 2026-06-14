export function createLogger(onLog, { echoToConsole = true } = {}) {
  const emit = (level, args) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
    onLog(level === 'log' ? msg : `[${level}] ${msg}`);
    if (echoToConsole) {
      console[level](...args);
    }
  };

  return {
    log: (...args) => emit('log', args),
    warn: (...args) => emit('warn', args),
    error: (...args) => emit('error', args),
  };
}
