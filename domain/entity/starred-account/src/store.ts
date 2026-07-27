import type { StarredAccountState } from "./slice";

export const initialStarredAccountState: StarredAccountState = new Set();

export const isStarredAccountSelector = (
  state: StarredAccountState,
  { accountId }: { accountId: string },
): boolean => state.has(accountId);
