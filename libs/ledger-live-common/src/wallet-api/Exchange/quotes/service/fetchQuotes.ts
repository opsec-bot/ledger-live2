import { swapQuotesApi } from "../state-manager/api";
import { getSwapQuotesDispatch } from "../state-manager/store";

import type { GetQuotesArgs } from "../types";
import type { ResolvedQuotesInput } from "../resolveQuotesInput";
import type { FetchQuotesResult } from "./types";

type FetchQuotesArgs = Omit<GetQuotesArgs, "data"> & {
  data: ResolvedQuotesInput;
};

/**
 * Fetch the raw list of quotes from the aggregator API for a single
 * `custom.exchange.getQuotes` request.
 *
 * Thin wrapper around the {@link swapQuotesApi} `fetchQuotes` RTK Query
 * endpoint: it runs the query imperatively against the dispatch registered
 * by the host app (see `setSwapQuotesStore`), so quote requests flow through
 * the same Redux data layer as the rest of the app.
 *
 * @param args - Wire-level `getQuotes` arguments (providers, resolved quotes
 *   input, optional headers).
 * @param counterValueCurrency - Fiat ticker (e.g. `"USD"`) the
 *   aggregator should use for quote countervalues. Sourced from the
 *   wallet's counter-value setting at the handler factory call site.
 * @returns The raw aggregator payload split into successful quotes
 *   (`rawQuotes`) and per-provider rejection rows (`providerErrors`).
 *   Rejection rows carry an aggregator `code` (e.g. `amount_off_limits`)
 *   plus the provider's reason; consumers digest them into globals via
 *   `computeQuotesErrors`. Non-OK HTTP responses become an empty result
 *   so the caller can return the same `noQuotes` global as the legacy UI;
 *   only transport failures (no HTTP response) reject.
 */
export async function fetchQuotes(
  args: FetchQuotesArgs,
  counterValueCurrency: string,
): Promise<FetchQuotesResult> {
  const { providers, data: quotesInput, headers: customHeaders } = args;
  const dispatch = getSwapQuotesDispatch();

  const result = await dispatch(
    swapQuotesApi.endpoints.fetchQuotes.initiate(
      {
        providers,
        quotesInput,
        counterValueCurrency,
        customHeaders: customHeaders ? Object.fromEntries(customHeaders) : undefined,
      },
      // Always hit the aggregator: quotes are time-sensitive and must not be
      // served from cache. `subscribe: false` keeps this a one-shot request:
      // no cache subscription is retained for the (frequently-varying) args,
      // so quote entries don't pile up in the store.
      { forceRefetch: true, subscribe: false },
    ),
  );

  if (result.error) {
    throw result.error;
  }

  return result.data ?? { rawQuotes: [], providerErrors: [] };
}
