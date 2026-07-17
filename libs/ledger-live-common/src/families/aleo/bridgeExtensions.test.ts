import BigNumber from "bignumber.js";
import type { AleoAccount, AleoTokenAccount } from "@ledgerhq/coin-aleo/types";
import extensions from "./bridgeExtensions";
import { makeAleoAccount } from "./__mocks__/account.mock";

describe("aleo bridgeExtensions", () => {
  const mockAccount = makeAleoAccount();

  describe("getWalletApiSpendableBalance", () => {
    it("returns the token account's transparentBalance for a TokenAccount", () => {
      const tokenAccount = {
        type: "TokenAccount",
        transparentBalance: new BigNumber(123),
      } as AleoTokenAccount;

      const result = extensions.getWalletApiSpendableBalance?.(tokenAccount);

      expect(result).toEqual(new BigNumber(123));
    });

    it("returns the account's aleoResources.transparentBalance for a main Account", () => {
      const account: AleoAccount = {
        ...mockAccount,
        aleoResources: {
          ...mockAccount.aleoResources!,
          transparentBalance: new BigNumber(456),
        },
      };

      const result = extensions.getWalletApiSpendableBalance?.(account);

      expect(result).toEqual(new BigNumber(456));
    });

    it("falls back to zero when the main Account has no aleoResources", () => {
      const account = { ...mockAccount, aleoResources: undefined };

      const result = extensions.getWalletApiSpendableBalance?.(account);

      expect(result).toEqual(new BigNumber(0));
    });
  });
});
