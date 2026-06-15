# Amazon UK FBM Chinese Seller Scraper

Scrape Amazon UK (`amazon.co.uk`) by keyword, filter **FBM** (merchant-fulfilled) offers, and match sellers whose business address is in **山西 / 陕西 / 河南 / 河北**.

## Requirements

- Node.js 18+（推荐 20 LTS）— **没有 Node 也可以，见下方「零环境安装」**
- VPN with local proxy on `127.0.0.1:7897`
- **VPN 出口必须是英国 (GB)** — 俄罗斯/中国等非英国 IP 会导致 Amazon 显示「Deliver to Russian Federation」等，offer listing 为空，无法抓取 FBM 卖家

```bash
# 运行前检查代理出口国家
bash scripts/check-vpn.sh          # macOS / Linux
powershell -File scripts/check-vpn.ps1   # Windows
```

## 零环境安装（电脑没有 Node.js）

### 平台对照

| 操作 | macOS / Linux | Windows（CMD / PowerShell） |
|------|---------------|----------------------------|
| 首次安装（含 Node） | `bash scripts/install.sh` | `powershell -File scripts/install.ps1` |
| 仅装项目依赖（已有 Node） | `npm run setup` | `npm run setup` |
| 启动 Web | `npm run web` | `npm run web` |
| 双击启动 | `启动 Web.command` | `启动 Web.bat` |
| 检查 VPN 出口 | `bash scripts/check-vpn.sh` | `powershell -File scripts/check-vpn.ps1` |

`npm run web` / `npm run scrape` 已改为跨平台 Node 启动器，**Windows 上可直接用**（需先装好 Node）。

### macOS

1. 打开终端，进入项目目录
2. 一条命令完成 Node + 依赖 + Chromium：

```bash
bash scripts/install.sh
```

3. 启动：`npm run web`，或双击 **`启动 Web.command`**

若无法双击，执行：`chmod +x "启动 Web.command" scripts/*.sh`

### Windows

1. 打开 PowerShell，进入项目目录
2. 一条命令完成 Node + 依赖 + Chromium：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

3. 启动：`npm run web`，或双击 **`启动 Web.bat`**

没有 winget 时会自动从 nodejs.org 下载安装；若仍失败，请手动安装 LTS 后执行 `npm run setup`。

### 已有 Node 的用户

```bash
npm run setup   # 可选，确保依赖齐全
npm run web
```

首次运行 `npm run web` 或 `npm run scrape` 时会自动安装 npm 依赖、Playwright Chromium，并从 `.env.example` 生成 `.env`（若不存在）。

## Quick Start（推荐）

`npm run web` / `npm run scrape` 会自动配置 **代理 + 依赖**，macOS 与 Windows 通用：

```bash
npm run web
```

```bash
npm run scrape -- "phone case"
```

macOS/Linux 也可继续用：`bash scripts/run.sh phone case`（需 Git Bash 或 WSL 才能在 Windows 上用）

## Web UI

启动本地 Web 服务（自动配置代理）：

```bash
npm run web
```

浏览器打开 **http://localhost:3456**（端口可在 `.env` 中设置 `WEB_PORT`）。

页面功能：

- 填写搜索条件
- 点击「开始爬取」，实时查看运行日志与结果表格（检索进行中逐条更新）
- 同一时间仅允许 1 个任务；运行中可点击「取消」

CLI 方式仍然可用：`npm run scrape -- "phone case"`

## Usage

```bash
# 自动翻页，直到达到深度扫描上限或无更多结果
npm run scrape -- phone case

# 只深入扫描前 5 个商品（测试用；预筛跳过的非中国卖家不计入）
npm run scrape -- "phone case" --limit 5

# 价格 >= £50
npm run scrape -- "phone case" --min-price 50

# 价格 £50 ~ £200
npm run scrape -- "phone case" --min-price 50 --max-price 200

# 指定伦敦邮编（默认已是 SW1A 1AA）
npm run scrape -- "phone case" --postcode london
npm run scrape -- "phone case" --postcode "E1 6AN"

# 只看 FBM（默认，自发货）
npm run scrape -- "tent"

# 只看 FBA（亚马逊配送）
npm run scrape -- "tent" --fulfillment fba

# FBM + FBA 都要
npm run scrape -- "tent" --fulfillment all

# 导出所有 FBM（不限省份）
npm run scrape -- "tent" --all-fbm

# 排除指定省份，导出其余中国省份卖家
npm run scrape -- "tent" --exclude-provinces "广东,江苏,浙江,上海"

# 手动过验证码
npm run scrape -- "phone case" --headed
```

## Auto-pagination

默认自动翻页：

1. 搜索第 1 页，逐个检查 FBM 卖家地址
2. 当前页扫完后，自动翻下一页继续
3. 达到 `--limit` 深度扫描上限时停止（按**实际打开商品页**的数量计；搜索卡片预筛跳过的非中国卖家不计入；`0` 表示不限，直到无更多结果）

## VPN / Proxy

启动命令已内置代理（`127.0.0.1:7897`），一般无需手动设置。

检查 VPN 是否走英国出口：

```bash
# macOS / Linux
bash scripts/check-vpn.sh

# Windows
powershell -File scripts/check-vpn.ps1
```

**VPN 需选择英国节点**，否则 amazon.co.uk 可能返回 503。

## Output

Results are saved to `data/` as JSON and CSV.

Seller profiles are cached in `cache/`.

## Configuration（`.env`）

| Variable | Default | Description |
|----------|---------|-------------|
| `DELAY_MS` | `4000` | Delay between products (not each sub-page) |
| `PAGE_SETTLE_MS` | `800` | Wait after page load (lower = faster startup) |
| `HEADLESS` | `true` | Browser headless mode |
| `HTTP_PROXY` | `http://127.0.0.1:7897` | VPN proxy |
| `DELIVERY_POSTCODE` | `SW1A 1AA` | UK delivery postcode (London) |

## Delivery postcode

通过左上角 **Deliver to** → **Choose your location** → 输入 UK 邮编 → **Apply**（与你截图一致）。

默认伦敦邮编 `SW1A 1AA`，启动时自动设置。

```bash
npm run scrape -- "phone case" --postcode london      # 默认伦敦
npm run scrape -- "phone case" --postcode "E1 6AN"   # 东伦敦
npm run scrape -- "phone case" --no-postcode         # 不设置邮编
```

## Notes

- Amazon may show CAPTCHA; use `--headed` to solve manually.
- Not all sellers disclose their business address.
- For personal / small-scale competitive research only; respect Amazon ToS.
