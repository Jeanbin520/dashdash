import {
  calculatePercentagePoolSummary,
  type AccountStatus,
  type PercentagePoolAccountSnapshot,
  type PercentagePoolSummary,
  type SubscriptionType,
} from "./resource-pool.js";

export interface Sub2ApiGptGroup {
  id: number;
  name: string;
  status: "active" | "inactive";
}

export interface Sub2ApiGptAccount {
  id: number;
  name: string;
  status: "active" | "inactive" | "error";
  schedulable: boolean;
  groupIds: readonly number[];
  planType?: string;
  usageUpdatedAt?: string;
  fiveHourUsedPercentage?: number;
  sevenDayUsedPercentage?: number;
}

export interface GptPlanQuotaSummary extends PercentagePoolSummary {
  subscriptionType: SubscriptionType;
  upstreamPlanTypes: string[];
  quotaWindow: "7d";
  fiveHourAverageRemainingPercentage?: number;
  lastObservedAt?: string;
}

export interface GptGroupQuotaSummary {
  externalGroupId: string;
  name: string;
  status: "active" | "inactive";
  accountCount: number;
  hasMixedSubscriptionTypes: boolean;
  quota?: GptPlanQuotaSummary;
  planBreakdown: GptPlanQuotaSummary[];
}

export interface CalculateGptGroupQuotasOptions {
  lowQuotaThreshold: number;
  freshnessMaxAgeMs: number;
  now?: Date;
}

interface AccountWithPlan {
  account: Sub2ApiGptAccount;
  subscriptionType: SubscriptionType;
  upstreamPlanType: string;
}

export function normalizeGptSubscriptionType(
  planType?: string,
): SubscriptionType {
  const normalized = planType?.trim().toLowerCase();

  if (normalized === "plus") return "plus";
  if (normalized === "pro") return "pro";
  if (
    normalized === "team" ||
    normalized === "business" ||
    normalized === "self_serve_business_usage_based"
  ) {
    return "team";
  }

  return "custom";
}

export function calculateGptGroupQuotas(
  groups: readonly Sub2ApiGptGroup[],
  accounts: readonly Sub2ApiGptAccount[],
  options: CalculateGptGroupQuotasOptions,
): GptGroupQuotaSummary[] {
  validateOptions(options);
  const now = options.now ?? new Date();

  return groups.map((group) => {
    const groupAccounts = accounts.filter((account) =>
      account.groupIds.includes(group.id),
    );
    const accountsWithPlans: AccountWithPlan[] = groupAccounts.map(
      (account) => ({
        account,
        subscriptionType: normalizeGptSubscriptionType(account.planType),
        upstreamPlanType: account.planType?.trim() || "unknown",
      }),
    );
    const subscriptionTypes = [
      ...new Set(accountsWithPlans.map((item) => item.subscriptionType)),
    ];
    const planBreakdown = subscriptionTypes.map((subscriptionType) =>
      summarizePlan(
        accountsWithPlans.filter(
          (item) => item.subscriptionType === subscriptionType,
        ),
        subscriptionType,
        now,
        options,
      ),
    );

    return {
      externalGroupId: String(group.id),
      name: group.name,
      status: group.status,
      accountCount: groupAccounts.length,
      hasMixedSubscriptionTypes: planBreakdown.length > 1,
      quota: planBreakdown.length === 1 ? planBreakdown[0] : undefined,
      planBreakdown,
    };
  });
}

function summarizePlan(
  items: readonly AccountWithPlan[],
  subscriptionType: SubscriptionType,
  now: Date,
  options: CalculateGptGroupQuotasOptions,
): GptPlanQuotaSummary {
  const weeklySnapshots = items.map(({ account }) =>
    toSnapshot(account, account.sevenDayUsedPercentage, now, options),
  );
  const fiveHourSummary = calculatePercentagePoolSummary(
    items.map(({ account }) =>
      toSnapshot(account, account.fiveHourUsedPercentage, now, options),
    ),
    options.lowQuotaThreshold,
  );
  const observedTimes = items
    .map(({ account }) => account.usageUpdatedAt)
    .filter((value): value is string => value !== undefined)
    .map((value) => new Date(value))
    .filter((value) => Number.isFinite(value.getTime()));

  return {
    ...calculatePercentagePoolSummary(
      weeklySnapshots,
      options.lowQuotaThreshold,
    ),
    subscriptionType,
    upstreamPlanTypes: [
      ...new Set(items.map(({ upstreamPlanType }) => upstreamPlanType)),
    ].sort(),
    quotaWindow: "7d",
    fiveHourAverageRemainingPercentage:
      fiveHourSummary.averageRemainingPercentage,
    lastObservedAt:
      observedTimes.length === 0
        ? undefined
        : new Date(
            Math.max(...observedTimes.map((value) => value.getTime())),
          ).toISOString(),
  };
}

function toSnapshot(
  account: Sub2ApiGptAccount,
  usedPercentage: number | undefined,
  now: Date,
  options: CalculateGptGroupQuotasOptions,
): PercentagePoolAccountSnapshot {
  return {
    status: mapAccountStatus(account),
    isFresh: isFresh(
      account.usageUpdatedAt,
      now,
      options.freshnessMaxAgeMs,
    ),
    remainingPercentage:
      usedPercentage === undefined ? undefined : 100 - usedPercentage,
  };
}

function mapAccountStatus(account: Sub2ApiGptAccount): AccountStatus {
  if (account.status === "error") return "invalid";
  if (account.status === "inactive" || !account.schedulable) return "disabled";
  return "active";
}

function isFresh(
  observedAt: string | undefined,
  now: Date,
  freshnessMaxAgeMs: number,
): boolean {
  if (!observedAt) return false;
  const observedTime = new Date(observedAt).getTime();
  const age = now.getTime() - observedTime;
  return Number.isFinite(observedTime) && age >= 0 && age <= freshnessMaxAgeMs;
}

function validateOptions(options: CalculateGptGroupQuotasOptions): void {
  if (
    !Number.isFinite(options.freshnessMaxAgeMs) ||
    options.freshnessMaxAgeMs < 0
  ) {
    throw new RangeError("freshnessMaxAgeMs 必须是大于或等于 0 的有限数值。");
  }
}
