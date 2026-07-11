import assert from "node:assert/strict";
import test from "node:test";

import { Sub2ApiConnector, type FetchLike } from "./sub2api.connector.js";

test("连接器读取 OpenAI 分组并分页映射 GPT 账号额度", async () => {
  const requestedUrls: URL[] = [];
  const fetcher: FetchLike = async (input) => {
    const url = new URL(input.toString());
    requestedUrls.push(url);
    if (url.pathname.endsWith("/admin/groups/all")) {
      return jsonResponse([
        { id: 1, name: "GPT Plus", platform: "openai", status: "active" },
      ]);
    }
    const page = Number(url.searchParams.get("page"));
    return jsonResponse({
      items: page === 1 ? [{
        id: 10,
        name: "openai-1",
        platform: "openai",
        status: "active",
        schedulable: true,
        group_ids: [1],
        credentials: { plan_type: "plus" },
        extra: {
          codex_usage_updated_at: "2026-07-11T03:00:00Z",
          codex_5h_used_percent: 12.5,
          codex_7d_used_percent: "37.5",
        },
      }] : [],
      total: 1,
      page,
      page_size: 1,
      pages: 2,
    });
  };
  const connector = new Sub2ApiConnector(
    { baseUrl: "https://sub.example/api/v1", accessToken: "secret", pageSize: 1 },
    fetcher,
  );

  const [groups, accounts] = await Promise.all([
    connector.listGptGroups(),
    connector.listGptAccounts(),
  ]);

  assert.equal(groups[0]?.name, "GPT Plus");
  assert.deepEqual(accounts[0], {
    id: 10,
    name: "openai-1",
    status: "active",
    schedulable: true,
    groupIds: [1],
    planType: "plus",
    usageUpdatedAt: "2026-07-11T03:00:00Z",
    fiveHourUsedPercentage: 12.5,
    sevenDayUsedPercentage: 37.5,
  });
  assert.equal(
    requestedUrls.filter((url) => url.pathname.endsWith("/admin/accounts")).length,
    2,
  );
  assert.ok(requestedUrls.every((url) => !url.pathname.includes("/api/v1/api/v1/")));
});

test("连接器不会把空额度误判为零消耗", async () => {
  const connector = new Sub2ApiConnector(
    { baseUrl: "https://sub.example", accessToken: "secret" },
    async () => jsonResponse({
      items: [{
        id: 11,
        name: "missing-quota",
        platform: "openai",
        status: "active",
        group_ids: [1],
        extra: { codex_7d_used_percent: null },
      }],
      pages: 1,
    }),
  );

  const [account] = await connector.listGptAccounts();
  assert.equal(account?.sevenDayUsedPercentage, undefined);
});

test("连接器缺少访问令牌时给出明确错误", async () => {
  const connector = new Sub2ApiConnector({ baseUrl: "https://sub.example" });
  await assert.rejects(connector.listGptGroups(), /SUB2API_ACCESS_TOKEN/);
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, message: "success", data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
