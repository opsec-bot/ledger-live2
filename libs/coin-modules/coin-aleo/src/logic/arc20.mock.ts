import type { TokenCurrency } from "@ledgerhq/ledger-wallet-framework/types";

/**
 * Stand-in for the ARC-20 entries of the not-yet-released CAL draft
 * https://github.com/LedgerHQ/crypto-assets/commit/c385249c9c98f1d1e4b115911ac0a44eac37af14
 *
 * `getCalTokens` falls back to these when the CAL lookup misses, so ARC-20 token
 * accounts are already visible. Delete this file (and its two usages) once CAL ships them.
 */
const ARC20_TOKENS = [
  { ticker: "ETH", name: "Ethereum", magnitude: 18 },
  { ticker: "SOL", name: "Solana", magnitude: 9 },
  { ticker: "USDC", name: "USD Coin", magnitude: 6 },
  { ticker: "USDT", name: "Tether USD", magnitude: 6 },
  { ticker: "WBTC", name: "Wrapped Bitcoin", magnitude: 8 },
];

const buildTokens = (parentCurrencyId: string, prefix: string): TokenCurrency[] =>
  ARC20_TOKENS.map(({ ticker, name, magnitude }) => {
    const slug = ticker.toLowerCase();

    return {
      type: "TokenCurrency",
      id: `${parentCurrencyId}/arc20/${prefix}${slug}`,
      contractAddress: `${prefix}arc20_${slug}.aleo`,
      parentCurrencyId,
      tokenType: "arc20",
      name,
      ticker,
      units: [{ name: ticker, code: ticker, magnitude }],
    };
  });

const MOCKED_TOKENS_BY_KEY = new Map<string, TokenCurrency>(
  [...buildTokens("aleo", ""), ...buildTokens("aleo_testnet", "test_")].map(token => [
    `${token.parentCurrencyId}:${token.contractAddress}`,
    token,
  ]),
);

export function findMockedArc20Token(
  currencyId: string,
  programName: string,
): TokenCurrency | undefined {
  return MOCKED_TOKENS_BY_KEY.get(`${currencyId}:${programName}`);
}
