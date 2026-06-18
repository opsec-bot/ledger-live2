import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { getSwapQuotesDispatch } from "./store";
import { swapQuotesApi } from "./api";
import { setupStandaloneSwapQuotesStore } from "./standaloneStore";

jest.mock("../../../../exchange/swap", () => ({
  getSwapAPIBaseURL: jest.fn(() => "https://swap.test"),
}));

describe("setupStandaloneSwapQuotesStore", () => {
  const server = setupServer();

  beforeAll(() => server.listen());
  beforeEach(() => {
    // The dispatch lives on globalThis, which persists across test files in a
    // Jest worker. Reset it before each test so the "throws before setup"
    // assertion isn't order-dependent on any other suite that set it.
    globalThis.__ledgerSwapQuotesDispatch = undefined;
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => {
    server.close();
    // Clear the global dispatch registered during the tests so it doesn't leak
    // into other suites sharing the worker.
    globalThis.__ledgerSwapQuotesDispatch = undefined;
  });

  it("registers a dispatch so getSwapQuotesDispatch no longer throws", () => {
    expect(() => getSwapQuotesDispatch()).toThrow();

    setupStandaloneSwapQuotesStore();

    expect(() => getSwapQuotesDispatch()).not.toThrow();
  });

  it("wires a working store the fetchQuotes endpoint can run against", async () => {
    const rawQuote = { provider: "lifi", key: "lifi-key" };
    server.use(http.get("https://swap.test/quote", () => HttpResponse.json([rawQuote])));

    setupStandaloneSwapQuotesStore();
    const dispatch = getSwapQuotesDispatch();

    const result = (await dispatch(
      swapQuotesApi.endpoints.fetchQuotes.initiate(
        {
          providers: ["lifi"],
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          quotesInput: {
            amount: "1",
            sendAccountId: "s",
            receiveAccountId: "r",
            sendAddress: "0xfrom",
            receiveAddress: "0xto",
            sendCurrencyId: "bitcoin",
            receiveCurrencyId: "ethereum",
          } as never,
          counterValueCurrency: "usd",
        },
        { forceRefetch: true },
      ),
    )) as { data?: unknown; error?: unknown };

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ rawQuotes: [rawQuote], providerErrors: [] });
  });
});
