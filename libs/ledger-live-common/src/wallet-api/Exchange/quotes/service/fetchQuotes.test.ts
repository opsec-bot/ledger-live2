import { swapQuotesApi } from "../state-manager/api";
import { getSwapQuotesDispatch } from "../state-manager/store";
import { ProviderErrorCodes } from "../types";
import { fetchQuotes } from "./fetchQuotes";

jest.mock("../state-manager/store", () => ({
  getSwapQuotesDispatch: jest.fn(),
}));

jest.mock("../state-manager/api", () => ({
  swapQuotesApi: {
    endpoints: {
      fetchQuotes: {
        initiate: jest.fn(),
      },
    },
  },
}));

const getSwapQuotesDispatchMock = jest.mocked(getSwapQuotesDispatch);
const initiateMock = jest.mocked(swapQuotesApi.endpoints.fetchQuotes.initiate);

function makeArgs(): Parameters<typeof fetchQuotes>[0] {
  return {
    providers: ["lifi", "okx"],
    data: {
      amount: "100000000",
      sendAccountId: "send-account",
      receiveAccountId: "receive-account",
      sendAddress: "0xfrom",
      receiveAddress: "0xto",
      sendCurrencyId: "bitcoin",
      receiveCurrencyId: "ethereum",
    },
  };
}

describe("fetchQuotes", () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    getSwapQuotesDispatchMock.mockReturnValue(dispatch);
    // The thunk returned by `initiate` is opaque to `fetchQuotes`; only the
    // dispatched result matters, so return a marker we can assert against.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    initiateMock.mockImplementation(((arg: unknown) => ({ arg })) as never);
  });

  it("returns the quotes split by the endpoint", async () => {
    const rawQuotes = [{ provider: "lifi", key: "lifi-key" }];
    const providerErrors = [
      {
        code: ProviderErrorCodes.AMOUNT_OFF_LIMITS,
        provider: "okx",
        message: "amount out of range",
      },
    ];
    dispatch.mockResolvedValue({ data: { rawQuotes, providerErrors } });

    const result = await fetchQuotes(makeArgs(), "usd");

    expect(result).toEqual({ rawQuotes, providerErrors });
    expect(initiateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: ["lifi", "okx"],
        counterValueCurrency: "usd",
        quotesInput: expect.objectContaining({
          sendCurrencyId: "bitcoin",
          receiveCurrencyId: "ethereum",
        }),
      }),
      { forceRefetch: true, subscribe: false },
    );
  });

  it("returns an empty result when the endpoint yields no data", async () => {
    dispatch.mockResolvedValue({ data: { rawQuotes: [], providerErrors: [] } });

    await expect(fetchQuotes(makeArgs(), "usd")).resolves.toEqual({
      rawQuotes: [],
      providerErrors: [],
    });
  });

  it("rethrows transport errors surfaced by the endpoint", async () => {
    const error = { status: "FETCH_ERROR", error: "network down" };
    dispatch.mockResolvedValue({ error });

    await expect(fetchQuotes(makeArgs(), "usd")).rejects.toBe(error);
  });

  it("flattens caller-supplied headers before dispatching", async () => {
    dispatch.mockResolvedValue({ data: { rawQuotes: [], providerErrors: [] } });
    const args: Parameters<typeof fetchQuotes>[0] = {
      ...makeArgs(),
      headers: [["x-foo", "bar"]],
    };

    await fetchQuotes(args, "usd");

    expect(initiateMock).toHaveBeenCalledWith(
      expect.objectContaining({ customHeaders: { "x-foo": "bar" } }),
      { forceRefetch: true, subscribe: false },
    );
  });
});
