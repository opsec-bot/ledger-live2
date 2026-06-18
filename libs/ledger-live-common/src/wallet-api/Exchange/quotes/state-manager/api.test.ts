import type { FetchBaseQueryMeta } from "@reduxjs/toolkit/query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestStore } from "@tests/test-helpers/testUtils";

import { ProviderErrorCodes } from "../types";
import type { ResolvedQuotesInput } from "../resolveQuotesInput";
import type { RawQuote, RawQuoteError } from "../service/types";
import { buildQuotesParams, splitQuotes, swapQuotesApi, transformFetchQuotesResponse } from "./api";

jest.mock("../../../../exchange/swap", () => ({
  getSwapAPIBaseURL: jest.fn(() => "https://swap.test"),
}));

function makeQuotesInput(overrides: Partial<ResolvedQuotesInput> = {}): ResolvedQuotesInput {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    amount: "100000000",
    sendAccountId: "send-account",
    receiveAccountId: "receive-account",
    sendAddress: "0xfrom",
    receiveAddress: "0xto",
    sendCurrencyId: "bitcoin",
    receiveCurrencyId: "ethereum",
    ...overrides,
  } as ResolvedQuotesInput;
}

function meta(status?: number): FetchBaseQueryMeta {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    response: status === undefined ? undefined : { status },
  } as unknown as FetchBaseQueryMeta;
}

describe("buildQuotesParams", () => {
  it("maps the resolved input to the aggregator query params", () => {
    const params = buildQuotesParams(["lifi", "okx"], makeQuotesInput(), "usd");

    expect(params).toMatchObject({
      amountFrom: "100000000",
      "providers-whitelist": "lifi,okx",
      from: "bitcoin",
      to: "ethereum",
      fromAccountId: "send-account",
      addressFrom: "0xfrom",
      addressTo: "0xto",
      fiatForCounterValue: "usd",
      currencyTicker: "usd",
      uniswapOrderType: "classic",
    });
  });

  it("includes optional network fees currency and slippage when provided", () => {
    const params = buildQuotesParams(
      ["lifi"],
      makeQuotesInput({ networkFeesCurrencyId: "ethereum", slippage: 0.5 }),
      "usd",
    );

    expect(params.networkFeesCurrency).toBe("ethereum");
    expect(params.slippage).toBe("0.5");
  });

  it("omits optional params when absent", () => {
    const params = buildQuotesParams(["lifi"], makeQuotesInput(), "usd");

    expect(params).not.toHaveProperty("networkFeesCurrency");
    expect(params).not.toHaveProperty("slippage");
  });
});

describe("splitQuotes", () => {
  it("splits successful quote rows from provider error rows", () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const rawQuote = { provider: "lifi", key: "lifi-key" } as RawQuote;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const providerError = {
      code: ProviderErrorCodes.AMOUNT_OFF_LIMITS,
      provider: "okx",
    } as RawQuoteError;

    expect(splitQuotes([rawQuote, providerError])).toEqual({
      rawQuotes: [rawQuote],
      providerErrors: [providerError],
    });
  });
});

describe("transformFetchQuotesResponse", () => {
  it("splits the rows on a successful response", () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const rawQuote = { provider: "lifi", key: "lifi-key" } as RawQuote;

    expect(transformFetchQuotesResponse([rawQuote], meta(200))).toEqual({
      rawQuotes: [rawQuote],
      providerErrors: [],
    });
  });

  it("returns an empty result on a non-OK status", () => {
    expect(transformFetchQuotesResponse({ error: "boom" }, meta(500))).toEqual({
      rawQuotes: [],
      providerErrors: [],
    });
  });

  it("returns an empty result when no response status is available", () => {
    expect(transformFetchQuotesResponse([], meta(undefined))).toEqual({
      rawQuotes: [],
      providerErrors: [],
    });
  });

  it("returns an empty result when the OK body is not an array", () => {
    expect(transformFetchQuotesResponse({ unexpected: true }, meta(200))).toEqual({
      rawQuotes: [],
      providerErrors: [],
    });
  });
});

describe("swapQuotesApi.fetchQuotes (integration)", () => {
  const server = setupServer();
  let store: ReturnType<typeof createTestStore>;

  beforeAll(() => server.listen());
  afterEach(() => {
    store.dispatch(swapQuotesApi.util.resetApiState());
    server.resetHandlers();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    store = createTestStore([swapQuotesApi]);
  });

  function initiate() {
    return store.dispatch(
      swapQuotesApi.endpoints.fetchQuotes.initiate(
        { providers: ["lifi", "okx"], quotesInput: makeQuotesInput(), counterValueCurrency: "usd" },
        { forceRefetch: true },
      ),
    );
  }

  it("splits the rows on a 2xx JSON response", async () => {
    const rawQuote = { provider: "lifi", key: "lifi-key" };
    const providerError = { code: ProviderErrorCodes.AMOUNT_OFF_LIMITS, provider: "okx" };
    server.use(
      http.get("https://swap.test/quote", () => HttpResponse.json([rawQuote, providerError])),
    );

    const result = await initiate();

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ rawQuotes: [rawQuote], providerErrors: [providerError] });
  });

  it("maps a non-2xx non-JSON error body to an empty result instead of a parsing error", async () => {
    // Aggregator 5xx responses often carry a non-JSON body; the api's
    // `responseHandler` skips parsing it so this surfaces as an empty result
    // rather than an RTK Query PARSING_ERROR.
    server.use(
      http.get(
        "https://swap.test/quote",
        () => new HttpResponse("<html>502 Bad Gateway</html>", { status: 502 }),
      ),
    );

    const result = await initiate();

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ rawQuotes: [], providerErrors: [] });
  });

  it("rejects with an error on a transport failure", async () => {
    server.use(http.get("https://swap.test/quote", () => HttpResponse.error()));

    const result = await initiate();

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});
