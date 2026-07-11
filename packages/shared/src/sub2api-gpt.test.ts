import assert from "node:assert/strict";
import test from "node:test";

import { calculateGptGroupQuotas } from "./sub2api-gpt.js";

test("GPT 分组按 7 天剩余额度计算并保留 5 小时辅助额度", () => {
  const [group] = calculateGptGroupQuotas(
    [{ id: 7, name: "GPT Plus", status: "active" }],
    [
      {
        id: 1,
        name: "a",
        status: "active",
        schedulable: true,
        groupIds: [7],
        planType: "plus",
        usageUpdatedAt: "2026-07-11T02:55:00.000Z",
        fiveHourUsedPercentage: 20,
        sevenDayUsedPercentage: 30,
      },
      {
        id: 2,
        name: "b",
        status: "active",
        schedulable: true,
        groupIds: [7],
        planType: "plus",
        usageUpdatedAt: "2026-07-11T02:50:00.000Z",
        fiveHourUsedPercentage: 60,
        sevenDayUsedPercentage: 50,
      },
    ],
    {
      lowQuotaThreshold: 55,
      freshnessMaxAgeMs: 2 * 60 * 60 * 1_000,
      now: new Date("2026-07-11T03:00:00.000Z"),
    },
  );

  assert.equal(group?.quota?.averageRemainingPercentage, 60);
  assert.equal(group?.quota?.equivalentAvailableAccounts, 1.2);
  assert.equal(group?.quota?.lowQuotaAccountCount, 1);
  assert.equal(group?.quota?.fiveHourAverageRemainingPercentage, 60);
});

test("混合套餐分组不生成误导性的统一额度", () => {
  const [group] = calculateGptGroupQuotas(
    [{ id: 9, name: "混合组", status: "active" }],
    [
      {
        id: 1,
        name: "plus",
        status: "active",
        schedulable: true,
        groupIds: [9],
        planType: "plus",
        usageUpdatedAt: "2026-07-11T03:00:00.000Z",
        sevenDayUsedPercentage: 10,
      },
      {
        id: 2,
        name: "pro",
        status: "active",
        schedulable: true,
        groupIds: [9],
        planType: "pro",
        usageUpdatedAt: "2026-07-11T03:00:00.000Z",
        sevenDayUsedPercentage: 20,
      },
    ],
    {
      lowQuotaThreshold: 20,
      freshnessMaxAgeMs: 60_000,
      now: new Date("2026-07-11T03:00:00.000Z"),
    },
  );

  assert.equal(group?.hasMixedSubscriptionTypes, true);
  assert.equal(group?.quota, undefined);
  assert.deepEqual(
    group?.planBreakdown.map((item) => item.subscriptionType),
    ["plus", "pro"],
  );
});

test("过期、停用和缺少额度的账号计入不可用账号", () => {
  const [group] = calculateGptGroupQuotas(
    [{ id: 3, name: "GPT Pro", status: "active" }],
    [
      {
        id: 1,
        name: "fresh",
        status: "active",
        schedulable: true,
        groupIds: [3],
        planType: "pro",
        usageUpdatedAt: "2026-07-11T03:00:00.000Z",
        sevenDayUsedPercentage: 25,
      },
      {
        id: 2,
        name: "stale",
        status: "active",
        schedulable: true,
        groupIds: [3],
        planType: "pro",
        usageUpdatedAt: "2026-07-11T00:00:00.000Z",
        sevenDayUsedPercentage: 10,
      },
      {
        id: 3,
        name: "disabled",
        status: "inactive",
        schedulable: false,
        groupIds: [3],
        planType: "pro",
        usageUpdatedAt: "2026-07-11T03:00:00.000Z",
        sevenDayUsedPercentage: 10,
      },
    ],
    {
      lowQuotaThreshold: 20,
      freshnessMaxAgeMs: 2 * 60 * 60 * 1_000,
      now: new Date("2026-07-11T03:00:00.000Z"),
    },
  );

  assert.equal(group?.quota?.eligibleAccountCount, 1);
  assert.equal(group?.quota?.unavailableAccountCount, 2);
  assert.equal(group?.quota?.averageRemainingPercentage, 75);
});
