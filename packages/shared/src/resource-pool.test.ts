import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePercentagePoolSummary,
  validateResourcePoolDraft,
} from "./resource-pool.js";

test("百分比资源池只归集有效且数据新鲜的账号", () => {
  const summary = calculatePercentagePoolSummary(
    [
      { status: "active", isFresh: true, remainingPercentage: 80 },
      { status: "active", isFresh: true, remainingPercentage: 60 },
      { status: "disabled", isFresh: true, remainingPercentage: 90 },
      { status: "active", isFresh: false, remainingPercentage: 40 },
    ],
    65,
  );

  assert.deepEqual(summary, {
    totalAccountCount: 4,
    eligibleAccountCount: 2,
    unavailableAccountCount: 2,
    averageRemainingPercentage: 70,
    equivalentAvailableAccounts: 1.4,
    lowQuotaAccountCount: 1,
    minimumRemainingPercentage: 60,
  });
});

test("百分比资源池不接受伪造的总额度", () => {
  const errors = validateResourcePoolDraft({
    source: "sub2api",
    externalGroupId: "gpt-plus",
    name: "GPT Plus",
    meterType: "percentage_pool",
    totalQuota: 100_000,
  });

  assert.deepEqual(errors, ["percentage_pool 不得配置 totalQuota。"]);
});
