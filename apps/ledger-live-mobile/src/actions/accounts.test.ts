import type { Account, AccountRaw, AccountUserData, DerivationMode } from "@ledgerhq/types-live";
import type { UnknownAction } from "redux";
import { getCryptoCurrencyById } from "@ledgerhq/live-common/currencies/index";
import accountModel from "../logic/accountModel";
import { importStore } from "./accounts";

jest.mock("../logic/accountModel", () => ({
  __esModule: true,
  default: { decode: jest.fn() },
}));

const mockDecode = accountModel.decode as jest.Mock;

function fakeTuple(
  id: string,
  currencyId: string,
  derivationMode = "",
): [Account, AccountUserData] {
  const account = {
    id,
    type: "Account",
    currency: getCryptoCurrencyById(currencyId),
    derivationMode: derivationMode as DerivationMode,
    name: `name-${id}`,
  } as unknown as Account;
  const userData = { id, name: `custom-${id}`, starredIds: [] } as unknown as AccountUserData;
  return [account, userData];
}

async function runImportStore(rawAccounts: { active: { data: AccountRaw }[] }) {
  const dispatched: UnknownAction[] = [];
  const dispatch = (action: UnknownAction) => {
    dispatched.push(action);
    return action;
  };
  const thunk = await importStore(rawAccounts);
  thunk(dispatch as never);
  return dispatched;
}

async function initAction(rawAccounts: { active: { data: AccountRaw }[] }) {
  const dispatched = await runImportStore(rawAccounts);
  const action = dispatched.find(a => a.type === "INIT_ACCOUNTS");
  return action as unknown as {
    type: string;
    payload: { accounts: Account[]; accountsUserData: AccountUserData[] };
  };
}

describe("importStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("drops accounts whose currency has no coin module", async () => {
    mockDecode
      .mockResolvedValueOnce(fakeTuple("btc-1", "bitcoin"))
      .mockResolvedValueOnce(fakeTuple("eos-1", "eos")) // no coin-module loader → unsupported
      .mockResolvedValueOnce(fakeTuple("btc-2", "bitcoin"));

    const action = await initAction({
      active: [
        { data: { id: "btc-1" } as AccountRaw },
        { data: { id: "eos-1" } as AccountRaw },
        { data: { id: "btc-2" } as AccountRaw },
      ],
    });

    expect(action.type).toBe("INIT_ACCOUNTS");
    expect(action.payload.accounts.map((a: Account) => a.id)).toEqual(["btc-1", "btc-2"]);
    expect(action.payload.accountsUserData.map((u: AccountUserData) => u.id)).toEqual([
      "btc-1",
      "btc-2",
    ]);
  });

  it("keeps all accounts when every currency is supported", async () => {
    mockDecode
      .mockResolvedValueOnce(fakeTuple("btc-1", "bitcoin"))
      .mockResolvedValueOnce(fakeTuple("eth-1", "ethereum"));

    const action = await initAction({
      active: [{ data: { id: "btc-1" } as AccountRaw }, { data: { id: "eth-1" } as AccountRaw }],
    });

    expect(action.payload.accounts.map((a: Account) => a.id)).toEqual(["btc-1", "eth-1"]);
  });

  it("drops accounts with an unsupported derivation mode", async () => {
    mockDecode
      .mockResolvedValueOnce(fakeTuple("btc-segwit", "bitcoin", ""))
      .mockResolvedValueOnce(fakeTuple("btc-legacy", "bitcoin", "unsupported_derivation_mode"));

    const action = await initAction({
      active: [
        { data: { id: "btc-segwit" } as AccountRaw },
        { data: { id: "btc-legacy" } as AccountRaw },
      ],
    });

    expect(action.payload.accounts.map((a: Account) => a.id)).toEqual(["btc-segwit"]);
  });

  it("also dispatches account name and starred initialization", async () => {
    mockDecode.mockResolvedValueOnce(fakeTuple("btc-1", "bitcoin"));

    const types = (await runImportStore({ active: [{ data: { id: "btc-1" } as AccountRaw }] })).map(
      a => a.type,
    );
    expect(types).toEqual([
      "INIT_ACCOUNTS",
      "accountNames/initFromUserData",
      "starredAccounts/initStarredFromIds",
    ]);
  });
});
