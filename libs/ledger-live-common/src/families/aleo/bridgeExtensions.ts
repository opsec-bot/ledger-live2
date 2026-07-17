import BigNumber from "bignumber.js";
import type { AccountBridgeExtensions } from "@ledgerhq/types-live";
import type { AleoAccount, AleoTokenAccount } from "@ledgerhq/coin-aleo/types";

const extensions: AccountBridgeExtensions = {
  getWalletApiSpendableBalance: account => {
    return account.type === "TokenAccount"
      ? (account as AleoTokenAccount).transparentBalance
      : ((account as AleoAccount).aleoResources?.transparentBalance ?? new BigNumber(0));
  },
};

export default extensions;
