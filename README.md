# 独白

本地笔记应用，基于 Wails v2 + Tiptap 富文本编辑器构建。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Wails v2](https://wails.io) (Go + Web 前端) |
| 后端 | Go, goldmark (Markdown 解析) |
| 编辑器 | [Tiptap](https://tiptap.dev) (ProseMirror) |
| 前端 | 原生 HTML / CSS / JS（无框架） |

## 功能

- **富文本编辑**：加粗、斜体、删除线、下划线、高亮、黑幕标记、标题、引用、链接
- **表格**：工具栏一键插入 2×2 表格；光标进入表格时上方浮动工具栏支持增删行列、整列对齐、删除表格，列宽可拖动调整
- **媒体嵌入**：支持图片（可缩放）、视频、音频
- **文件管理**：侧边栏文件树，支持新建/重命名/删除/拖拽移动笔记和文件夹
- **全文搜索**：跨笔记搜索，点击结果定位到关键词
- **高亮合集**：汇总所有笔记中被高亮标记的段落
- **备份**：Ctrl+S 手动保存时将当前内容备份到 `_backup` 目录
- **Markdown 导入**：导入 `.md` 文件自动转换为 Tiptap JSON 格式
- **自动保存**：3 秒无操作自动保存当前笔记

## 项目结构

```
dubai/
├── app.go              # 后端业务逻辑（文件操作、搜索、高亮、导入）
├── main.go             # Wails 入口、路由、窗口配置
├── wails.json          # 项目配置
├── frontend/
│   ├── src/
│   │   ├── index.html  # 主界面
│   │   ├── main.js     # 前端逻辑（编辑器、事件、面板）
│   │   ├── main.css    # 样式（暗色主题）
│   │   └── tiptap-bundle.js  # Tiptap 打包
│   ├── tiptap-entry.js # Tiptap 扩展入口
│   └── build-editor.mjs # 打包脚本
├── build/              # 构建配置与图标
│   └── windows/
│       └── icon.ico
├── go.mod
└── go.sum
```

## 数据存储

笔记以 Tiptap JSON 格式（`.json`）保存在工作区目录中。工作区路径默认为用户配置目录下的 `独白/workspace`。媒体文件统一存放在 `_media/` 子目录。

## 开发

```bash
# 安装依赖
go mod tidy
cd frontend && npm install

# 启动开发模式（热重载）
wails dev

# 构建生产版本
wails build
```

### 开发模式数据隔离

`wails dev` 使用独立的测试数据目录（`独白-dev/workspace`，与正式版的 `独白/workspace` 完全隔离），不会读写真实笔记，备份也落在 `独白-dev/_backup`。隔离通过 Go 构建标签实现：`wails dev` 自动附加 `-tags dev`（见 `buildmode_dev.go` / `buildmode_prod.go`），`wails build` 不带该标签。开发模式下标题栏会显示 DEV 徽标，便于确认当前运行的是隔离环境。首次启动会自动创建「表格测试」笔记用于验证表格功能。

## 许可证

[MIT License](LICENSE)
