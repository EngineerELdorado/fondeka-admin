// Shared Fondeka codes. Processor aliases (for example MATIC) do not belong here.
export const CRYPTO_ASSETS = ['USDC', 'BNB', 'SOL', 'BTC', 'ETH', 'USDT', 'EURC', 'BCH', 'XMR', 'LTC', 'POL', 'TRX', 'XRG', 'GRS'];
export const CRYPTO_NETWORKS = ['BTC', 'LIGHTNING', 'ERC20', 'BEP20', 'TRC20', 'POLYGON', 'BSC', 'ARBITRUM', 'BASE', 'AVALANCHE', 'SOLANA', 'BCH', 'XMR', 'LTC', 'XRG', 'GRS'];

export function mergeCatalogCodes(...groups) {
  return [...new Set(groups.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))].sort();
}

export function withSelectedRecord(records, id, label) {
  if (id == null || id === '' || records.some((record) => String(record.id) === String(id))) return records;
  return [...records, { id, name: label || `#${id}`, displayName: label || `#${id}` }];
}
