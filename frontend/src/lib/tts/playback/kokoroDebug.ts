let moduleDebug = false;

export function setKokoroDebug(value: boolean): void {
  moduleDebug = value;
}

function isEnvDebugEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_KOKORO_DEBUG === 'true') {
    return true;
  }
  return false;
}

export function isKokoroDebug(): boolean {
  if (moduleDebug) return true;
  if (typeof globalThis !== 'undefined') {
    const globalDebug = (globalThis as unknown as { __kokoroDebug?: boolean }).__kokoroDebug;
    if (globalDebug) return true;
  }
  return isEnvDebugEnabled();
}

export function debugLog(...args: unknown[]): void {
  if (isKokoroDebug()) {
    console.log(...args);
  }
}
