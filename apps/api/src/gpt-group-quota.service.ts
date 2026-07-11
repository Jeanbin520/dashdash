import { Injectable } from "@nestjs/common";
import { calculateGptGroupQuotas } from "@dashdash/shared";

import { Sub2ApiConnector } from "./sub2api.connector.js";

export interface GptGroupQuotaServiceOptions {
  lowQuotaThreshold: number;
  freshnessMaxAgeMs: number;
}

@Injectable()
export class GptGroupQuotaService {
  constructor(
    private readonly connector: Sub2ApiConnector,
    private readonly options: GptGroupQuotaServiceOptions,
  ) {}

  async getGroupQuotas() {
    const [groups, accounts] = await Promise.all([
      this.connector.listGptGroups(),
      this.connector.listGptAccounts(),
    ]);
    const fetchedAt = new Date();
    return {
      source: "sub2api" as const,
      platform: "openai" as const,
      quotaWindow: "7d" as const,
      lowQuotaThreshold: this.options.lowQuotaThreshold,
      freshnessMaxAgeSeconds: Math.floor(this.options.freshnessMaxAgeMs / 1_000),
      fetchedAt: fetchedAt.toISOString(),
      groups: calculateGptGroupQuotas(groups, accounts, { ...this.options, now: fetchedAt }),
    };
  }
}
