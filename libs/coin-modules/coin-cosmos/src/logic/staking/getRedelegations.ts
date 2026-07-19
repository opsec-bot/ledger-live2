import { StakingRedelegation } from "@ledgerhq/types-live";
import { getCryptoCurrencyById } from "@ledgerhq/ledger-wallet-framework/currencies";
import { CosmosAPI } from "../../network/Cosmos";

/**
 * A redelegation (source + destination validator) can't be modelled as a single getBalance `Stake`,
 * so it's fetched here for the `enrichStakingResources` hook — executed plus, on epoched chains, the
 * queued x/epoching ones.
 */
export async function getRedelegations(
  currencyId: string,
  address: string,
): Promise<StakingRedelegation[]> {
  const api = new CosmosAPI(currencyId);
  return api.getRedelegationsWithQueued(address, getCryptoCurrencyById(currencyId));
}
