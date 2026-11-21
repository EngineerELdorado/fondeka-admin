export const emptyCollectionWallet = { providerName: 'BITCART', productNetworkId: '', walletId: '', storeId: '', providerCoin: '', providerSymbol: '', tokenContract: '', chainNetwork: '', minimumConfirmations: 1, active: false };
export const collectionWalletFields = [
  ['walletId', 'Bitcart wallet ID', 128], ['storeId', 'Bitcart store ID', 128],
  ['providerCoin', 'Daemon currency code', 32], ['providerSymbol', 'Provider asset symbol (optional)', 32],
  ['tokenContract', 'Token contract (optional)', 256], ['chainNetwork', 'Chain network', 64]
];

export function collectionWalletDraft(row = {}) {
  return { ...emptyCollectionWallet, ...row, ...Object.fromEntries(collectionWalletFields.map(([key]) => [key, row[key] ?? ''])) };
}

export function collectionWalletPayload(draft) {
  if (draft.providerName !== 'BITCART') throw new Error('Choose a supported collection provider.');
  const productNetworkId = Number(draft.productNetworkId);
  if (!Number.isSafeInteger(productNetworkId) || productNetworkId <= 0) throw new Error('Select a crypto / network mapping.');
  const body = { providerName: draft.providerName, productNetworkId };
  for (const [key, label, maximum] of collectionWalletFields) {
    const value = typeof draft[key] === 'string' ? draft[key].trim() : '';
    const optional = ['providerSymbol', 'tokenContract'].includes(key);
    if ((!optional && !value) || value.length > maximum || !(key === 'tokenContract' ? /^[A-Za-z0-9]*$/ : /^[A-Za-z0-9_-]*$/).test(value)) {
      throw new Error(`${label}: use ${key === 'tokenContract' ? 'letters and digits' : 'letters, digits, underscores or hyphens'}${optional ? '' : ' (required)'}, up to ${maximum} characters.`);
    }
    body[key] = key === 'providerSymbol' ? value || null : value;
  }
  const confirmations = Number(draft.minimumConfirmations);
  if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 2147483647) throw new Error('Minimum confirmations must be a positive whole number.');
  body.minimumConfirmations = confirmations;
  body.active = Boolean(draft.active);
  if (draft.id != null) {
    if (!Number.isSafeInteger(draft.version) || draft.version < 0) throw new Error('Reload this collection wallet to get its current version before saving.');
    body.version = draft.version;
  }
  return body;
}
