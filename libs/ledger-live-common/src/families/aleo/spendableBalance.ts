import BigNumber from "bignumber.js";
import type { AccountLike } from "@ledgerhq/types-live";
import type { AleoAccount } from "@ledgerhq/coin-aleo/types";

export function getSpendableBalance(account: AccountLike): BigNumber | undefined {
  if (account.type === "Account") {
    return (account as AleoAccount).aleoResources?.transparentBalance ?? BigNumber(0);
  }

  return undefined;
}
