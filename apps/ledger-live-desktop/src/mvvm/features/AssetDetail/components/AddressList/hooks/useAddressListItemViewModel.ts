import { useCallback } from "react";
import type { Account, AccountLike } from "@ledgerhq/types-live";
import { getCryptoCurrencyById } from "@domain/entity-currency-crypto";
import { getAccountCurrency } from "@ledgerhq/live-common/account/helpers";
import { formatAddress } from "@ledgerhq/live-common/utils/addressUtils";
import { useAccountName } from "~/renderer/reducers/wallet";
import { getCryptoAccountAddress } from "LLD/features/CryptoAddresses/utils/getCryptoAccountAddress";
import { useCounterValueCellViewModel } from "LLD/components/Cells/CounterValueCell/useCounterValueCellViewModel";
import { useBalanceCellViewModel } from "LLD/components/Cells/BalanceCell/useBalanceCellViewModel";

export type AddressListItemViewModel = Readonly<{
  displayName: string;
  formattedAddress: string;
  formattedCounterValue: string;
  cryptoFormatted: string;
  networkLedgerId: string;
  networkTicker: string;
  onClick: () => void;
  rowTestId: string;
  balanceTestId: string;
}>;

export function useAddressListItemViewModel(
  account: AccountLike,
  lookupParentAccount: (id: string) => Account | undefined | null,
  onNavigate: (acc: AccountLike, parentAccount?: Account | null) => void,
): AddressListItemViewModel {
  const currency = getAccountCurrency(account);
  const parentAccount =
    account.type === "TokenAccount" ? lookupParentAccount(account.parentId) : undefined;
  const networkCurrency =
    account.type === "TokenAccount"
      ? (parentAccount?.currency ?? getCryptoCurrencyById(account.token.parentCurrencyId))
      : currency;

  const accountForDisplayName =
    account.type === "TokenAccount"
      ? (parentAccount ?? lookupParentAccount(account.parentId))
      : account;
  const displayName = useAccountName(accountForDisplayName ?? account);
  const rawAddress = getCryptoAccountAddress(account, lookupParentAccount);
  const formattedAddress = formatAddress(rawAddress, { prefixLength: 5, suffixLength: 5 });
  const { formattedCounterValue } = useCounterValueCellViewModel(currency, account.balance);
  // Shares BalanceCell's view model so the crypto amount honours Flex Mode the
  // same way the fiat value beside it does.
  const { formattedBalance: cryptoFormatted } = useBalanceCellViewModel(currency, account.balance);

  const onClick = useCallback(() => {
    onNavigate(account, parentAccount);
  }, [account, onNavigate, parentAccount]);

  return {
    displayName,
    formattedAddress,
    formattedCounterValue,
    cryptoFormatted,
    networkLedgerId: networkCurrency.id,
    networkTicker: networkCurrency.ticker,
    onClick,
    rowTestId: `asset-detail-address-row-${account.id}`,
    balanceTestId: `asset-detail-address-balance-${account.id}`,
  };
}
