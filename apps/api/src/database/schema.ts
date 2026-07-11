import {
  index,
  integer,
  numeric,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const resourcePools = sqliteTable(
  "resource_pools",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source: text("source").notNull(),
    externalGroupId: text("external_group_id").notNull(),
    name: text("name").notNull(),
    meterType: text("meter_type").notNull(),
    subscriptionType: text("subscription_type"),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    totalQuota: numeric("total_quota"),
    quotaUnit: text("quota_unit"),
    cycleStartAt: integer("cycle_start_at", { mode: "timestamp" }),
    cycleEndAt: integer("cycle_end_at", { mode: "timestamp" }),
    resetRule: text("reset_rule", { mode: "json" }).$type<Record<string, unknown>>(),
    defaultTimeMultiplier: numeric("default_time_multiplier")
      .notNull()
      .default("1"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("resource_pools_source_group_unique").on(
      table.source,
      table.externalGroupId,
    ),
  ],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source: text("source").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    displayName: text("display_name"),
    subscriptionType: text("subscription_type"),
    status: text("status").notNull().default("unknown"),
    remainingPercentage: numeric("remaining_percentage"),
    observedAt: integer("observed_at", { mode: "timestamp" }).notNull(),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("accounts_source_external_account_unique").on(
      table.source,
      table.externalAccountId,
    ),
  ],
);

export const resourcePoolMemberships = sqliteTable(
  "resource_pool_memberships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    resourcePoolId: text("resource_pool_id")
      .notNull()
      .references(() => resourcePools.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    observedAt: integer("observed_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("resource_pool_memberships_pool_current_index").on(
      table.resourcePoolId,
      table.effectiveTo,
    ),
    index("resource_pool_memberships_account_current_index").on(
      table.accountId,
      table.effectiveTo,
    ),
  ],
);

export const usageRecords = sqliteTable(
  "usage_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    source: text("source").notNull(),
    externalUsageRecordId: text("external_usage_record_id"),
    resourcePoolId: text("resource_pool_id")
      .notNull()
      .references(() => resourcePools.id),
    accountId: text("account_id").references(() => accounts.id),
    model: text("model"),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    rawRequestCount: integer("raw_request_count").notNull().default(0),
    tokenCount: numeric("token_count"),
    currencyAmount: numeric("currency_amount"),
    timeMultiplier: numeric("time_multiplier")
      .notNull()
      .default("1"),
    modelMultiplier: numeric("model_multiplier")
      .notNull()
      .default("1"),
    weightedUsage: numeric("weighted_usage"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("usage_records_source_external_usage_unique").on(
      table.source,
      table.externalUsageRecordId,
    ),
    index("usage_records_pool_occurred_at_index").on(
      table.resourcePoolId,
      table.occurredAt,
    ),
  ],
);
