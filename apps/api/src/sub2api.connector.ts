import { Injectable } from "@nestjs/common";
import type {
  Sub2ApiGptAccount,
  Sub2ApiGptGroup,
} from "@dashdash/shared";

interface Sub2ApiEnvelope<T> {
  code: number;
  message?: string;
  data?: T;
}

interface Sub2ApiPage<T> {
  items: T[];
  pages: number;
}

interface RawGroup {
  id: number;
  name: string;
  platform: string;
  status: "active" | "inactive";
}

interface RawAccount {
  id: number;
  name: string;
  platform: string;
  status: "active" | "inactive" | "error";
  schedulable?: boolean;
  group_ids?: number[];
  groups?: Array<{ id: number }>;
  credentials?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  parent_plan_type?: string;
}

export interface Sub2ApiConnectorOptions {
  baseUrl?: string;
  accessToken?: string;
  requestTimeoutMs?: number;
  pageSize?: number;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

@Injectable()
export class Sub2ApiConnector {
  private readonly requestTimeoutMs: number;
  private readonly pageSize: number;

  constructor(
    private readonly options: Sub2ApiConnectorOptions,
    private readonly fetcher: FetchLike = fetch,
  ) {
    this.requestTimeoutMs = positiveInteger(options.requestTimeoutMs, 15_000);
    this.pageSize = positiveInteger(options.pageSize, 100);
  }

  async listGptGroups(): Promise<Sub2ApiGptGroup[]> {
    const groups = await this.get<RawGroup[]>("admin/groups/all", {
      platform: "openai",
    });
    return groups
      .filter((group) => group.platform === "openai")
      .map((group) => ({ id: group.id, name: group.name, status: group.status }));
  }

  async listGptAccounts(): Promise<Sub2ApiGptAccount[]> {
    const result: Sub2ApiGptAccount[] = [];
    let page = 1;
    let pages = 1;

    do {
      const response = await this.get<Sub2ApiPage<RawAccount>>(
        "admin/accounts",
        {
          page: String(page),
          page_size: String(this.pageSize),
          platform: "openai",
          sort_by: "id",
          sort_order: "asc",
        },
      );
      result.push(
        ...response.items
          .filter((account) => account.platform === "openai")
          .map(mapAccount),
      );
      pages = Math.max(1, response.pages);
      page += 1;
    } while (page <= pages);

    return result;
  }

  private async get<T>(path: string, query: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, query);
    const accessToken = this.options.accessToken?.trim();
    if (!accessToken) {
      throw new Error("缺少 SUB2API_ACCESS_TOKEN，无法读取 Sub2API 管理接口。");
    }

    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Sub2API 请求失败：${message}`);
    }

    if (!response.ok) {
      throw new Error(`Sub2API 请求返回 HTTP ${response.status}。`);
    }
    const envelope = (await response.json()) as Sub2ApiEnvelope<T>;
    if (envelope.code !== 0 || envelope.data === undefined) {
      throw new Error(`Sub2API 接口返回错误：${envelope.message || `code=${envelope.code}`}`);
    }
    return envelope.data;
  }

  private buildUrl(path: string, query: Record<string, string>): URL {
    const rawBaseUrl = this.options.baseUrl?.trim();
    if (!rawBaseUrl) {
      throw new Error("缺少 SUB2API_BASE_URL，无法读取 Sub2API 管理接口。");
    }
    const base = new URL(rawBaseUrl.endsWith("/") ? rawBaseUrl : `${rawBaseUrl}/`);
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      throw new Error("SUB2API_BASE_URL 只支持 http 或 https 地址。");
    }
    const basePath = base.pathname.replace(/\/+$/, "");
    base.pathname = basePath.endsWith("/api/v1")
      ? `${basePath}/${path}`
      : `${basePath}/api/v1/${path}`;
    base.search = "";
    for (const [key, value] of Object.entries(query)) base.searchParams.set(key, value);
    return base;
  }
}

function mapAccount(account: RawAccount): Sub2ApiGptAccount {
  const extra = account.extra ?? {};
  return {
    id: account.id,
    name: account.name,
    status: account.status,
    schedulable: account.schedulable ?? true,
    groupIds: account.group_ids ?? account.groups?.map((group) => group.id) ?? [],
    planType: toStringValue(account.credentials?.plan_type) ?? account.parent_plan_type,
    usageUpdatedAt: toStringValue(extra.codex_usage_updated_at),
    fiveHourUsedPercentage: toFiniteNumber(extra.codex_5h_used_percent),
    sevenDayUsedPercentage: toFiniteNumber(extra.codex_7d_used_percent),
  };
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? Math.floor(value)
    : fallback;
}
