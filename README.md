# ProductNote — 商品采集录入工具

Vue 3 + TypeScript + Vite + Element Plus + Capacitor 安卓应用，为老赵厨房用品采集商品资料；AgentMall 是关联的销售端。

## 当前能力

- 商品新增、编辑、图片/附件、视频素材和 3D 模型相关页面。
- 语音录入规则解析、图片相似搜索、备份导出/导入(JSON+图片，设置页)和 PDF 导出。
- 商品含可选 `category / quantity / unit / wholesalePrice`（分类/库存/单位/批发价），普通表单可编辑并保留。旧记录缺失字段按未知处理。
- 视频批量入口：列表右下角 `＋ → 视频批量`；本地选/拍视频 → 按间隔抽帧 → dHash 跳过相似画面 → 人工填名称/价格等 → 勾选入库。
- 分批保存、失败重试沿用固定商品 ID；字段先全部校验，再开始入库。空库存是未知 `null`，填写 `0` 才是零，不擅自取整。
- 抽帧支持取消和加载/定位超时；最多 60 张候选图，超过采样点/内存上限时提示分段处理。

## 明确边界

**抽帧不等于商品检测**：一帧可能包含多件商品，同一商品也可能多次出现，不能保证全店无遗漏。人工确认仍是必要步骤。

- 视频完全本地处理，不接云端识别/API。
- 当前仓库没有 `VisualSearch` 安卓原生实现，仅有插件接口。语义命名只在运行时确实提供该插件时启用；当前 Web 不提供名称识别，安卓也不能宣称已实现。
- JS 视觉降级计算的是图像签名，只供相似匹配，不能当成语义标签。
- 安卓录像选择、WebView 解码、SQLite 迁移、文件清理仍须真机验证；浏览器测试不替代安卓测试。

## AgentMall CSV

列表设置或批量入库完成后可导出 UTF-8 BOM CSV，列顺序：

```text
名称,分类,价格(元),库存,单位
```

- 未知价格/库存保持空值；不含图片和批发价。无显式分类时，关键词只提供分类建议。
- **导出不等于已打通销售端**：AgentMall 现有粘贴导入器尚不完整支持表头、CSV 引号/换行，且会把空数值变成零。修复前只把导出作为待核对清单，不要直接整文件粘贴上架。
- 图片传输、导入器修复及微信运行时联调是后续工作。

## 开发和验证

```bash
npm install
npm run dev          # 默认 0.0.0.0:5173
npm run build        # vue-tsc + Vite
npx playwright install chromium
npm test             # 隔离浏览器上下文，测试服务器 127.0.0.1:4174
npm run run:android  # 需要 Android SDK / 设备
```

已有 Chrome 时无需下载测试 Chromium：

```bash
# Git Bash
PLAYWRIGHT_CHANNEL=chrome npm test
# PowerShell
$env:PLAYWRIGHT_CHANNEL='chrome'; npm test
```

`tests/fixtures/shop-test.mp4` 是 FFmpeg testsrc2 生成的 6 秒合成测试素材，不包含真实店铺资料。共 25 项测试：视频批量录入 15 项(`tests/video-entry.spec.js`)+ 全应用 10 项(`tests/app.spec.js`：CRUD/备份回环/旧版导入/CSV/PDF/搜索/3D)。测试使用独立浏览器上下文，不操作日常浏览器商品数据。截图和失败跟踪写入已忽略的 `test-results/`。

安卓编译(本机网络下 wrapper 下载失败时的绕过方式，不改仓库配置)：

```bash
npx cap sync android
# 用本机已缓存的 Gradle 8.12 直接编译(路径按实际哈希目录调整)
C:/Users/<user>/.gradle/wrapper/dists/gradle-8.12-all/<hash>/gradle-8.12/bin/gradle assembleDebug
# 产物: android/app/build/outputs/apk/debug/app-debug.apk(仅编译验证，运行时需真机)
```

## 数据与接续

- Web：Capacitor Preferences JSON，图片为 data URL；空间受浏览器限制。
- 安卓：SQLite 与 `Directory.Data`；入口为 `product-store.ts`、`file-service.ts`。
- 本项目进度与未完成项：[`DOC/PROGRESS.md`](DOC/PROGRESS.md)。
- AgentMall 项目总进度：`../AgentMall/DOC/99-进度跟踪/PROGRESS.md`。
