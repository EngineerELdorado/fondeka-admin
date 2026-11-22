// Shared Fondeka codes. Processor aliases (for example MATIC) do not belong here.
export const CRYPTO_ASSETS = ["USDC", "BNB", "SOL", "BTC", "ETH", "USDT", "EURC", "BCH", "XMR", "LTC", "POL", "TRX", "XRG", "GRS", "ONEINCH", "AAVE", "ACH", "AIC", "AMP", "ANKR", "APE", "APFC", "ARB", "ATH", "AXL", "AXS", "BAND", "BAT", "BEAM", "BGB", "BIO", "BLUR", "BMAP", "BNX", "BONK", "BORG", "BTT", "BABYDOGE", "CAKE", "CAR", "CHEEL", "CHEEMS", "CHEX", "CHZ", "COMP", "CRV", "CVX", "DAI", "DEUSD", "DEXE", "DHN", "DNY", "DOGECASH", "DSYNC", "EIGEN", "ENA", "ENS", "ETHFI", "FDUSD", "FLOKI", "FLZ", "FRAX", "FTT", "FURU", "FXS", "GALA", "GLM", "GMT", "GNO", "GOMINING", "GRT", "GT", "HOLY", "HOT", "ID", "IMX", "INJ", "JASMY", "JST", "KAVA", "KCS", "KOGE", "LCX", "LDO", "LEO", "LFGK", "LINK", "LPT", "LRC", "MANA", "MASK", "MKR", "MNT", "MOCA", "MOG", "MORPHO", "MOVE", "MUSD", "MX", "NEXO", "NFT", "NWB", "OHM", "OKB", "OLANDO", "OM", "ONDO", "ORBR", "PAXG", "PENDLE", "PEPE", "POINTS", "PRIME", "PUMP", "PYUSD", "QBTC", "QNT", "RAY", "RENDER", "RLB", "ROACH", "ROSE", "RSR", "SAFE", "SAND", "SFP", "SHIB", "SKL", "SKYNET", "SLAY3R", "SNX", "SOV", "SPICE", "SPX", "STAMP", "STPT", "STRK", "SUN", "SUPER", "SUSHI", "SWFTC", "T", "TEL", "TRAC", "TURBO", "TUSD", "TWT", "UNI", "UPC", "USD0", "USDD", "USDY", "USDE", "USUAL", "VANA", "VERUM", "VIRTUAL", "VON", "W", "WHITE", "WLD", "WOO", "XAUT", "XCN", "XYO", "YFI", "ZBU", "ZETA", "ZIG", "ZKJ", "ZRO", "ZRP", "ZRX", "XPUMP"];
export const CRYPTO_NETWORKS = ['BTC', 'LIGHTNING', 'ERC20', 'BEP20', 'TRC20', 'POLYGON', 'BSC', 'ARBITRUM', 'BASE', 'AVALANCHE', 'SOLANA', 'BCH', 'XMR', 'LTC', 'XRG', 'GRS'];

export function mergeCatalogCodes(...groups) {
  return [...new Set(groups.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))].sort();
}

export function withSelectedRecord(records, id, label) {
  if (id == null || id === '' || records.some((record) => String(record.id) === String(id))) return records;
  return [...records, { id, name: label || `#${id}`, displayName: label || `#${id}` }];
}
