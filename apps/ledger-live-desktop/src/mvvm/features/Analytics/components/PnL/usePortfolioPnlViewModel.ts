import { useCountervaluesState } from "@ledgerhq/live-countervalues-react";
import { usePortfolioPnL } from "@ledgerhq/wallet-pnl/hooks";
import { useSelector } from "LLD/hooks/redux";
import { shallowAccountsSelector } from "~/renderer/reducers/accounts";
import { counterValueCurrencySelector } from "~/renderer/reducers/settings";
import { buildPortfolioReturnCards } from "LLD/features/PnL/builders/buildPortfolioReturnCards";
import { usePnlViewModelBase } from "LLD/features/PnL/hooks/usePnlViewModelBase";
import { useFlexPortfolio } from "LLD/hooks/useFlexPortfolio";
import { buildFlexPnl, toBaseUnits } from "LLD/utils/flexMode";
import type { PnlViewModel } from "LLD/features/PnL/types";

export function usePortfolioPnlViewModel(): PnlViewModel {
  const accounts = useSelector(shallowAccountsSelector);
  const fiatCurrency = useSelector(counterValueCurrencySelector);
  const countervalues = useCountervaluesState();
  const { enabled: flexMode, portfolio: flexPortfolio } = useFlexPortfolio();

  const portfolioPnl = usePortfolioPnL(accounts, countervalues, fiatCurrency);

  // Otherwise the return cards would report the real cost basis and P/L next to
  // Flex Mode balances, which is where the numbers visibly stop adding up.
  const pnlData = flexMode
    ? buildFlexPnl(toBaseUnits(flexPortfolio.totalFiat, fiatCurrency.units[0]))
    : portfolioPnl;

  return usePnlViewModelBase({
    namespace: "pnl.portfolio",
    pnlData,
    accountsCount: accounts.length,
    buildCards: ({ unrealisedPnL, realisedPnL, totalPnL, formatFiat, t }) =>
      buildPortfolioReturnCards({
        unrealisedPnL,
        realisedPnL,
        totalPnL,
        formatFiat,
        t,
      }),
  });
}
