# ProductNote - 商品采集录入 APP

给实体店快速采集/录入商品的工具(Vue 3 + TypeScript + Vite + Capacitor 安卓 APP)。
**当前使命:为 AgentMall 小程序(老赵厨房用品)采集商品数据**,录完一键导出 CSV → 店主端批量导入上架。

## 功能

- 商品 CRUD:名称/价格/描述/供应商/图片/附件/3D 模型(拍照、相册、文件)
- **语音录入**(离线):说一段话自动解析名称/价格/供应商/电话
- **视觉搜索**:拍一张照片找相似商品(安卓原生 ML 提取标签;Web 降级为图像签名)
- 备份/恢复(JSON+图片)、PDF 导出
- 存储安卓端 SQLite / Web 端 Preferences

## AgentMall 通道

- 商品字段含 `分类/库存数量/单位/批发价`(可空,旧数据兼容);
- `agentmall-export.ts` 一键导出 CSV(名称,分类,价格元,库存,单位),分类关键词自动映射小程序五分类;
- 导出的 CSV 在小程序店主端「商品管理 → 批量导入」直接上架(导入默认下架,确认后上架)。

## 视频批量录入(规划/开发中)

拍一个逛店视频 → 每 N 秒抽帧 → dHash 去重(画面变化大=新商品)→ 候选帧自动设为商品首图 →
安卓端用视觉标签生成名称建议 → 批量确认入库 → 导出 CSV。服务层已就绪
(`video-entry-service.ts` / `frame-dedup.ts`),批量录入页面开发中。

## 开发

```bash
npm install
npm run dev          # Web 开发(0.0.0.0:5173)
npm run build        # vue-tsc 类型检查 + 产物构建(唯一自动校验)
npm run run:android  # 构建并跑安卓(Capacitor)
```

- 唯一校验手段是 `npm run build`,改完必须跑一次;
- 存储分平台:Web=Preferences JSON,安卓=SQLite(`product-store.ts` 是存储唯一入口);
- 文件:Web 存 dataUrl,安卓存 `Directory.Data` 文件路径(`file-service.ts` 抽象)。

## 关联

- AgentMall 小程序:`../AgentMall`(DOC/99-进度跟踪/PROGRESS.md 为项目总进度)
