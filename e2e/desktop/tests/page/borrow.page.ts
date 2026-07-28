import { expect, type Page } from "@playwright/test";
import { step } from "tests/misc/reporters/step";
import { WebViewAppPage } from "./webViewApp.page";

export class BorrowPage extends WebViewAppPage {
  protected readonly webviewIdentifier = "borrow";

  // --- Routes ---
  private readonly borrowRoutePattern = /\/borrow/;
  private readonly simulateLoanRoutePattern = /\/loan\/simulate-loan/;
  private readonly loanExecutionRoutePattern = /\/loan\/loan-execution/;
  private readonly loanOverviewRoutePattern = /\/loanoverview\//;
  private readonly repayExecutionRoutePattern = /\/forms\/repay\/[^/]+\/execute/;
  private readonly withdrawOverviewRoutePattern = /\/withdrawoverview\//;
  private readonly withdrawExecutionRoutePattern = /\/forms\/withdraw\//;

  // --- Borrow webview test ids (mirror borrow-live-app/packages/features/src/testIds.ts) ---
  private readonly introModalId = "borrow-intro-modal";
  private readonly introModalTitleId = "borrow-intro-modal-title";
  private readonly simulateMyLoanButtonId = "borrow-simulate-my-loan-button";
  private readonly simulateLoanScreenId = "borrow-simulate-loan-screen";
  private readonly loanAmountInputId = "borrow-loan-amount-input";
  private readonly simulateContinueButtonId = "borrow-simulate-continue-button";
  private readonly getNewLoanButtonId = "borrow-get-new-loan-button";
  private readonly loanExecutionScreenId = "borrow-loan-execution-screen";
  private readonly giveApprovalButtonId = "give-approval-button";
  private readonly authorizeDepositingButtonId = "borrow-authorize-depositing-button";
  private readonly authorizeBorrowingButtonId = "borrow-authorize-borrowing-button";
  private readonly step1AccessApprovedId = "borrow-step-1-access-approved";
  private readonly step2DepositDoneId = "borrow-step-2-deposit-done";
  private readonly step3BorrowDoneId = "borrow-step-3-borrow-done";
  private readonly executionErrorId = "borrow-execution-error";
  private readonly onChainFailedMessageId = "borrow-on-chain-failed-message";
  private readonly loanCompletionCardId = "borrow-loan-completion-card";
  private readonly viewMyLoanButtonId = "borrow-view-my-loan-button";
  private readonly yourLoansTitleId = "borrow-your-loans-title";
  private readonly loansDashboardId = "borrow-loans-dashboard";
  private readonly repayButtonId = "borrow-repay-button";
  private readonly loanOverviewScreenId = "borrow-loan-overview-screen";
  private readonly loanDashboardRowId = "borrow-loan-dashboard-row";
  private readonly repayModalId = "borrow-repay-modal";
  private readonly repayAmountInputId = "borrow-repay-amount-input";
  private readonly repayInFullButtonId = "borrow-repay-in-full-button";
  private readonly repayContinueButtonId = "borrow-repay-continue-button";
  private readonly repayExecutionScreenId = "borrow-repay-execution-screen";
  private readonly authorizeRepayButtonId = "borrow-authorize-repay-button";
  private readonly repayStep1AccessApprovedId = "borrow-repay-step-1-access-approved";
  private readonly repayStep2RepayDoneId = "borrow-repay-step-2-repay-done";
  private readonly repayCompletionCardId = "borrow-repay-completion-card";
  private readonly withdrawOverviewScreenId = "borrow-withdraw-overview-screen";
  private readonly withdrawCollateralButtonId = "borrow-withdraw-collateral-button";
  private readonly withdrawExecutionScreenId = "borrow-withdraw-execution-screen";
  private readonly authorizeWithdrawButtonId = "borrow-authorize-withdraw-button";
  private readonly withdrawStepDoneId = "borrow-withdraw-step-done";
  private readonly withdrawCompletionCardId = "borrow-withdraw-completion-card";
  private readonly backToMyLoansButtonId = "borrow-back-to-my-loans-button";

  private readonly hostContinueLabel = "Continue";
  private readonly hostSignModalTextPattern = /Approve token|Sign transaction/i;
  private readonly mainnetFundingHint =
    "Ensure the test account holds enough wBTC collateral and ETH for mainnet gas.";

  /** Partner polls mainnet after each signed tx; deposit step ETA is ~2 min. */
  private readonly executionStepTimeoutMs = 240_000;

  // --- Host (LLD) locators ---
  private readonly signAmountContinueBtn = this.page.locator(
    "#sign-transaction-amount-continue-button",
  );
  private readonly signSummaryContinueBtn = this.page.locator("#sign-summary-continue-button");
  private readonly deviceTransactionConfirm = this.page.getByTestId(
    "device-action-transaction-confirm",
  );
  private readonly modalBackdrop = this.page.getByTestId("modal-backdrop");
  private readonly hostSignModal = this.page.getByTestId("modal-container").filter({
    has: this.page.getByText(this.hostSignModalTextPattern),
  });
  private readonly hostSignModalContinueBtn = this.hostSignModal.getByRole("button", {
    name: this.hostContinueLabel,
  });

  // --- Borrow webview locators (scoped to the live-app window) ---
  private introModal(webview: Page) {
    return webview.getByTestId(this.introModalId);
  }

  private introModalTitle(webview: Page) {
    return webview.getByTestId(this.introModalTitleId);
  }

  private simulateMyLoanBtn(webview: Page) {
    return webview.getByTestId(this.simulateMyLoanButtonId);
  }

  private simulateLoanScreen(webview: Page) {
    return webview.getByTestId(this.simulateLoanScreenId);
  }

  private loanAmountInput(webview: Page) {
    return webview.getByTestId(this.loanAmountInputId);
  }

  private simulateContinueBtn(webview: Page) {
    return webview.getByTestId(this.simulateContinueButtonId);
  }

  private getNewLoanBtn(webview: Page) {
    return webview.getByTestId(this.getNewLoanButtonId);
  }

  private loanExecutionScreen(webview: Page) {
    return webview.getByTestId(this.loanExecutionScreenId);
  }

  private giveApprovalBtn(webview: Page) {
    return webview.getByTestId(this.giveApprovalButtonId);
  }

  private authorizeDepositingBtn(webview: Page) {
    return webview.getByTestId(this.authorizeDepositingButtonId);
  }

  private authorizeBorrowingBtn(webview: Page) {
    return webview.getByTestId(this.authorizeBorrowingButtonId);
  }

  private executionFlowEntryBtn(webview: Page) {
    return this.giveApprovalBtn(webview).or(this.authorizeDepositingBtn(webview));
  }

  private executionErrorDialog(webview: Page) {
    return webview.getByTestId(this.executionErrorId);
  }

  private onChainFailedMessage(webview: Page) {
    return webview.getByTestId(this.onChainFailedMessageId);
  }

  private executionError(webview: Page) {
    return this.executionErrorDialog(webview).or(this.onChainFailedMessage(webview));
  }

  private async isExecutionErrorVisible(webview: Page): Promise<boolean> {
    return (
      (await this.executionErrorDialog(webview).isVisible()) ||
      (await this.onChainFailedMessage(webview).isVisible())
    );
  }

  private executionStepDone(webview: Page, doneTestId: string) {
    return webview.getByTestId(doneTestId);
  }

  private loanCompletionCard(webview: Page) {
    return webview.getByTestId(this.loanCompletionCardId);
  }

  private viewMyLoanBtn(webview: Page) {
    return webview.getByTestId(this.viewMyLoanButtonId);
  }

  private yourLoansHeading(webview: Page) {
    return webview.getByTestId(this.yourLoansTitleId);
  }

  private loanSuccessIndicator(webview: Page) {
    return this.loanCompletionCard(webview)
      .or(this.viewMyLoanBtn(webview))
      .or(this.yourLoansHeading(webview))
      .or(this.getNewLoanBtn(webview));
  }

  private borrowStepCompleteIndicator(webview: Page) {
    return webview
      .getByTestId(this.step3BorrowDoneId)
      .or(this.loanCompletionCard(webview))
      .or(this.viewMyLoanBtn(webview))
      .or(this.executionError(webview));
  }

  private loansDashboard(webview: Page) {
    return webview.getByTestId(this.loansDashboardId);
  }

  private loanDashboardRow(webview: Page) {
    return webview.getByTestId(this.loanDashboardRowId);
  }

  private loanOverviewScreen(webview: Page) {
    return webview.getByTestId(this.loanOverviewScreenId);
  }

  private repayBtn(webview: Page) {
    return webview.getByTestId(this.repayButtonId);
  }

  private repayModal(webview: Page) {
    return webview.getByTestId(this.repayModalId);
  }

  private repayInFullBtn(webview: Page) {
    return webview.getByTestId(this.repayInFullButtonId);
  }

  private repayContinueBtn(webview: Page) {
    return webview.getByTestId(this.repayContinueButtonId);
  }

  private repayExecutionScreen(webview: Page) {
    return webview.getByTestId(this.repayExecutionScreenId);
  }

  private authorizeRepayBtn(webview: Page) {
    return webview.getByTestId(this.authorizeRepayButtonId);
  }

  private repayStepCompleteIndicator(webview: Page) {
    return webview
      .getByTestId(this.repayStep2RepayDoneId)
      .or(webview.getByTestId(this.repayCompletionCardId))
      .or(this.viewMyLoanBtn(webview))
      .or(this.executionError(webview));
  }

  private withdrawOverviewScreen(webview: Page) {
    return webview.getByTestId(this.withdrawOverviewScreenId);
  }

  private withdrawCollateralBtn(webview: Page) {
    return webview.getByTestId(this.withdrawCollateralButtonId);
  }

  private withdrawExecutionScreen(webview: Page) {
    return webview.getByTestId(this.withdrawExecutionScreenId);
  }

  private authorizeWithdrawBtn(webview: Page) {
    return webview.getByTestId(this.authorizeWithdrawButtonId);
  }

  private withdrawStepCompleteIndicator(webview: Page) {
    return webview
      .getByTestId(this.withdrawStepDoneId)
      .or(webview.getByTestId(this.withdrawCompletionCardId))
      .or(webview.getByTestId(this.backToMyLoansButtonId))
      .or(this.executionError(webview));
  }

  private backToMyLoansBtn(webview: Page) {
    return webview.getByTestId(this.backToMyLoansButtonId);
  }

  @step("Go and wait for Borrow cold-start entry")
  async goAndWaitForBorrowColdStart(entryFn: () => Promise<void>) {
    this._webviewPage = undefined;
    await entryFn();
    await expect(this.page).toHaveURL(this.borrowRoutePattern);
    await this.getWebView();
  }

  @step("Go and wait for Borrow app simulate-loan screen")
  async goAndWaitForBorrowToBeReady(entryFn: () => Promise<void>) {
    this._webviewPage = undefined;
    await entryFn();
    await expect(this.page).toHaveURL(this.borrowRoutePattern);
    const webview = await this.getWebView();
    await this.ensureSimulateLoanScreen(webview);
  }

  private async ensureSimulateLoanScreen(webview: Page) {
    if (this.simulateLoanRoutePattern.test(webview.url())) {
      await expect(this.simulateLoanScreen(webview)).toBeVisible();
      return;
    }

    const introModal = this.introModal(webview);
    const getNewLoanButton = this.getNewLoanBtn(webview);
    await expect(introModal.or(getNewLoanButton)).toBeVisible({ timeout: 60_000 });

    if (await introModal.isVisible()) {
      await this.clickSimulateMyLoan();
      return;
    }

    await getNewLoanButton.click();
    await expect(webview).toHaveURL(this.simulateLoanRoutePattern);
    await expect(this.simulateLoanScreen(webview)).toBeVisible();
  }

  @step("Dismiss intro modal if shown and wait for simulate screen")
  async dismissIntroModalIfVisible() {
    const webview = await this.getWebView();
    if (await this.introModal(webview).isVisible()) {
      await this.clickSimulateMyLoan();
      return;
    }
    await expect(this.loanAmountInput(webview)).toBeVisible();
  }

  @step("Verify Introducing Crypto Loan modal is visible")
  async verifyIntroModalVisible() {
    const webview = await this.getWebView();
    await expect(this.introModal(webview)).toBeVisible();
    await expect(this.introModalTitle(webview)).toBeVisible();
  }

  @step("Click Simulate my loan")
  async clickSimulateMyLoan() {
    const webview = await this.getWebView();
    const introModal = this.introModal(webview);
    await this.simulateMyLoanBtn(webview).click();
    await expect(introModal).toBeHidden();
    await expect(this.loanAmountInput(webview)).toBeVisible();
  }

  @step("Type loan amount")
  async typeLoanAmount(digits: string) {
    const webview = await this.getWebView();
    const amountInput = this.loanAmountInput(webview);
    await expect(amountInput).toBeVisible();
    await amountInput.click();
    await amountInput.fill(digits);
  }

  @step("Click Continue")
  async clickContinue() {
    const webview = await this.getWebView();
    const continueButton = this.simulateContinueBtn(webview);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
  }

  @step("Verify loan execution flow is visible")
  async expectExecutionFlowVisible() {
    const webview = await this.getWebView();
    await expect(webview).toHaveURL(this.loanExecutionRoutePattern);
    await expect(this.loanExecutionScreen(webview)).toBeVisible();
    await expect(this.executionFlowEntryBtn(webview)).toBeVisible();
  }

  @step("Check if Give approval step is required")
  async isGiveApprovalRequired() {
    const webview = await this.getWebView();
    const giveApproval = this.giveApprovalBtn(webview);
    const authorizeDepositing = this.authorizeDepositingBtn(webview);
    await expect(giveApproval.or(authorizeDepositing)).toBeVisible({ timeout: 60_000 });
    return giveApproval.isVisible();
  }

  @step("Click Give approval")
  async clickGiveApproval() {
    const webview = await this.getWebView();
    await this.giveApprovalBtn(webview).click();
  }

  /**
   * Swap uses #sign-summary-continue-button; borrow host modal often only exposes role-based
   * Continue.
   */
  @step("Click Continue on host sign modal")
  async clickSignSummaryContinue() {
    await expect(this.hostSignModal).toBeVisible();

    for (let step = 0; step < 2; step++) {
      if (await this.signSummaryContinueBtn.isVisible()) {
        await expect(this.signSummaryContinueBtn).toBeEnabled();
        await this.signSummaryContinueBtn.click();
        await expect(this.deviceTransactionConfirm.or(this.hostSignModalContinueBtn)).toBeVisible();
        return;
      }

      if (step === 0 && (await this.signAmountContinueBtn.isVisible())) {
        await expect(this.signAmountContinueBtn).toBeEnabled();
        await this.signAmountContinueBtn.click();
        await expect(this.signSummaryContinueBtn.or(this.hostSignModalContinueBtn)).toBeVisible();
        continue;
      }

      await expect(this.hostSignModalContinueBtn).toBeVisible();
      await expect(this.hostSignModalContinueBtn).toBeEnabled();
      await this.hostSignModalContinueBtn.click();

      if (step === 0) {
        await expect(
          this.signSummaryContinueBtn
            .or(this.hostSignModalContinueBtn)
            .or(this.deviceTransactionConfirm),
        ).toBeVisible();
        continue;
      }
      return;
    }

    throw new Error("Host sign modal Continue button not found after fee/review steps");
  }

  @step("Wait for host device validation screen")
  async waitForHostDeviceValidation() {
    await expect(this.deviceTransactionConfirm).toBeVisible();
  }

  @step("Wait for host sign modal to close")
  async waitForHostSignModalClosed() {
    await expect(this.hostSignModal).toBeHidden({ timeout: 120_000 });
    await expect(this.modalBackdrop).toBeHidden({ timeout: 120_000 });
  }

  private async expectExecutionStepOutcome(webview: Page, doneTestId: string, stepLabel: string) {
    const done = this.executionStepDone(webview, doneTestId);
    const error = this.executionError(webview);

    await expect(done.or(error)).toBeVisible({ timeout: this.executionStepTimeoutMs });

    if (await this.isExecutionErrorVisible(webview)) {
      throw new Error(
        `Borrow execution step failed in webview (${stepLabel}, ${doneTestId}). ${this.mainnetFundingHint}`,
      );
    }
  }

  @step("Wait for Step 1 approval to complete")
  async expectApprovalStepCompleted() {
    const webview = await this.getWebView();
    await this.expectExecutionStepOutcome(webview, this.step1AccessApprovedId, "Step 1 approval");
    await expect(this.authorizeDepositingBtn(webview)).toBeEnabled();
  }

  @step("Wait for Step 2 deposit to complete")
  async expectDepositStepCompleted() {
    const webview = await this.getWebView();
    await this.expectExecutionStepOutcome(webview, this.step2DepositDoneId, "Step 2 deposit");
    await expect(this.authorizeBorrowingBtn(webview)).toBeEnabled();
  }

  @step("Wait for Step 3 borrow to complete")
  async expectBorrowStepCompleted() {
    const webview = await this.getWebView();
    await expect(this.borrowStepCompleteIndicator(webview).first()).toBeVisible({
      timeout: this.executionStepTimeoutMs,
    });

    if (await this.isExecutionErrorVisible(webview)) {
      throw new Error(`Borrow Step 3 failed in webview. ${this.mainnetFundingHint}`);
    }
  }

  @step("Click Authorize depositing")
  async clickAuthorizeDepositing() {
    const webview = await this.getWebView();
    const authorizeButton = this.authorizeDepositingBtn(webview);
    await expect(authorizeButton).toBeEnabled();
    await authorizeButton.click();
  }

  @step("Click Authorize borrowing")
  async clickAuthorizeBorrowing() {
    const webview = await this.getWebView();
    const authorizeButton = this.authorizeBorrowingBtn(webview);
    await expect(authorizeButton).toBeEnabled();
    await authorizeButton.click();
  }

  @step("Verify loan success screen")
  async expectLoanSuccess() {
    const webview = await this.getWebView();
    await expect(this.loanSuccessIndicator(webview).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  @step("Go and wait for Borrow hot-start dashboard")
  async goAndWaitForBorrowHotStart(entryFn: () => Promise<void>) {
    this._webviewPage = undefined;
    await entryFn();
    await expect(this.page).toHaveURL(this.borrowRoutePattern);
    const webview = await this.getWebView();
    await expect(this.loansDashboard(webview)).toBeVisible({ timeout: 60_000 });
  }

  @step("Click the first loan on the dashboard")
  async clickFirstLoanDashboardRow() {
    const webview = await this.getWebView();
    const row = this.loanDashboardRow(webview).first();
    await expect(row).toBeVisible();
    await row.click();
  }

  @step("Verify loan overview screen is visible")
  async expectLoanOverviewVisible() {
    const webview = await this.getWebView();
    await expect(webview).toHaveURL(this.loanOverviewRoutePattern);
    await expect(this.loanOverviewScreen(webview)).toBeVisible();
  }

  @step("Click Repay on loan overview")
  async clickRepay() {
    const webview = await this.getWebView();
    const repayButton = this.repayBtn(webview);
    await expect(repayButton).toBeEnabled();
    await repayButton.click();
    await expect(this.repayModal(webview)).toBeVisible();
  }

  @step("Repay in full and continue to execution")
  async submitRepayInFull() {
    const webview = await this.getWebView();
    const repayInFullButton = this.repayInFullBtn(webview);
    await expect(repayInFullButton).toBeEnabled();
    await repayInFullButton.click();
    const continueButton = this.repayContinueBtn(webview);
    await expect(continueButton).toBeEnabled({ timeout: 30_000 });
    await continueButton.click();
    await expect(this.repayModal(webview)).toBeHidden();
    await expect(webview).toHaveURL(this.repayExecutionRoutePattern);
    await expect(this.repayExecutionScreen(webview)).toBeVisible();
  }

  @step("Check if repay Give approval step is required")
  async isRepayGiveApprovalRequired() {
    const webview = await this.getWebView();
    const giveApproval = this.giveApprovalBtn(webview);
    const authorizeRepay = this.authorizeRepayBtn(webview);
    await expect(giveApproval.or(authorizeRepay)).toBeVisible({ timeout: 60_000 });
    return giveApproval.isVisible();
  }

  @step("Click Authorize repayment")
  async clickAuthorizeRepay() {
    const webview = await this.getWebView();
    const authorizeButton = this.authorizeRepayBtn(webview);
    await expect(authorizeButton).toBeEnabled();
    await authorizeButton.click();
  }

  @step("Wait for repay Step 1 approval to complete")
  async expectRepayApprovalStepCompleted() {
    const webview = await this.getWebView();
    await this.expectExecutionStepOutcome(
      webview,
      this.repayStep1AccessApprovedId,
      "Repay Step 1 approval",
    );
    await expect(this.authorizeRepayBtn(webview)).toBeEnabled();
  }

  @step("Wait for repay execution to complete")
  async expectRepayExecutionCompleted() {
    const webview = await this.getWebView();
    await expect(this.repayStepCompleteIndicator(webview).first()).toBeVisible({
      timeout: this.executionStepTimeoutMs,
    });

    if (await this.isExecutionErrorVisible(webview)) {
      throw new Error(`Repay execution failed in webview. ${this.mainnetFundingHint}`);
    }
  }

  @step("Verify repay success screen")
  async expectRepaySuccess() {
    const webview = await this.getWebView();
    await expect(webview.getByTestId(this.repayCompletionCardId)).toBeVisible({
      timeout: 60_000,
    });
    await expect(this.viewMyLoanBtn(webview)).toBeVisible();
  }

  @step("Verify withdraw overview screen is visible")
  async expectWithdrawOverviewVisible() {
    const webview = await this.getWebView();
    await expect(webview).toHaveURL(this.withdrawOverviewRoutePattern);
    await expect(this.withdrawOverviewScreen(webview)).toBeVisible();
  }

  @step("Click Withdraw collateral on overview")
  async clickWithdrawCollateral() {
    const webview = await this.getWebView();
    const withdrawButton = this.withdrawCollateralBtn(webview);
    await expect(withdrawButton).toBeEnabled();
    await withdrawButton.click();
    await expect(webview).toHaveURL(this.withdrawExecutionRoutePattern);
    await expect(this.withdrawExecutionScreen(webview)).toBeVisible();
  }

  @step("Click Authorize withdrawal")
  async clickAuthorizeWithdraw() {
    const webview = await this.getWebView();
    const authorizeButton = this.authorizeWithdrawBtn(webview);
    await expect(authorizeButton).toBeEnabled();
    await authorizeButton.click();
  }

  @step("Wait for withdraw execution to complete")
  async expectWithdrawExecutionCompleted() {
    const webview = await this.getWebView();
    await expect(this.withdrawStepCompleteIndicator(webview).first()).toBeVisible({
      timeout: this.executionStepTimeoutMs,
    });

    if (await this.isExecutionErrorVisible(webview)) {
      throw new Error(`Withdraw execution failed in webview. ${this.mainnetFundingHint}`);
    }
  }

  @step("Verify withdraw success screen")
  async expectWithdrawSuccess() {
    const webview = await this.getWebView();
    await expect(webview.getByTestId(this.withdrawCompletionCardId)).toBeVisible({
      timeout: 60_000,
    });
    await expect(this.backToMyLoansBtn(webview)).toBeVisible();
  }

  @step("Click Back to my loans")
  async clickBackToMyLoans() {
    const webview = await this.getWebView();
    await this.backToMyLoansBtn(webview).click();
    await expect(this.loansDashboard(webview)).toBeVisible({ timeout: 60_000 });
  }
}
