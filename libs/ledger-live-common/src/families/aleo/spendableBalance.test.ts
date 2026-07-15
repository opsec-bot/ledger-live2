import BigNumber from "bignumber.js";
import type { AccountLike } from "@ledgerhq/types-live";
import { getSpendableBalance } from "./spendableBalance";
import { makeAleoAccount } from "./__mocks__/account.mock";

describe("getSpendableBalance", () => {
  it("returns the transparent balance for an Account", () => {
    const account = makeAleoAccount();
    const mockBalance = new BigNumber(42);

    if (account.aleoResources) {
      account.aleoResources.transparentBalance = mockBalance;
    }

    expect(getSpendableBalance(account)).toEqual(mockBalance);
  });

  it("returns 0 when aleoResources is missing", () => {
    const account = { ...makeAleoAccount(), aleoResources: undefined };

    expect(getSpendableBalance(account)).toEqual(new BigNumber(0));
  });

  it("returns undefined for a non-Account (e.g. TokenAccount)", () => {
    const account: AccountLike = { type: "TokenAccount" } as AccountLike;

    expect(getSpendableBalance(account)).toBeUndefined();
  });
});
