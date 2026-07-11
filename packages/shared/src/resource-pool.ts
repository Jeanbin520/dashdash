export const RESOURCE_POOL_SOURCES = ["sub2api"] as const;

export type ResourcePoolSource = (typeof RESOURCE_POOL_SOURCES)[number];

export const METER_TYPES = [
  "percentage_pool",
  "weighted_requests",
  "requests",
  "token",
  "currency",
  "custom",
] as const;

export type MeterType = (typeof METER_TYPES)[number];

export const SUBSCRIPTION_TYPES = [
  "plus",
  "pro",
  "team",
  "coding_plan",
  "custom",
] as const;

export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

export const ACCOUNT_STATUSES = [
  "active",
  "disabled",
  "invalid",
  "sync_error",
  "unknown",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface ResourcePool {
  id: string;
  source: ResourcePoolSource;
  externalGroupId: string;
  name: string;
  meterType: MeterType;
  subscriptionType?: SubscriptionType;
  timezone: string;
  totalQuota?: number;
  quotaUnit?: string;
  cycleStartAt?: string;
  cycleEndAt?: string;
  resetRule?: string;
  defaultTimeMultiplier: number;
  isActive: boolean;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourcePoolDraft {
  source: ResourcePoolSource;
  externalGroupId: string;
  name: string;
  meterType: MeterType;
  subscriptionType?: SubscriptionType;
  timezone?: string;
  totalQuota?: number;
  quotaUnit?: string;
  cycleStartAt?: string;
  cycleEndAt?: string;
  resetRule?: string;
  defaultTimeMultiplier?: number;
  isActive?: boolean;
}

export interface PercentagePoolAccountSnapshot {
  status: AccountStatus;
  isFresh: boolean;
  remainingPercentage?: number;
}

export interface PercentagePoolSummary {
  totalAccountCount: number;
  eligibleAccountCount: number;
  unavailableAccountCount: number;
  averageRemainingPercentage?: number;
  equivalentAvailableAccounts: number;
  lowQuotaAccountCount: number;
  minimumRemainingPercentage?: number;
}

export function validateResourcePoolDraft(draft: ResourcePoolDraft): string[] {
  const errors: string[] = [];

  if (!draft.externalGroupId.trim()) {
    errors.push("externalGroupId 不能为空。");
  }

  if (!draft.name.trim()) {
    errors.push("name 不能为空。");
  }

  if (
    draft.totalQuota !== undefined &&
    (!Number.isFinite(draft.totalQuota) || draft.totalQuota < 0)
  ) {
    errors.push("totalQuota 必须是大于或等于 0 的有限数值。");
  }

  if (
    draft.defaultTimeMultiplier !== undefined &&
    (!Number.isFinite(draft.defaultTimeMultiplier) ||
      draft.defaultTimeMultiplier <= 0)
  ) {
    errors.push("defaultTimeMultiplier 必须是大于 0 的有限数值。");
  }

  if (draft.meterType === "percentage_pool" && draft.totalQuota !== undefined) {
    errors.push("percentage_pool 不得配置 totalQuota。");
  }

  return errors;
}

export function calculatePercentagePoolSummary(
  accounts: readonly PercentagePoolAccountSnapshot[],
  lowQuotaThreshold: number,
): PercentagePoolSummary {
  if (!Number.isFinite(lowQuotaThreshold) || lowQuotaThreshold < 0) {
    throw new RangeError("lowQuotaThreshold 必须是大于或等于 0 的有限数值。");
  }

  const eligibleRemainingPercentages = accounts.flatMap((account) => {
    if (
      account.status !== "active" ||
      !account.isFresh ||
      account.remainingPercentage === undefined ||
      !Number.isFinite(account.remainingPercentage) ||
      account.remainingPercentage < 0 ||
      account.remainingPercentage > 100
    ) {
      return [];
    }

    return [account.remainingPercentage];
  });

  const eligibleAccountCount = eligibleRemainingPercentages.length;
  const averageRemainingPercentage =
    eligibleAccountCount === 0
      ? undefined
      : eligibleRemainingPercentages.reduce((sum, value) => sum + value, 0) /
        eligibleAccountCount;

  return {
    totalAccountCount: accounts.length,
    eligibleAccountCount,
    unavailableAccountCount: accounts.length - eligibleAccountCount,
    averageRemainingPercentage,
    equivalentAvailableAccounts:
      averageRemainingPercentage === undefined
        ? 0
        : eligibleAccountCount * (averageRemainingPercentage / 100),
    lowQuotaAccountCount: eligibleRemainingPercentages.filter(
      (percentage) => percentage < lowQuotaThreshold,
    ).length,
    minimumRemainingPercentage:
      eligibleRemainingPercentages.length === 0
        ? undefined
        : Math.min(...eligibleRemainingPercentages),
  };
}
