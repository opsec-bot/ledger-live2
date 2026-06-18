import { createApi, type FetchBaseQueryMeta } from "@reduxjs/toolkit/query";
import { createAuthenticatedBaseQuery } from "@shared/auth";

import { getSwapAPIBaseURL } from "../../../../exchange/swap";

import type { ResolvedQuotesInput } from "../resolveQuotesInput";
import type { FetchQuotesResult, RawQuote, RawQuoteError } from "../service/types";

/**
 * Serializable arguments for the {@link swapQuotesApi} `fetchQuotes`
 * endpoint. Mirrors the inputs the legacy `fetchQuotes` axios helper
 * consumed, flattened into a single object so RTK Query can use it as a
 * cache key.
 */
export type FetchQuotesQueryArgs = {
  providers: string[];
  quotesInput: ResolvedQuotesInput;
  /** Fiat ticker (e.g. `"USD"`) the aggregator should use for quote countervalues. */
  counterValueCurrency: string;
  /** Optional caller-supplied headers, already flattened to a plain object. */
  customHeaders?: Record<string, string>;
};

/**
 * Build the aggregator `/quote` query string parameters. Kept identical to
 * the legacy axios helper so the wire request is byte-for-byte unchanged.
 */
export function buildQuotesParams(
  providers: string[],
  quotesInput: ResolvedQuotesInput,
  counterValueCurrency: string,
): Record<string, string> {
  const params: Record<string, string> = {
    amountFrom: quotesInput.amount,
    displayLanguage: "en",
    lang: "en",
    theme: "dark",
    "providers-whitelist": providers.join(","),
    fiatForCounterValue: counterValueCurrency,
    currencyTicker: counterValueCurrency,
    networkFees: "0",
    uniswapOrderType: quotesInput.uniswapOrderType ?? "classic",
    from: quotesInput.sendCurrencyId,
    to: quotesInput.receiveCurrencyId,
    fromAccountId: quotesInput.sendAccountId,
    addressFrom: quotesInput.sendAddress,
    addressTo: quotesInput.receiveAddress,
  };

  if (quotesInput.networkFeesCurrencyId) {
    params.networkFeesCurrency = quotesInput.networkFeesCurrencyId;
  }

  if (quotesInput.slippage != null) {
    params.slippage = quotesInput.slippage.toString();
  }

  return params;
}

/**
 * Split the raw aggregator payload into successful quote rows (`rawQuotes`)
 * and per-provider rejection rows (`providerErrors`). Rejection rows are the
 * ones carrying an aggregator `code` field.
 */
export function splitQuotes(data: Array<RawQuote | RawQuoteError>): FetchQuotesResult {
  const rawQuotes = data.filter((q): q is RawQuote => !("code" in q));
  const providerErrors = data.filter((q): q is RawQuoteError => "code" in q);
  return { rawQuotes, providerErrors };
}

/**
 * Reshape the `/quote` HTTP response into a {@link FetchQuotesResult}.
 *
 * `baseQuery` is configured with `validateStatus: () => true`, so any
 * response that reached the server (including non-2xx) lands here rather
 * than as an RTK Query error. A non-OK status becomes an empty result so
 * the caller surfaces the same `noQuotes` global as the legacy UI; only
 * transport-level failures (no HTTP response) propagate as errors.
 */
export function transformFetchQuotesResponse(
  response: unknown,
  meta?: FetchBaseQueryMeta,
): FetchQuotesResult {
  const status = meta?.response?.status;
  if (status === undefined || status < 200 || status >= 300) {
    return { rawQuotes: [], providerErrors: [] };
  }

  return splitQuotes(Array.isArray(response) ? (response as Array<RawQuote | RawQuoteError>) : []);
}

/**
 * RTK Query API for the swap quotes aggregator. Exposed as a single
 * `fetchQuotes` query that replaces the legacy axios `fetchQuotes` helper.
 *
 * Consumed imperatively from the server-side `getQuotes` flow (not a React
 * hook) via `dispatch(swapQuotesApi.endpoints.fetchQuotes.initiate(...))`,
 * mirroring the `cryptoAssetsApi` (CAL client) pattern.
 */
export const swapQuotesApi = createApi({
  reducerPath: "swapQuotesApi",
  baseQuery: createAuthenticatedBaseQuery({
    // The aggregator base URL is resolved per-request (from SWAP_API_BASE) in
    // each endpoint's `query`, so the static base URL stays empty.
    baseUrl: "",
    // Treat every HTTP response as "successful" and let transformResponse map
    // non-OK statuses to an empty result, matching the legacy helper which
    // swallowed HTTP errors. Transport failures still surface as RTK errors.
    validateStatus: () => true,
    // Only parse the JSON body for 2xx responses. Aggregator error responses
    // (4xx/5xx) frequently carry a non-JSON body; letting fetchBaseQuery parse
    // it would surface as a PARSING_ERROR on `result.error` instead of letting
    // transformResponse map the non-OK status to an empty result. A malformed
    // 2xx body is likewise mapped to `null` (never a PARSING_ERROR) so it falls
    // through to an empty result, matching the legacy axios helper which
    // swallowed JSON-parse failures.
    responseHandler: async (response: Response) => {
      if (!response.ok) return null;
      try {
        return await response.json();
      } catch {
        return null;
      }
    },
  }),
  endpoints: build => ({
    fetchQuotes: build.query<FetchQuotesResult, FetchQuotesQueryArgs>({
      query: ({ providers, quotesInput, counterValueCurrency, customHeaders }) => ({
        url: `${getSwapAPIBaseURL()}/quote`,
        params: buildQuotesParams(providers, quotesInput, counterValueCurrency),
        headers: {
          Accept: "application/json",
          ...(customHeaders ?? {}),
        },
      }),
      transformResponse: transformFetchQuotesResponse,
      // Quotes are time-sensitive: never retain them between requests.
      keepUnusedDataFor: 0,
    }),
  }),
});
