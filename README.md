# dashdash

dashdash 是一个面向 Sub2API 的用量监控项目，采用 pnpm workspace 与 Turborepo 管理。当前仓库包含 NestJS API、Vue Dashboard、共享额度计算逻辑，以及用于 AI 智能体和 Obsidian 的项目知识库。

> 当前状态：API 已实现健康检查、SQLite 数据库接入和 Sub2API GPT 分组额度查询；Dashboard 仍处于占位阶段。

## 技术栈

- Node.js 22+
- pnpm 11.7
- TypeScript 5
- NestJS + Fastify
- Vue 3 + Vite
- Drizzle ORM + SQLite/libSQL
- Turborepo

## 项目结构

```text
apps/
  api/          NestJS API 与 Sub2API 连接器
  dashboard/    Vue 管理界面
packages/
  shared/       共享类型、资源池与 GPT 额度计算逻辑
dashdash-大模型知识库/
                项目规格、决策和集成知识
```

## 本地开发

### 1. 安装依赖

```powershell
pnpm install
```

### 2. 配置基础环境变量

项目根目录的 `.env.example` 记录了基础变量。当前 API 不会自动加载 `.env`，请在启动它的终端中设置环境变量：

```powershell
$env:PORT = "3000"
$env:DATABASE_URL = "file:./dashdash.db"
```

### 3. 初始化数据库

```powershell
pnpm --filter @dashdash/api db:migrate
```

### 4. 启动项目

同时启动 API 和 Dashboard：

```powershell
pnpm dev
```

也可以分别启动：

```powershell
pnpm dev:api
pnpm dev:dashboard
```

默认地址：

- API：`http://localhost:3000`
- Dashboard：`http://localhost:5173`

## Sub2API 集成

调用 GPT 分组额度接口前，需要在 API 进程所在终端配置：

```powershell
$env:SUB2API_BASE_URL = "https://your-sub2api.example.com"
$env:SUB2API_ACCESS_TOKEN = "your-admin-access-token"
```

可选参数：

| 环境变量 | 默认值 | 用途 |
| --- | ---: | --- |
| `SUB2API_GPT_LOW_QUOTA_THRESHOLD` | `20` | 低额度阈值（百分比） |
| `SUB2API_GPT_FRESHNESS_MAX_AGE_MS` | `7200000` | 额度快照最大有效期 |
| `SUB2API_REQUEST_TIMEOUT_MS` | `15000` | 请求超时时间 |
| `SUB2API_PAGE_SIZE` | `100` | 账号分页大小 |

不要提交真实的访问令牌或包含凭据的 `.env` 文件。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | API 健康检查 |
| `GET` | `/health/db` | 数据库健康检查与资源池数量 |
| `GET` | `/api/integrations/sub2api/gpt/groups` | 查询 Sub2API GPT 分组额度 |

示例：

```powershell
Invoke-RestMethod http://localhost:3000/api/integrations/sub2api/gpt/groups
```

## 验证

```powershell
# 全仓类型检查
pnpm check

# 共享逻辑测试
pnpm --filter @dashdash/shared test

# API 连接器测试
pnpm --filter @dashdash/api test

# 生产构建
pnpm build
```

如果 PowerShell 的执行策略阻止运行 `pnpm.ps1`，可将上述命令中的 `pnpm` 替换为 `pnpm.cmd`。

## 知识库

`dashdash-大模型知识库/` 是项目的按需上下文磁盘，也可以使用 Obsidian 浏览。入口文件为 `dashdash-大模型知识库/首页.md`。开始非简单开发工作前，请遵循 `AGENTS.md` 中的上下文加载规则。

## License

本项目暂未声明开源许可证。
