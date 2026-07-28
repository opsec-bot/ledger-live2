/**
 * @jest-environment jsdom
 */
import "../../__tests__/test-helpers/dom-polyfill";
import { renderHook, waitFor } from "@testing-library/react";
import type { CryptoCurrency } from "@domain/entity-currency-crypto";
import type { ValidatorsAppValidator } from "@ledgerhq/coin-solana/network/validator-app/index";
import type { SolanaStake } from "@ledgerhq/coin-solana/types";
import { getSolanaValidators } from "@ledgerhq/coin-solana/validators";
import * as hooks from "./react";

jest.mock("@ledgerhq/coin-solana/validators", () => ({
  getSolanaValidators: jest.fn(),
}));

const mockedGetSolanaValidators = jest.mocked(getSolanaValidators);

// the hook memoizes the last fetched list per currency id at module level, so each
// test uses its own currency to stay isolated from the others
let currencyCount = 0;
const nextCurrency = () => ({ id: `solana-${currencyCount++}` }) as CryptoCurrency;

const ledgerValidator: ValidatorsAppValidator = {
  activeStake: 100,
  commission: 7,
  totalScore: 10,
  voteAccount: "ledger-vote-account",
  name: "Ledger by Figment",
  avatarUrl: "ledger-avatar",
  wwwUrl: "ledger-url",
};

describe("solana/react", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSolanaValidators.mockResolvedValue([ledgerValidator]);
  });

  describe("useValidators", () => {
    // the API cannot be made to fail on demand, so this branch is only reachable here
    it("returns an empty list when the fetch fails", async () => {
      mockedGetSolanaValidators.mockRejectedValue(new Error("validators.app is down"));
      const currency = nextCurrency();

      const { result } = renderHook(() => hooks.useValidators(currency));

      await waitFor(() => expect(mockedGetSolanaValidators).toHaveBeenCalled());
      expect(result.current).toEqual([]);
    });

    it("does not flash the previous list on the mount following a failure", async () => {
      const currency = nextCurrency();

      const first = renderHook(() => hooks.useValidators(currency));
      await waitFor(() => expect(first.result.current).toEqual([ledgerValidator]));
      first.unmount();

      mockedGetSolanaValidators.mockRejectedValue(new Error("validators.app is down"));
      const second = renderHook(() => hooks.useValidators(currency));
      await waitFor(() => expect(second.result.current).toEqual([]));
      second.unmount();

      const third = renderHook(() => hooks.useValidators(currency));
      expect(third.result.current).toEqual([]);
    });
  });

  describe("useSolanaStakesWithMeta", () => {
    const stake = {
      stakeAccAddr: "stake-account",
      delegation: { voteAccAddr: "ledger-vote-account" },
    } as SolanaStake;

    it("attaches the validator metadata to each stake", async () => {
      const currency = nextCurrency();

      const { result } = renderHook(() => hooks.useSolanaStakesWithMeta(currency, [stake]));

      await waitFor(() =>
        expect(result.current).toEqual([
          {
            stake,
            meta: {
              validator: {
                img: ledgerValidator.avatarUrl,
                name: ledgerValidator.name,
                url: ledgerValidator.wwwUrl,
              },
            },
          },
        ]),
      );
    });

    it("leaves the metadata empty for an unknown validator", async () => {
      const unknown = { ...stake, delegation: { voteAccAddr: "unknown" } } as SolanaStake;

      const currency = nextCurrency();

      const { result } = renderHook(() => hooks.useSolanaStakesWithMeta(currency, [unknown]));

      await waitFor(() => expect(result.current.length).toBe(1));
      expect(result.current).toEqual([
        {
          stake: unknown,
          meta: { validator: { img: undefined, name: undefined, url: undefined } },
        },
      ]);
    });
  });
});
