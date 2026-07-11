import { Module } from "@nestjs/common";

import { GptGroupQuotaService, type GptGroupQuotaServiceOptions } from "./gpt-group-quota.service.js";
import { Sub2ApiConnector } from "./sub2api.connector.js";
import { Sub2ApiController } from "./sub2api.controller.js";

function nonNegativeNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

@Module({
  controllers: [Sub2ApiController],
  providers: [
    {
      provide: Sub2ApiConnector,
      useFactory: () => new Sub2ApiConnector({
        baseUrl: process.env.SUB2API_BASE_URL,
        accessToken: process.env.SUB2API_ACCESS_TOKEN,
        requestTimeoutMs: nonNegativeNumber(process.env.SUB2API_REQUEST_TIMEOUT_MS, 15_000),
        pageSize: nonNegativeNumber(process.env.SUB2API_PAGE_SIZE, 100),
      }),
    },
    {
      provide: GptGroupQuotaService,
      inject: [Sub2ApiConnector],
      useFactory: (connector: Sub2ApiConnector) => {
        const options: GptGroupQuotaServiceOptions = {
          lowQuotaThreshold: nonNegativeNumber(process.env.SUB2API_GPT_LOW_QUOTA_THRESHOLD, 20),
          freshnessMaxAgeMs: nonNegativeNumber(process.env.SUB2API_GPT_FRESHNESS_MAX_AGE_MS, 2 * 60 * 60 * 1_000),
        };
        return new GptGroupQuotaService(connector, options);
      },
    },
  ],
})
export class Sub2ApiModule {}
