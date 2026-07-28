/**
 * @jest-environment jsdom
 */
import "../../__tests__/test-helpers/dom-polyfill";
import { renderHook, waitFor } from "@testing-library/react";
import { LEDGER_VALIDATOR_DEFAULT } from "@ledgerhq/coin-solana/utils";
import { getSolanaValidators } from "@ledgerhq/coin-solana/validators";
import { getCryptoCurrencyById } from "../../currencies";
import * as hooks from "./react";

jest.setTimeout(2 * 60 * 1000);

const currency = getCryptoCurrencyById("solana");

describe("solana/react", () => {
  describe("useValidators", () => {
    // reset once, not per test: the LRU then serves the remaining cases from the
    // single fetch below instead of hitting the endpoint three times
    beforeAll(() => {
      getSolanaValidators.reset();
    });

    // awaited directly so a network failure surfaces as the actual error rather than
    // as an empty list further down
    it("fetches the validators from the API", async () => {
      const validators = await getSolanaValidators(currency.id);

      expect(validators.length).toBeGreaterThan(0);
    });

    it("exposes the fetched validators through the hook", async () => {
      const validators = await getSolanaValidators(currency.id);

      const { result } = renderHook(() => hooks.useValidators(currency));

      await waitFor(() => expect(result.current).toEqual(validators));
    });

    it("returns the Ledger validator when searching for it", async () => {
      await getSolanaValidators(currency.id);

      const { result } = renderHook(() => hooks.useValidators(currency, "Ledger"));

      await waitFor(() =>
        expect(
          result.current.some(
            validator => validator.voteAccount === LEDGER_VALIDATOR_DEFAULT.voteAccount,
          ),
        ).toBe(true),
      );
    });
  });
});
