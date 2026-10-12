// Supported USD futures roots. `standardEquivalent` converts a contract count
// into the standard-contract units prop firms state position limits in
// (10 micros = 1 mini), so mixed micro/mini trading compares correctly.
export const INSTRUMENTS = {
  ES: { name: 'E-mini S&P 500', standardEquivalent: 1 },
  MES: { name: 'Micro E-mini S&P 500', standardEquivalent: 0.1 },
  NQ: { name: 'E-mini Nasdaq-100', standardEquivalent: 1 },
  MNQ: { name: 'Micro E-mini Nasdaq-100', standardEquivalent: 0.1 },
  GC: { name: 'Gold', standardEquivalent: 1 },
  MGC: { name: 'Micro Gold', standardEquivalent: 0.1 },
  CL: { name: 'Crude Oil', standardEquivalent: 1 },
  MCL: { name: 'Micro Crude Oil', standardEquivalent: 0.1 },
} as const

export type InstrumentRoot = keyof typeof INSTRUMENTS

const MONTH_CODE_SUFFIX = /^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/

// "MESZ5" (Tradovate) and "MES 12-25" (NinjaTrader) both become "MES".
// Unknown roots pass through so unsupported symbols still import.
export function normalizeSymbol(raw: string): string {
  const symbol = raw.trim().toUpperCase().split(/\s+/)[0]
  if (symbol in INSTRUMENTS) return symbol
  return symbol.match(MONTH_CODE_SUFFIX)?.[1] ?? symbol
}

// Unknown roots count as standard-size contracts.
export function isMicro(symbol: string): boolean {
  return symbol in INSTRUMENTS && INSTRUMENTS[symbol as InstrumentRoot].standardEquivalent < 1
}
