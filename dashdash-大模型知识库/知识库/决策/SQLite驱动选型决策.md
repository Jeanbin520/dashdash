---
类型: 技术决策
项目: dashdash
状态: 已确认
模块: 数据库
来源:
  - 2026-07-11 迁移实践验证
锚点:
  - apps/api/package.json
  - apps/api/drizzle.config.ts
验证:
  - pnpm.cmd --filter @dashdash/api check
  - pnpm.cmd --filter @dashdash/api build
失效条件:
  - 项目需要远程数据库或云化部署
  - Node.js 环境安装了 Visual Studio C++ 构建工具后重新评估
加载标签:
  - SQLite
  - libsql
  - better-sqlite3
  - 技术选型
  - Windows
上级: "[[dashdash-大模型知识库/地图/知识库地图|知识库地图]]"
关联:
  - "[[dashdash-大模型知识库/知识库/决策/Sub2API用量监控决策|Sub2API用量监控决策]]"
  - "[[dashdash-大模型知识库/知识库/数据模型/资源池数据模型|资源池数据模型]]"
  - "[[dashdash-大模型知识库/知识库/模块/数据库接入模式|数据库接入模式]]"
---

# SQLite 驱动选型决策

上级：[[dashdash-大模型知识库/地图/知识库地图|知识库地图]]

## 结论

从 PostgreSQL 迁移到 SQLite 时，最初选择 `better-sqlite3`，但在 Windows + Node.js v26 环境下安装失败：该库是 C++ 原生模块，需要 Visual Studio 的 C++ 构建工具来编译，而当前环境没有安装，且 Node v26 没有预编译二进制。

最终改用 `@libsql/client`（libSQL 的官方客户端），它是纯 JavaScript/WASM 实现，**零原生编译**，在任何环境都能直接安装。

| 对比项 | `better-sqlite3` | `@libsql/client` |
| --- | --- | --- |
| 实现 | C++ 原生绑定 | 纯 JS/WASM |
| 安装要求 | 需 Visual Studio C++ 构建工具（Windows） | 无，开箱即用 |
| 性能 | 最快（同步，原生） | 快（WASM，同步 API） |
| 远程支持 | 不支持 | 支持 Turso 云端 `libsql://` URL |
| Drizzle 支持 | `drizzle-orm/better-sqlite3` | `drizzle-orm/libsql` |
| schema 方言 | `drizzle-orm/sqlite-core` | `drizzle-orm/sqlite-core`（相同） |
| drizzle-kit dialect | `"sqlite"` | `"turso"` |

两者共用 `drizzle-orm/sqlite-core` 定义的 schema，切换驱动不需要改 schema，只改客户端创建代码和 `drizzle.config.ts` 的 `dialect`。

## 重要性

该决策影响所有新成员在本机搭建开发环境的难易度。`better-sqlite3` 在 Windows 上的编译障碍是一个常见痛点，选择 `@libsql/client` 消除了这一门槛。

额外好处：`@libsql/client` 支持 Turso 远程 URL，未来若需云化部署，几乎无需改代码即可迁移。

## 验证

- `pnpm.cmd --filter @dashdash/api check` — 类型检查通过
- `pnpm.cmd --filter @dashdash/api build` — 构建通过
- `pnpm.cmd install` — 无原生编译报错

## 备注

- `DATABASE_URL` 必须使用 `file:` 前缀（如 `file:./dashdash.db`），`@libsql/client` 会拒绝无协议的路径。这是从实践中发现的坑。
- `drizzle-orm/libsql` 导出的数据库类型是 `LibSQLDatabase<typeof schema>`，不是 `BaseSQLiteDatabase`（后者属于 `drizzle-orm/better-sqlite3`）。
- 如果未来环境安装了 C++ 构建工具且追求极致性能，可重新评估切回 `better-sqlite3`。

## 相关知识

- [[dashdash-大模型知识库/知识库/决策/Sub2API用量监控决策|Sub2API用量监控决策]]
- [[dashdash-大模型知识库/知识库/数据模型/资源池数据模型|资源池数据模型]]
- [[dashdash-大模型知识库/知识库/模块/数据库接入模式|数据库接入模式]]
