# ProductNote 开发进度与接续

最后更新：2026-10-28（本机日期）。本文件是 ProductNote 接续入口；AgentMall 总进度在兄弟仓库。

## 用户已确认

- 视频完全离线处理，不接云端识别服务。
- 新增四个可选商品字段：分类、库存、单位、批发价。
- ProductNote 是采集端，AgentMall 是销售端。
- 用户要求记录工作，后续继续，不把构建通过描述为上线或真机验证。
- 2026-10-31：视频候选改为**默认自动赋占位名**（用户主动要求，替代原“必须人工确认名称”；占位名不是识别结果，需提示入库后改名核实）。

## 已完成

- 本轮（2026-10-31 晚·续）：列表页 UI 修复（用户截图反馈）：
  - [x] 摘要行原本 space-between 把“共 N 件 / 显示全部商品 / 排序”三段拉散，改为左侧统计、右侧动作成组（summary-actions，gap 14px），390/360px 均单行无溢出；
  - [x] 卡片描述行视频录入自动来源（“视频来源：VID_xxx.mp4，时间点…”）两行难看，卡片上改显“来自视频录入，待完善描述”（cardDescription 单行省略；完整信息仍在编辑页），真实描述不受影响；
  - [x] 复现验证：390/360 视口截图检查 + scrollWidth 无溢出；全量 39 项通过；APK 重打（15,218,450 字节，SHA-256 前 16 位 e49c53004966db58）并验证内嵌。
- 本轮（2026-10-31 晚）：画面相似度两处落地（JS 签名，全平台一致；明确不是语义识别，阈值 0.7 仅在回归用例验证过，真实跨图表现未系统评估）：
  - [x] `visual-search-service` 新增导出：`calculateImageSimilarity` / `findSimilarProductsByImage`（阈值 0.7）/ `orderProductsByImageSimilarity`（贪心链式聚类，组内相邻、组间原序，无图稳定排最后）/ `storedFileFromDataUrl`；
  - [x] 视频录入：进确认页后台对比已有商品主图 + 本批次先出现候选，卡片蓝色提示“画面相似：已有商品「X」相似度 N%…”；**仅提示不改勾选**，由用户决定是否入库；
  - [x] 商品列表：默认“排序：画面相似”（相似商品相邻，后台算完自动重排，期间提示“相似度排序中…”），摘要行可一键切回“排序：最近更新”，选择持久化（list-ui-store 新增 sortOrder，旧数据缺省→similar）；
  - [x] 新增 3 项回归：服务层同图/异图判定与聚类相邻、视频候选相似提示且默认可入库、列表默认聚类与切换；全量 39 项通过；`npm run build` 通过；APK 重打并验证内嵌五个功能标记。
- 本轮（2026-10-31 傍晚）：再次清空全部编译/打包产物（含旧 APK）从零重编：`./gradlew assembleDebug --no-daemon` 241 task 全新执行，BUILD SUCCESSFUL；产物 `app-debug.apk`（15,163,048 字节，SHA-256 `a36778f8…f576`），内嵌 bundle（index-BPTXG2P5.js）已验证同时含「待命名-」「去重报告」「素材包」三个新功能；仅编译验证，未在设备运行。
- 本轮（2026-10-31 周六·续）：视频候选默认自动命名：
  - [x] 每张候选默认赋「待命名-XXXXXX」（取自固定 ID 随机段大写）：跨批次全局唯一→不会误触发同名去重；重试沿用同一 ID→占位名稳定；Web 无语义标签时不再因空名称全部被拦；
  - [x] 商品描述如实区分“名称为自动占位、待改名核实 / 经人工确认”；页面提示同步更新（明确占位名不是识别结果）；
  - [x] 语义标签建议仍可覆盖占位名（autoNamed 机制不变）；用户改名即转为人工确认并参与同名去重；清空名称仍拦截（防误清空后无名义入库）；
  - [x] 新增 1 项回归（占位名格式/唯一性、不改名直接入库成功）；原空名校验用例改为先清空再触发；全量 36 项通过（app 12 含并行新增的素材包 2 项 + flows 6 + video-entry 18）；`npm run build` 通过；
  - [x] CLAUDE.md 同步更新该规则；重打 APK 并验证内嵌新 bundle。
- 本轮（2026-10-31 下午）：**AgentMall 素材包导出（图片通道导出侧）**：
  - [x] 新增 `src/services/agentmall-package.ts`：商品+图片打包为 zip（fflate，新增直接依赖），包内 `manifest.json`（版本1；名称/分类(五分类推断与CSV同一套)/价格元/库存/单位/图片清单；不含时间戳→同内容重复导出摘要一致，服务端可幂等）+ `images/p<商品序号>-<图片序号>.<jpg|png|webp>`；
  - [x] 校验：≤200商品、每品≤5图（与 AgentMall 协议一致，首张封面）、仅 image 类型且 jpg/png/webp、单图≤5MB、总量≤50MB；任一问题汇总报错整体不导出，不产残缺包；视频/附件/3D 模型不进包；
  - [x] 商品列表设置抽屉新增「导出 AgentMall 素材包」按钮（导出中复用 exporting 锁，空库提示与 CSV 一致）；
  - [x] 新增 2 项 Playwright 回归（下载后解包断言 manifest 字段/图片文件名与字节、空库拦截不产出文件）；全量 35 项通过（3D 用例首跑偶发失败，单跑两次通过，与既有记录一致）；`npm run build` 通过；
  - [x] 导入侧在 AgentMall 仓库落地（admin.importProductPackage 分块幂等 + 店主端选包导入），契约两端对齐；AgentMall 侧验证详情见其 PROGRESS/CHANGELOG。
- 本轮（2026-10-31 周六）：删除全部编译/打包产物后从零重出 APK：
  - [x] 清理 `dist`、`android/build`、`android/app/build`、`android/.gradle`、`capacitor-cordova-android-plugins/build`、`android/app/src/main/assets/public`（依赖缓存 `~/.gradle/caches` 未动，避免再次触发 SSL 下载问题）；
  - [x] `npm run build` → `npx cap sync android` → `./gradlew assembleDebug --no-daemon`（6m27s，241 task 全新执行）；
  - [x] **wrapper 的 Gradle 8.2.1 缓存现已完整**（解压目录 + `.ok` 标记，JDK 17），本轮直接用 `gradlew` 成功，不再需要旧的 8.12 绕过方式；
  - [x] 产物 `android/app/build/outputs/apk/debug/app-debug.apk`（≈15MB，2026-10-31 12:11）；已验证 APK 内嵌最新 bundle：`assets/public/assets/index-DnmfnN05.js` 含“去重报告”字样；**仅编译验证，未在设备运行**。
- 本轮（2026-10-28 晚）：视频录入同名去重 + 去重报告：
  - [x] `saveSelected` 入库前读取全部已有商品，按名称精确匹配（trim 后）判定重复：与库中已有商品同名、或与本批次先出现的候选同名，均不入库；
  - [x] 不静默跳过：候选卡片显示“与已有商品/本批次候选 N「名称」重复”，新增「去重报告」区块逐条列出哪个和哪个重复（review/done 阶段均显示），统计行显示“已去重 X 件”；
  - [x] 改名即清除重复标记，可重新勾选入库；
  - [x] 写后报错但实际可能已落库的候选（saveFailed）豁免名称去重，重试沿用固定 ID 覆盖自身，不产生重复；
  - [x] 读取已有商品失败时 fail-closed：本次不写任何商品并提示重试，不假称已去重；
  - [x] 新增 2 项 Playwright 回归（已有商品同名去重+改名重试、本批次同名去重报告），视频录入共 17 项；全量 33 项通过，`npm run build` 通过。
- `d076663`：可选商品字段、SQLite 初步迁移、视频抽帧/dHash、CSV 导出服务。
- `d68f9db`：视频批量页面、路由、新增入口、列表设置导出 CSV。
- `8d82f81`：视频录入加固、未知值保留、15 项回归（详见 Git 历史）。
- 本轮全面测试（2026-10-28 下午）：
  - [x] **修复备份功能缺失**：原来只能导入备份、无法导出（`exportBackupText`/`BackupPayload` 无调用方）。新增 `buildBackupPayload`/`exportBackup`，设置页加「导出备份 JSON」，含内嵌图片与四字段。
  - [x] **修复语音草稿跨子句吞字**：`extractAfterKeyword` 原从关键字取到全文结尾，多子句时供应商/名称字段吞掉后续整句；改为逐子句提取。
  - [x] 新增 `tests/app.spec.js` 10 项：CRUD 四字段全流程、备份导出→导入回环、旧版 v1 备份兼容、空库导出报错、CSV/PDF 下载、视图模式与搜索历史持久化、Web 图片搜索签名降级召回、3D GLB 生成、媒体/模型页状态。
  - [x] **安卓 APK 编译通过**：用本机缓存 Gradle 8.12（wrapper 的 8.2.1 下载因网络 SSL 失败，缓存为 0 字节）+ AGP 8.2.1 在线解析，`cap sync` + `assembleDebug` 成功，APK 含最新 bundle；无设备，运行时未验证。
  - [x] 用户测试服务（5173）已按用户要求关闭；测试自行拉起 4174 并自动回收。
  - [x] 二轮深测（同日）：新增 `tests/flows.spec.js` 6 项——新增抽屉三入口、拍照新建草稿、**长按相机→录像真实 MP4 封面生成**→含视频徽标→媒体页可播、视频附件添加/删除持久化、价格三态显示、轮播点点切换；修复 `createVideoCoverBlob` 无超时挂起风险。共 **31 项全过**。
  - [x] 盘点出两个**未接线功能**（如实记录，不虚构）：`generateProductModel`（3D 生成）与 `buildDraftFromSpeechText`（语音文本解析）目前均无 UI 调用方——3D 页恒为空态、语音解析只有服务层。接入属于新功能开发，另行排期。
  - [x] 加载元数据/定位有超时和取消，首帧等待解码就绪，失败也释放视频/canvas/对象 URL。
  - [x] 每次最多 60 候选、最多 1800 采样点、最长边上限及图片占用上限；到达候选上限提示分段。
  - [x] 使用共用数值校验：空库存/价格为 `null`；显式 `0` 保留；拒绝无效价、小数库存、负数和不安全整数。
  - [x] 名称必须人工填写/确认，不把“候选商品 N”自动当作正式商品。标签建议不能覆盖人工改名。
  - [x] 固定商品 ID、部分成功状态和已保存项锁定；写前/写后报错重试均不重复新增。
  - [x] 全选同步、未勾选候选保留、分批继续、离开确认、临时图片归属和清理；候选删除/换视频与异步保存防竞态。
  - [x] 替换无效 rpx，使用 px 和现有主题；390px 手机布局通过无横向溢出检查并人工看过截图。
  - [x] 普通商品编辑补齐四字段，不再覆盖丢失视频录入的数据；旧记录缺字段兼容。
  - [x] SQLite 初始化等待迁移完成；用 PRAGMA 检查缺失列后迁移，不吞磁盘等异常。
  - [x] CSV 分类优先用途/制冷关键词，修复办公桌椅/冷藏操作台误分类；保留未知值、BOM、引号和换行。
  - [x] 新增 Playwright 配置、15 项浏览器回归和合成 MP4 素材；同步 README/CLAUDE.md 的真实状态。

## 验证结果（2026-10-28 全面测试后）

- 2026-10-28 晚（同名去重后）：**Playwright 33 项全部通过**（含新增 2 项去重回归）；`npm run build`（vue-tsc/Vite）通过。首次全量时 3D 用例偶发失败，单跑与两次全量重跑均通过，判定为环境偶发。
- **Playwright 31 项全部通过**（2026-10-28 全面测试，本机 Chrome 无头；隔离上下文，端口 4174 自动拉起/回收）：
  - `app.spec.js`（10）：语音草稿逐子句解析；新建→列表→编辑回显→删除全流程（含分类下拉/图片上传/四字段）；备份导出 JSON（含 base64 图片+四字段）→篡改数据→导入完整恢复；v1 旧备份（无四字段/无 images 数组）兼容导入；空库导出报错；设置页 CSV（分类推断+空值）；PDF 下载（%PDF- 头+体积）；卡片/短视频模式与搜索历史持久化；同图搜索召回（JS 签名降级）；GLB 生成（photos/2 源/二进制）与媒体/模型/404 页状态。
  - `video-entry.spec.js`（15→17）：上一轮 15 项全部保留，本轮新增 2 项去重回归。
  - `flows.spec.js`（6）：新增抽屉入口路由；拍照新建草稿→表单带图→保存→媒体页；**长按相机录像流**（真实 6 秒 MP4：封面 blob 生成+视频附件草稿+保存后列表“含视频”徽标+媒体页 1 视频 1 图片+可播元素+轮播点点）；编辑页视频附件添加/删除持久化；价格未填/零/小数三态在列表与媒体页一致；轮播点点切换。
- `npm run build`：vue-tsc/Vite 通过。
- **安卓编译验证**：2026-10-31 从零重编成功（见「已完成」本轮记录）；历史首轮为 `npx cap sync android` + `gradle assembleDebug`（Gradle 8.12 离线增量+首次在线拉取 AGP 8.2.1）。**仅编译验证，未在设备运行**；旧 wrapper 8.2.1 SSL 下载失败问题现已消失（本地缓存完整），未改仓库配置。

## 远端与隐私

- 本仓库与 AgentMall 均已配置 GitHub 远端（github.com/RedfishOpenSource/ProductNote、/AgentMall）；旧档「无远端」过时。
- 截至本轮 ProductNote 领先 origin/main 5 个提交、AgentMall 领先 4 个，均未推送；是否推送由用户决定——仓库内含店铺电话、照片等真实信息，推送前需确认仓库可见性（私有/公开）与隐私接受度。

## 已确认边界（必须如实描述）

1. **抽帧不是商品检测**：一帧可含多件商品、同一商品会重复，不能保证全店无遗漏；仍需人工核对和补录。
2. 原生 Java 仅有 MainActivity/OfflineSpeechPlugin，**没有 VisualSearch 实现**。有运行时插件才可能拿到语义标签；Web 和当前源码不能承诺自动识别名称。JS 图像签名只是相似匹配（本轮已实测同图召回可用，跨图效果未评估）。
3. CSV 仅有 `名称,分类,价格(元),库存,单位`，无图片、描述或批发价。
4. **AgentMall 现有导入器尚未兼容完整 CSV**：表头可能被当作商品、简单 split 无法处理引号/逗号/换行，空数值会变零。导出只能算待核对清单；不要整文件粘贴上架。
5. SQLite 真机迁移、安卓选/拍视频、WebView 解码、文件清理仍待真机测试；本轮仅到编译+打包层面。
6. Web Preferences 存图片可能达到浏览器配额；会显示保存失败并支持固定 ID 重试，不能保证任意长视频全部入库。
7. PDF 分页逻辑对超长清单未做逐页裁剪验证（本轮仅验证单页场景可下载）。
8. **未接线功能**：3D 生成（`generateProductModel`）与语音文本解析（`buildDraftFromSpeechText`）均无 UI 调用方；3D 页恒空态、语音解析未接界面。接入属新功能，未排期，不得宣称已有“3D 建模”或“语音录入”可用功能（语音依赖 OfflineSpeech 插件，Android 才可能可用，且同样未接线）。
9. `createVideoCoverBlob` 已加 15 秒超时防挂；但长视频/慢设备的封面生成耗时未在低端机验证。

## 下次优先工作（按顺序）

1. 修复 **AgentMall 五列 CSV 导入**：标准 CSV 解析、跳过 BOM/表头、逐行校验、空价格/库存阻止导入而非补零、分类核对、只在全部有效后提交；用 ProductNote 导出作为测试输入。保持未验证商品默认下架。
2. 审查 AgentMall 已知根问题：支付模拟不能由配置实际关闭、真实统一下单/可信回调尚未完成、库存事务/竞态、unwrap 返回结构、点击 dataset 读取。不可将“开发侧无待办”作为事实。
3. 按用户设备条件做安卓真机测试；若继续要求离线语义识别，再单独评估本地模型及打包成本，不虚构已有能力。
4. ~~后续设计图片传输方案；CSV 五列无法传图。~~ **已落地（2026-10-31）**：素材包 zip 通道（导出侧本仓库已完成并测试；导入侧在 AgentMall，待云环境后端到端联调）。真机验证导出分享路径仍待做。

## 关键文件

- 视频：`src/views/VideoBatchEntryPage.vue`、`src/services/video-entry-service.ts`、`frame-dedup.ts`。
- 校验/表单：`product-entry-fields.ts`、`src/views/ProductFormPage.vue`。
- 持久化/备份：`product-store.ts`、`file-service.ts`、`backup-service.ts`（含导出）。
- 导出/入口：`agentmall-export.ts`、`agentmall-package.ts`（素材包导出）、`ProductListPage.vue`、`src/router/index.ts`。
- 回归：`tests/app.spec.js`、`tests/flows.spec.js`、`tests/video-entry.spec.js`、`tests/fixtures/`、`playwright.config.js`。
- 安卓：Gradle 8.12 缓存绕过方式见「验证结果」；wrapper 属性未改动。

## 日期与现场提醒

本机当前为 2026-10-28（周三）。旧 AgentMall 文档写的 2025-10/2025-11 是历史误记，不可机械沿用。若“本周六”指本轮所在周，则为 **2026-10-31**；按用户原要求在该周六过后的首次对话提醒现场资料，不要提前催，也不要改成必须下周一才提醒。
