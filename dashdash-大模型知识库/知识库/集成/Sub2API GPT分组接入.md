---
类型: 集成
项目: dashdash
状态: 已验证
模块: Sub2API用量监控
来源:
  - https://github.com/Wei-Shaw/sub2api/tree/e316ebf52838a89d57fc790981cce7520f819ac8
锚点:
  - apps/api/src/sub2api.connector.ts
  - apps/api/src/gpt-group-quota.service.ts
  - packages/shared/src/sub2api-gpt.ts
验证:
  - pnpm.cmd --filter @dashdash/shared test
  - pnpm.cmd --filter @dashdash/api test
  - pnpm.cmd check
失效条件:
  - Sub2API管理接口路径或响应信封发生变化
  - 账号列表不再返回group_ids、plan_type或Codex额度快照
  - GPT主额度口径不再采用7天窗口
加载标签:
  - Sub2API
  - GPT
  - 分组
  - 额度
  - OpenAI
上级: "[[dashdash-大模型知识库/地图/知识库地图|知识库地图]]"
关联:
  - "[[dashdash-大模型知识库/知识库/决策/Sub2API用量监控决策|Sub2API用量监控决策]]"
  - "[[dashdash-大模型知识库/知识库/数据模型/资源池数据模型|资源池数据模型]]"
---

# Sub2API GPT分组接入

上级：[[dashdash-大模型知识库/地图/知识库地图|知识库地图]]

## 接口锚点

GPT分组使用管理员接口`GET /api/v1/admin/groups/all?platform=openai`。GPT账号使用`GET /api/v1/admin/accounts`分页读取，并传入`platform=openai`、`page`和`page_size`。

Sub2API标准响应为`{ code, message, data }`。账号归组读取`group_ids`，套餐读取脱敏后仍保留的`credentials.plan_type`；影子账号可回退到`parent_plan_type`。额度快照读取：

- `extra.codex_7d_used_percent`：GPT主额度的7天已用百分比。
- `extra.codex_5h_used_percent`：5小时辅助窗口已用百分比。
- `extra.codex_usage_updated_at`：额度快照更新时间。

以上字段已对照Sub2API提交`e316ebf52838a89d57fc790981cce7520f819ac8`中的前端类型、管理员账号处理器和OpenAI额度服务。

## 计算口径

分组主额度采用7天窗口：`剩余百分比 = 100 - codex_7d_used_percent`。只把状态为活跃、可调度、快照未过期且剩余值在0至100之间的账号计入平均值。默认快照有效期为2小时，低额度阈值为20%，两者均可通过环境变量覆盖。

Plus、Pro、Team分别计算。若同一Sub2API分组出现多种套餐，接口返回`planBreakdown`，并将`hasMixedSubscriptionTypes`设为`true`；此时不返回统一`quota`，避免跨套餐产生误导性平均值。

## 本地接口

`GET /api/integrations/sub2api/gpt/groups`返回GPT分组额度。运行前配置：

- `SUB2API_BASE_URL`：Sub2API根地址，也接受以`/api/v1`结尾的地址。
- `SUB2API_ACCESS_TOKEN`：管理员Bearer访问令牌。
- `SUB2API_GPT_LOW_QUOTA_THRESHOLD`：可选，默认`20`。
- `SUB2API_GPT_FRESHNESS_MAX_AGE_MS`：可选，默认`7200000`。
- `SUB2API_REQUEST_TIMEOUT_MS`：可选，默认`15000`。
- `SUB2API_PAGE_SIZE`：可选，默认`100`。

## 验证

- 共享计算测试覆盖正常分组、混合套餐以及过期/停用账号。
- 连接器测试覆盖真实响应信封、分页、字段映射和基础地址去重。
- 全仓TypeScript检查通过。

## 相关知识

- [[dashdash-大模型知识库/知识库/决策/Sub2API用量监控决策|Sub2API用量监控决策]]
- [[dashdash-大模型知识库/知识库/数据模型/资源池数据模型|资源池数据模型]]
