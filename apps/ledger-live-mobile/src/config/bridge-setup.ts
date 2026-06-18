import { buildCryptoAssetsStore } from "@features/platform-currencies";
import { setCryptoAssetsStore } from "@ledgerhq/ledger-wallet-framework/cryptoAssetsStore";
import { setSwapQuotesStore } from "@ledgerhq/live-common/wallet-api/Exchange/quotes/state-manager/store";
import type { StoreType } from "~/state-manager/configureStore";

export function setupCryptoAssetsStore(store: StoreType) {
  const cryptoAssetsStore = buildCryptoAssetsStore({ dispatch: store.dispatch });
  setCryptoAssetsStore(cryptoAssetsStore);
}

export function setupSwapQuotesStore(store: StoreType) {
  setSwapQuotesStore(store.dispatch);
}
