#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成面向 Software 3.0 与上下文工程的中文大模型知识库框架。

该版本将需求视为可执行的规格，而非原始笔记。它为智能体建立按需加载的
“上下文磁盘”：

  <项目名称>-大模型知识库/
    首页.md
    加载清单.md
    加载配方.md
    上下文规则.md
    地图/
    规格/
    知识库/
    灵感/
    收件箱/

设计原则：
  - 规格/ 是一等目录，与 知识库/ 并列
  - 不创建空的目录 README 占位文件
  - 加载清单.md 是加载清单，而非文字导航
  - 首页.md 和 地图/ 提供 Obsidian 导航与反向链接
  - 加载配方.md 记录任务和模块的加载决策
  - 知识库/ 为严谨模式：包含元数据、来源和验证
  - 灵感/ 为灵感模式：临时实验，有意保持低流程
  - 收件箱/ 是未经整理的输入，智能体依赖前必须先晋升为正式知识
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from textwrap import dedent
from typing import Optional


WIKI_DIR_SUFFIX = "大模型知识库"

CONTEXT_DIRS = [
    "地图",
    "规格",
    "知识库/模块",
    "知识库/接口",
    "知识库/领域",
    "知识库/决策",
    "知识库/操作手册",
    "知识库/注意事项",
    "知识库/查询",
    "知识库/数据模型",
    "知识库/集成",
    "知识库/验证",
    "灵感",
    "收件箱",
    "模板",
]

BEGIN_MARKER = "<!-- BEGIN LLM-WIKI -->"
END_MARKER = "<!-- END LLM-WIKI -->"
WIKILINK_PATTERN = re.compile(r"\[\[([^\]]+)\]\]")


@dataclass(frozen=True)
class WriteResult:
    action: str
    path: Path

    def render(self) -> str:
        return f"{self.action}：{self.path}"


@dataclass(frozen=True)
class LinkIssue:
    kind: str
    source: Path
    target: str
    matches: tuple[Path, ...] = ()

    def render(self, wiki_root: Path) -> str:
        source = self.source.relative_to(wiki_root).as_posix()
        if self.matches:
            rendered_matches = ", ".join(
                match.relative_to(wiki_root).as_posix() for match in self.matches
            )
            return f"{self.kind}：{source} -> [[{self.target}]] ({rendered_matches})"
        return f"{self.kind}：{source} -> [[{self.target}]]"


def normalize_text(text: str) -> str:
    return dedent(text).strip() + "\n"


def slugify(value: str) -> str:
    slug = re.sub(r"[^\w]+", "-", value.strip().lower()).strip("-")
    return slug or "项目"


def detect_vault_root(project_root: Path, wiki_root: Path, configured_root: Optional[str]) -> Path:
    if configured_root:
        vault_root = Path(configured_root)
        if not vault_root.is_absolute():
            vault_root = project_root / vault_root
        return vault_root.resolve()

    current = wiki_root.resolve()
    project_root = project_root.resolve()
    while True:
        if (current / ".obsidian").is_dir():
            return current
        if current.parent == current:
            break
        current = current.parent
    try:
        wiki_root.resolve().relative_to(project_root)
        return project_root
    except ValueError:
        return wiki_root.resolve()


def obsidian_target(vault_root: Path, target: Path) -> str:
    relative = target.resolve().relative_to(vault_root.resolve())
    return relative.with_suffix("").as_posix()


def wikilink(target: str, label: Optional[str] = None) -> str:
    return f"[[{target}|{label}]]" if label else f"[[{target}]]"


def resolve_wiki_root(project_root: Path, wiki_dir: Optional[str]) -> Path:
    if wiki_dir is None:
        return (project_root / f"{project_root.name}-{WIKI_DIR_SUFFIX}").resolve()
    return (project_root / wiki_dir).resolve()


def wiki_location_for_rules(project_root: Path, wiki_root: Path) -> str:
    try:
        return wiki_root.relative_to(project_root).as_posix() or "."
    except ValueError:
        return str(wiki_root)


def write_file(path: Path, content: str, force: bool, dry_run: bool) -> WriteResult:
    if path.exists() and not force:
        return WriteResult("跳过已有文件", path)
    existed = path.exists()
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")
    return WriteResult("覆盖" if existed and force else "写入", path)


def ensure_dir(path: Path, dry_run: bool) -> WriteResult:
    if not dry_run:
        path.mkdir(parents=True, exist_ok=True)
    return WriteResult("创建目录", path)


def replace_or_append_marked_block(path: Path, block: str, force: bool, dry_run: bool) -> WriteResult:
    marked = f"{BEGIN_MARKER}\n{block.strip()}\n{END_MARKER}\n"

    if path.exists():
        current = path.read_text(encoding="utf-8", errors="ignore")
        has_block = BEGIN_MARKER in current and END_MARKER in current
        if has_block and not force:
            return WriteResult("跳过已有区块", path)
        if has_block:
            pattern = re.compile(
                rf"{re.escape(BEGIN_MARKER)}.*?{re.escape(END_MARKER)}\n?",
                flags=re.DOTALL,
            )
            updated = pattern.sub(marked, current)
            action = "替换区块"
        else:
            updated = current.rstrip() + "\n\n" + marked
            action = "追加区块"
    else:
        updated = marked
        action = "写入"

    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(updated, encoding="utf-8", newline="\n")
    return WriteResult(action, path)


def frontmatter(**fields: object) -> str:
    def yaml_scalar(value: object) -> str:
        text = str(value)
        if text.startswith("[[") and text.endswith("]]"):
            return f'"{text}"'
        return text

    lines = ["---"]
    for key, value in fields.items():
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {yaml_scalar(item)}")
        else:
            lines.append(f"{key}: {yaml_scalar(value)}")
    lines.append("---")
    return "\n".join(lines)


def make_index(project_slug: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="大模型知识库索引",
        项目=project_slug,
        状态="有效",
        更新日期=date.today().isoformat(),
        上级=links["knowledge_map"],
        关联=[links["specs_map"], links["wiki_map"], links["manifest"]],
    )
    body = normalize_text(
        f"""
        # 大模型知识库首页

        此区域既是供 AI 智能体按需加载的上下文磁盘，也是供人类浏览的
        Obsidian 知识图谱。

        ## 从这里开始

        - {links["knowledge_map"]}：浏览整个知识系统。
        - {links["manifest"]}：决定智能体需要加载哪些上下文。
        - {links["load_recipes"]}：使用面向具体任务的加载配方。
        - {links["context_rules"]}：遵循晋升、验证和链接规则。

        ## 知识地图

        - {links["specs_map"]}：可执行意图和验收标准。
        - {links["wiki_map"]}：按知识类型归类的长期项目知识。

        ## 模板

        - {links["spec_template"]}
        - {links["wiki_template"]}

        ## 链接规则

        每个长期页面都必须通过“上级”链接指向知识地图，并应通过“关联”链接指向
        相关知识。新增页面时，也要将它加入对应地图，以保持 Obsidian 反向链接有效。
        所有新增或维护的知识页面正文均使用中文。
        """
    )
    return f"{meta}\n\n{body}"


def make_knowledge_map(project_slug: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="知识地图",
        项目=project_slug,
        状态="有效",
        更新日期=date.today().isoformat(),
        上级=links["home"],
        关联=[links["specs_map"], links["wiki_map"]],
    )
    body = normalize_text(
        f"""
        # 知识地图

        ## 导航

        - {links["home"]}
        - {links["specs_map"]}
        - {links["wiki_map"]}

        ## 智能体上下文

        - {links["manifest"]}
        - {links["load_recipes"]}
        - {links["context_rules"]}

        ## 维护

        新增长期页面必须归入 {links["specs_map"]} 或 {links["wiki_map"]}。
        避免留下孤立的笔记节点；所有页面内容均使用中文。
        """
    )
    return f"{meta}\n\n{body}"


def make_specs_map(project_slug: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="知识地图",
        项目=project_slug,
        状态="有效",
        更新日期=date.today().isoformat(),
        上级=links["knowledge_map"],
        关联=[links["wiki_map"], links["spec_template"]],
    )
    body = normalize_text(
        f"""
        # 规格地图

        上级：{links["knowledge_map"]}

        规格将需求转化为可执行的意图和验收标准。

        ## 规格列表

        在此添加每一篇已晋升的 `规格/*.md` 页面：

        - `<添加规格知识链接>`

        ## 编写规范

        - 从 {links["spec_template"]} 开始。
        - 在“关联”中链接实现知识。
        - 无法验证的需求保留在 `收件箱/`。
        - 所有规格正文均使用中文。
        """
    )
    return f"{meta}\n\n{body}"


def make_wiki_map(project_slug: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="知识地图",
        项目=project_slug,
        状态="有效",
        更新日期=date.today().isoformat(),
        上级=links["knowledge_map"],
        关联=[links["specs_map"], links["wiki_template"]],
    )
    body = normalize_text(
        f"""
        # 知识库地图

        上级：{links["knowledge_map"]}

        将每篇长期知识页面归入以下一个分类。

        ## 模块

        ## 接口

        ## 领域

        ## 决策

        ## 操作手册

        ## 注意事项

        ## 查询

        ## 数据模型

        ## 集成

        ## 验证

        ## 编写规范

        - 从 {links["wiki_template"]} 开始。
        - 将“上级”设为此地图，并添加有意义的“关联”链接。
        - 保持来源锚点和验证信息为最新状态。
        - 所有知识页面正文均使用中文。
        """
    )
    return f"{meta}\n\n{body}"


def make_manifest(project_name: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="上下文清单",
        项目=project_name,
        状态="脚手架",
        版本=1,
        更新日期=date.today().isoformat(),
        加载检索字段=["任务", "模块", "领域", "风险", "验证"],
        上级=links["knowledge_map"],
        关联=[links["load_recipes"], links["context_rules"]],
    )
    body = normalize_text(
        """
        # 加载清单

        使用本文件决定需要加载哪些上下文。不要加载整个目录树。

        ## 核心加载规则

        | 任务 | 加载内容 |
        | --- | --- |
        | 实现功能 | `规格/{功能}.md`、`知识库/模块/{模块}.md`、`知识库/注意事项/{模块}.md` |
        | 排查问题 | `知识库/操作手册/{模块}.md`、`知识库/查询/{问题}.md`、`知识库/注意事项/{模块}.md` |
        | 重构模块 | `知识库/模块/{模块}.md`、`知识库/决策/{领域}.md`、相关 `规格/*.md` |
        | 修改接口 | `规格/{功能}.md`、`知识库/接口/{接口}.md`、`知识库/集成/{服务}.md` |
        | 修改数据模型 | `知识库/数据模型/{模型}.md`、相关 `规格/*.md`、`知识库/决策/{领域}.md` |
        | 编写测试 | 目标 `规格/*.md`、`知识库/验证/{领域}.md`、目标模块页面 |
        | 开展实验 | 仅 `灵感/{实验}.md`，可复用时再晋升 |

        ## 晋升门槛

        只有同时具备以下内容，页面才能从 `收件箱/` 或 `灵感/` 移入 `规格/` 或 `知识库/`：

        - 稳定的结论或验收标准
        - 来源锚点
        - 验证步骤，或无法验证的明确原因
        - 中文正文
        """
    )
    navigation = normalize_text(
        f"""
        ## Obsidian 导航

        - 上级：{links["knowledge_map"]}
        - 关联：{links["load_recipes"]}、{links["context_rules"]}
        """
    )
    return f"{meta}\n\n{body}\n{navigation}"


def make_load_recipes(project_slug: str, links: dict[str, str], wiki_dir: str) -> str:
    meta = frontmatter(
        类型="加载配方",
        项目=project_slug,
        状态="脚手架",
        版本=1,
        更新日期=date.today().isoformat(),
        验证="人工：新增模块或规格时更新配方",
        上级=links["knowledge_map"],
        关联=[links["manifest"], links["context_rules"]],
    )
    body = normalize_text(
        f"""
        # 加载配方

        随着项目落地，在此添加具体的加载配方。

        ## 配方格式

        ```text
        何时使用：<任务意图>
        加载：
          - <路径>
          - <路径>
        验证：
          - <命令或人工检查>
        ```

        ## 初始配方

        ```text
        何时使用：开始新功能
        加载：
          - {wiki_dir}/规格/<功能>.md
          - {wiki_dir}/知识库/模块/<模块>.md
          - {wiki_dir}/知识库/注意事项/<模块>.md
        验证：
          - 执行规格中列出的验证
        ```

        ```text
        何时使用：排查类似生产环境的问题
        加载：
          - {wiki_dir}/知识库/操作手册/<模块>.md
          - {wiki_dir}/知识库/查询/<问题或症状>.md
          - {wiki_dir}/知识库/注意事项/<模块>.md
        验证：
          - 复现问题
          - 运行范围最小的自动化测试
          - 记录观察到的修复结果
        ```
        """
    )
    navigation = normalize_text(
        f"""
        ## Obsidian 导航

        - 上级：{links["knowledge_map"]}
        - 关联：{links["manifest"]}、{links["context_rules"]}
        """
    )
    return f"{meta}\n\n{body}\n{navigation}"


def make_context_rules(project_slug: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="上下文规则",
        项目=project_slug,
        状态="脚手架",
        版本=1,
        更新日期=date.today().isoformat(),
        验证="人工：在智能体工作时执行",
        上级=links["knowledge_map"],
        关联=[links["manifest"], links["load_recipes"]],
    )
    body = normalize_text(
        """
        # 上下文规则

        ## Software 3.0

        规格是可执行意图。只有当需求能表达为验收标准或可测试规则时，才能将其
        晋升到 `规格/`。

        ## 上下文工程

        优化目标是按需加载：

        - 优先使用小而自洽的文件
        - 保持高信息密度
        - 避免空白占位文件
        - 避免不影响实现、验证或加载决策的文字
        - 将元数据作为检索键，而非装饰
        - 所有长期知识页面与规格必须使用中文

        ## 语言与命名

        - 新增的规格、知识页面和可复用笔记，正文与 `.md` 文件名都必须使用中文
        - 文件名应简短表达主题，例如 `订单创建流程.md`、`优惠券核销规则.md`
        - 使用中文目录名：`规格/`、`知识库/`、`地图/`、`灵感/`、`收件箱/` 和 `模板/`

        ## 智能体闭环

        每个严谨模式页面都必须包含验证信息。若结论无法验证，将其状态标为
        “未验证”，或保留在 `收件箱/`。

        ## 灵感模式

        使用 `灵感/` 存放可丢弃的实验、草图和临时项目笔记。这里无需元数据，
        仅晋升可复用的产出；内容同样使用中文。

        ## 严谨模式

        使用 `规格/` 和 `知识库/` 存放长期上下文。严谨模式页面必须包含：

        - 类型
        - 状态
        - 负责人或模块
        - 来源
        - 锚点
        - 验证
        - 失效条件

        ## Obsidian 图谱规则

        - 每个长期页面都必须将“上级”设为知识地图
        - 将长期页面加入匹配的规格地图或知识库地图
        - 使用“关联”表达有意义的横向链接，不做装饰性标签
        - 新增或重命名页面后，运行生成器的链接检查
        """
    )
    navigation = normalize_text(
        f"""
        ## Obsidian 导航

        - 上级：{links["knowledge_map"]}
        - 关联：{links["manifest"]}、{links["load_recipes"]}
        """
    )
    return f"{meta}\n\n{body}\n{navigation}"


def make_spec_template(project_slug: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="可执行规格",
        项目=project_slug,
        状态="草稿",
        模块="<模块>",
        来源=["收件箱/<来源>.md"],
        锚点=["<代码或文档锚点>"],
        验证=["<命令或人工检查>"],
        失效条件=["来源变更", "相关接口变更"],
        上级=links["specs_map"],
        关联=["[[<相关知识页面>]]"],
    )
    body = normalize_text(
        """
        # <功能>规格

        上级：{specs_map}

        ## 目标

        <用一句话描述用户可见的结果。>

        ## 验收标准

        - 给定<状态>，当<操作>时，应得到<可观察结果>。
        - 给定<边界情况>，当<操作>时，应得到<安全行为>。

        ## 非目标

        - <本规格有意不覆盖的内容。>

        ## 验证

        - 执行：`<命令>`
        - 人工：<简短检查>

        ## 相关知识

        - `[[<相关知识页面>]]`
        """
    )
    body = body.replace("{specs_map}", links["specs_map"])
    return f"{meta}\n\n{body}"


def make_wiki_template(project_slug: str, links: dict[str, str]) -> str:
    meta = frontmatter(
        类型="知识条目",
        项目=project_slug,
        状态="未验证",
        模块="<模块>",
        来源=["<文件或文档>"],
        锚点=["<路径或符号>"],
        验证=["<命令或人工检查>"],
        失效条件=["<文件或契约变更>"],
        加载标签=["<任务>", "<模块>", "<风险>"],
        上级=links["wiki_map"],
        关联=["[[<相关规格或知识页面>]]"],
    )
    body = normalize_text(
        """
        # <知识标题>

        上级：{wiki_map}

        ## 结论

        <长期有效的项目事实。保持简洁且可验证。>

        ## 重要性

        <说明它如何影响实现或排障。>

        ## 验证

        - `<命令>`

        ## 备注

        - <仅记录可复用的内容。不要粘贴原始日志或聊天记录。>

        ## 相关知识

        - `[[<相关规格或知识页面>]]`
        """
    )
    body = body.replace("{wiki_map}", links["wiki_map"])
    return f"{meta}\n\n{body}"


def make_agents_block(wiki_dir: str) -> str:
    return normalize_text(
        f"""
        ## 大模型知识库上下文加载

        本项目使用 `{wiki_dir}/` 作为按需加载的上下文磁盘。

        开始非简单工作前：

        - 阅读 `{wiki_dir}/加载清单.md`。
        - 使用 `{wiki_dir}/加载配方.md` 选择最小的有效上下文集合。
        - 将 `{wiki_dir}/规格/` 视为可执行意图，而非背景材料。
        - 仅在包含来源锚点和验证信息时，优先使用 `{wiki_dir}/知识库/` 中的严谨模式页面。
        - 使用 `{wiki_dir}/灵感/` 存放可丢弃实验；仅晋升可复用的结果。
        - 在 Obsidian 中浏览 `{wiki_dir}/首页.md` 和 `{wiki_dir}/地图/`。
        - 除非被明确要求，否则不要加载整个大模型知识库。
        - 不要将密钥、凭据、完整日志或原始聊天记录写入大模型知识库。
        - 所有新增或更新的知识页面、规格和笔记正文必须使用中文。
        - 新增的知识页面、规格和可复用笔记必须使用中文 `.md` 文件名，并归入对应中文目录。

        完成工作后：

        - 执行或记录范围最小的验证。
        - 仅在结果可复用时更新规格/知识库。
        - 为每个长期页面提供“上级”地图、有意义的“关联”链接及地图条目。
        - 新增或重命名长期页面后，使用 `--check-links` 运行本生成器。
        - 将无法验证的结论保留在 `收件箱/`，或标记为“未验证”。
        """
    )


def make_ai_rules_block(wiki_dir: str) -> str:
    return normalize_text(
        f"""
        ## 大模型知识库规则

        使用 `{wiki_dir}/加载清单.md` 和 `{wiki_dir}/加载配方.md` 决定加载哪些上下文。

        - `规格/` 包含可执行意图与验收标准。
        - `知识库/` 包含长期有效、已验证或明确标注状态的项目知识。
        - `灵感/` 包含可丢弃的实验笔记。
        - `收件箱/` 包含未整理的输入，不得视为权威信息。
        - 每个长期结论都需要来源锚点和验证。
        - 每个长期页面都需要 Obsidian“上级”链接、有意义的“关联”链接及地图条目。
        - 新增或重命名长期页面后，使用 `--check-links` 运行生成器。
        - 所有新增或更新的知识页面、规格和笔记正文必须使用中文。
        - 新增的知识页面、规格和可复用笔记必须使用中文 `.md` 文件名，并归入对应中文目录。
        """
    )


def make_links(wiki_root: Path, vault_root: Path) -> dict[str, str]:
    def link(relative_path: str, label: str) -> str:
        return wikilink(obsidian_target(vault_root, wiki_root / relative_path), label)

    return {
        "home": link("首页.md", "大模型知识库首页"),
        "knowledge_map": link("地图/知识地图.md", "知识地图"),
        "specs_map": link("地图/规格地图.md", "规格地图"),
        "wiki_map": link("地图/知识库地图.md", "知识库地图"),
        "manifest": link("加载清单.md", "加载清单"),
        "load_recipes": link("加载配方.md", "加载配方"),
        "context_rules": link("上下文规则.md", "上下文规则"),
        "spec_template": link("模板/规格模板.md", "规格模板"),
        "wiki_template": link("模板/知识条目模板.md", "知识条目模板"),
    }


def make_files(
    project_name: str,
    wiki_root: Path,
    vault_root: Path,
    wiki_dir: str,
) -> dict[str, str]:
    project_slug = slugify(project_name)
    links = make_links(wiki_root, vault_root)
    return {
        "首页.md": make_index(project_slug, links),
        "加载清单.md": make_manifest(project_slug, links),
        "加载配方.md": make_load_recipes(project_slug, links, wiki_dir),
        "上下文规则.md": make_context_rules(project_slug, links),
        "地图/知识地图.md": make_knowledge_map(project_slug, links),
        "地图/规格地图.md": make_specs_map(project_slug, links),
        "地图/知识库地图.md": make_wiki_map(project_slug, links),
        "模板/规格模板.md": make_spec_template(project_slug, links),
        "模板/知识条目模板.md": make_wiki_template(project_slug, links),
    }


def generate(
    project_root: Path,
    wiki_dir: Optional[str],
    force: bool,
    dry_run: bool,
    with_agents: bool,
    with_ai_rules: bool,
    obsidian_vault_root: Optional[str],
) -> list[WriteResult]:
    project_root = project_root.resolve()
    project_name = project_root.name
    wiki_root = resolve_wiki_root(project_root, wiki_dir)
    wiki_location = wiki_location_for_rules(project_root, wiki_root)
    vault_root = detect_vault_root(project_root, wiki_root, obsidian_vault_root)
    results: list[WriteResult] = []

    for directory in CONTEXT_DIRS:
        results.append(ensure_dir(wiki_root / directory, dry_run))

    for relative_path, content in make_files(
        project_name,
        wiki_root,
        vault_root,
        wiki_location,
    ).items():
        results.append(write_file(wiki_root / relative_path, content, force, dry_run))

    if with_agents:
        results.append(
            replace_or_append_marked_block(
                project_root / "AGENTS.md",
                make_agents_block(wiki_location),
                force,
                dry_run,
            )
        )

    if with_ai_rules:
        results.append(
            replace_or_append_marked_block(
                project_root / "AI_RULES.md",
                make_ai_rules_block(wiki_location),
                force,
                dry_run,
            )
        )

    return results


def parse_wikilink_target(raw_target: str) -> Optional[str]:
    target = raw_target.split("|", 1)[0].split("#", 1)[0].strip()
    if not target:
        return None
    if any(marker in target for marker in ("<", ">", "{", "}")):
        return None
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", target):
        return None
    return target


def markdown_candidate(base: Path, target: str) -> Path:
    candidate = base / Path(target)
    return candidate if candidate.suffix.lower() == ".md" else candidate.with_suffix(".md")


def resolve_wikilink(
    source: Path,
    target: str,
    markdown_files: list[Path],
    wiki_root: Path,
    vault_root: Path,
) -> tuple[Path, ...]:
    direct_candidates: list[Path] = []
    if target.startswith(("./", "../")):
        direct_candidates.append(markdown_candidate(source.parent, target))
    else:
        direct_candidates.append(markdown_candidate(vault_root, target.lstrip("/")))
        direct_candidates.append(markdown_candidate(wiki_root, target.lstrip("/")))

    existing_direct = {
        candidate.resolve() for candidate in direct_candidates if candidate.is_file()
    }
    if existing_direct:
        return tuple(sorted(existing_direct, key=lambda path: path.as_posix()))

    normalized = (target[:-3] if target.lower().endswith(".md") else target)
    normalized = normalized.replace("\\", "/").strip("/")
    matches: set[Path] = set()
    for markdown_file in markdown_files:
        file_without_suffix = markdown_file.with_suffix("")
        vault_relative = file_without_suffix.relative_to(vault_root).as_posix()
        wiki_relative = file_without_suffix.relative_to(wiki_root).as_posix()
        if (
            file_without_suffix.name == normalized
            or vault_relative == normalized
            or wiki_relative == normalized
            or vault_relative.endswith(f"/{normalized}")
            or wiki_relative.endswith(f"/{normalized}")
        ):
            matches.add(markdown_file.resolve())
    return tuple(sorted(matches, key=lambda path: path.as_posix()))


def check_links(wiki_root: Path, vault_root: Path) -> list[LinkIssue]:
    markdown_files = sorted(
        (path.resolve() for path in wiki_root.rglob("*.md")),
        key=lambda path: path.as_posix(),
    )
    issues: list[LinkIssue] = []
    for source in markdown_files:
        content = source.read_text(encoding="utf-8", errors="ignore")
        for raw_target in WIKILINK_PATTERN.findall(content):
            target = parse_wikilink_target(raw_target)
            if target is None:
                continue
            matches = resolve_wikilink(source, target, markdown_files, wiki_root, vault_root)
            if not matches:
                issues.append(LinkIssue("missing", source, target))
            elif len(matches) > 1:
                issues.append(LinkIssue("ambiguous", source, target, matches))
    return issues


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="生成面向 Software 3.0 与上下文工程的中文大模型知识库框架。"
    )
    parser.add_argument(
        "project_root",
        nargs="?",
        default=".",
        help="目标项目根目录。默认值：当前工作目录。",
    )
    parser.add_argument(
        "--wiki-dir",
        help=(
            "相对于项目根目录的知识库目录。"
            "默认值：项目根目录下的 <项目名称>-大模型知识库。"
        ),
    )
    parser.add_argument("--force", action="store_true", help="覆盖生成的文件和标记区块。")
    parser.add_argument("--dry-run", action="store_true", help="仅输出计划写入，不修改文件。")
    parser.add_argument("--with-agents", action="store_true", help="创建或更新 AGENTS.md 标记区块。")
    parser.add_argument("--with-ai-rules", action="store_true", help="创建或更新 AI_RULES.md 标记区块。")
    parser.add_argument(
        "--obsidian-vault-root",
        help=(
            "Obsidian 仓库根目录，可使用绝对路径或相对于项目根目录的路径。"
            "默认值：包含 .obsidian 的最近知识库父目录，否则使用项目根目录。"
        ),
    )
    parser.add_argument(
        "--check-links",
        action="store_true",
        help="仅检查现有大模型知识库 [[链接]]，不生成文件。",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root)

    if not project_root.exists():
        raise SystemExit(f"项目根目录不存在：{project_root}")
    if not project_root.is_dir():
        raise SystemExit(f"项目根目录不是目录：{project_root}")
    if args.wiki_dir is not None and Path(args.wiki_dir).is_absolute():
        raise SystemExit("--wiki-dir 必须是相对于项目根目录的路径")

    wiki_root = resolve_wiki_root(project_root.resolve(), args.wiki_dir)
    vault_root = detect_vault_root(project_root.resolve(), wiki_root, args.obsidian_vault_root)
    try:
        wiki_root.relative_to(vault_root)
    except ValueError as exc:
        raise SystemExit(
            f"知识库目录必须位于 Obsidian 仓库根目录内：{vault_root}"
        ) from exc

    if args.check_links:
        if not wiki_root.is_dir():
            raise SystemExit(f"大模型知识库目录不存在：{wiki_root}")
        issues = check_links(wiki_root, vault_root)
        print(f"已检查：{wiki_root}")
        print(f"Obsidian 仓库：{vault_root}")
        if issues:
            for issue in issues:
                print(f"- {issue.render(wiki_root)}")
            print(f"链接检查失败：{len(issues)} 个问题。")
            return 1
        print("链接检查通过。")
        return 0

    results = generate(
        project_root=project_root,
        wiki_dir=args.wiki_dir,
        force=args.force,
        dry_run=args.dry_run,
        with_agents=args.with_agents,
        with_ai_rules=args.with_ai_rules,
        obsidian_vault_root=args.obsidian_vault_root,
    )

    mode = "已计划" if args.dry_run else "已生成"
    print(f"大模型知识库框架{mode}。")
    print(f"项目：{project_root.resolve()}")
    print(f"知识库：{wiki_root}")
    print(f"Obsidian 仓库：{vault_root}")
    for result in results:
        print(f"- {result.render()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
