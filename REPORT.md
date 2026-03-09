# Notion 连接与创建页面测试报告

## 最终保留内容
- `test_notion_create_page.py`：最小可用测试，用 Notion API 在指定父页面下创建一个测试 page。
- `.env`：仅保留运行测试必需的两个变量。

## 已删除的临时内容
- `exchange_notion_oauth.sh`
- `diagnose_notion_oauth.sh`

这些脚本仅用于调试 OAuth 过程，已不再需要。

## 当前实现方式
1. 从环境变量读取：
   - `NOTION_ACCESS_TOKEN`
   - `NOTION_PARENT_PAGE_ID`
2. 初始化 `notion_client.Client(auth=token)`。
3. 调用 `notion.pages.create(...)` 在父页面下新建 page。
4. 断言返回对象为 `page` 且包含 `id/url`。

## 使用方式
1. 在 `.env` 中填写：
   - `NOTION_ACCESS_TOKEN=<你的可用token>`
   - `NOTION_PARENT_PAGE_ID=<父页面ID>`
2. 执行：
   - `set -a; source .env; set +a; pytest -q test_notion_create_page.py`

## 验证结果
此前已实际跑通一次，结果：`1 passed`。
