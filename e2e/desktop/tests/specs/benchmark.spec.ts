import { DEVICE_TAGS } from "tests/utils/tagsUtils";
import { test, expect, Page } from "@playwright/test";
import { step } from "tests/misc/reporters/step";

class MyPage {
  private readonly hardExpect = expect.configure({ timeout: 1_000, soft: false });
  private readonly softExpect = expect.configure({ timeout: 1_000, soft: true });

  @step("Hard pass")
  async hardExpectPass({ page }: { page: Page }) {
    await this.hardExpect(page).toHaveTitle("");
  }

  @step("Hard fail")
  async hardExpectFail({ page }: { page: Page }) {
    await this.hardExpect(page).toHaveTitle("failmehard");
  }

  @step("Soft pass")
  async softExpectPass({ page }: { page: Page }) {
    await this.softExpect(page).toHaveTitle("");
  }

  @step("Soft fail")
  async softExpectFail({ page }: { page: Page }) {
    await this.softExpect(page).toHaveTitle("failmesoft");
  }
}

const myPage = new MyPage();

test.describe("Hard assert", () => {
  test(
    "should pass",
    {
      tag: [...DEVICE_TAGS],
      annotation: {
        type: "TMS",
        description: "B2CQA-5532, B2CQA-5533",
      },
    },
    async ({ page }) => {
      await myPage.hardExpectPass({ page });
      await myPage.hardExpectPass({ page });
    },
  );

  test(
    "should hard fail and exit",
    {
      tag: [...DEVICE_TAGS],
      annotation: {
        type: "TMS",
        description: "B2CQA-5532, B2CQA-5533",
      },
    },
    async ({ page }) => {
      await myPage.hardExpectFail({ page });
      await myPage.hardExpectPass({ page });
    },
  );
});

test.describe("Mixed assert", () => {
  test(
    "should pass all expectations",
    {
      tag: [...DEVICE_TAGS],
      annotation: {
        type: "TMS",
        description: "B2CQA-5532, B2CQA-5533",
      },
    },
    async ({ page }) => {
      await myPage.softExpectPass({ page });
      await myPage.hardExpectPass({ page });
    },
  );

  test(
    "should soft fail and continue",
    {
      tag: [...DEVICE_TAGS],
      annotation: {
        type: "TMS",
        description: "B2CQA-5532, B2CQA-5533",
      },
    },
    async ({ page }) => {
      await myPage.softExpectFail({ page });
      await myPage.hardExpectPass({ page });
    },
  );

  test(
    "should hard fail and exit",
    {
      tag: [...DEVICE_TAGS],
      annotation: {
        type: "TMS",
        description: "B2CQA-5532, B2CQA-5533",
      },
    },
    async ({ page }) => {
      await myPage.hardExpectFail({ page });
      await myPage.softExpectPass({ page });
    },
  );

  test(
    "should soft fail multiple times and continue",
    {
      tag: [...DEVICE_TAGS],
      annotation: {
        type: "TMS",
        description: "B2CQA-5532, B2CQA-5533",
      },
    },
    async ({ page }) => {
      await myPage.softExpectFail({ page });
      await myPage.softExpectPass({ page });
      await myPage.softExpectFail({ page });
      await myPage.softExpectFail({ page });
      await myPage.hardExpectPass({ page });
    },
  );

  test(
    "should soft fail multiple times and fail and exit eventually",
    {
      tag: [...DEVICE_TAGS],
      annotation: {
        type: "TMS",
        description: "B2CQA-5532, B2CQA-5533",
      },
    },
    async ({ page }) => {
      await myPage.softExpectFail({ page });
      await myPage.softExpectFail({ page });
      await myPage.softExpectFail({ page });
      await myPage.hardExpectFail({ page });
    },
  );
});
