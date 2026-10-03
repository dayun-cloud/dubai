package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	gast "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/text"
)

// FileNode 文件树节点
type FileNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	RelPath  string     `json:"relPath"`
	IsDir    bool       `json:"isDir"`
	Children []FileNode `json:"children,omitempty"`
}

// MediaInfo 媒体文件信息
type MediaInfo struct {
	RelPath  string `json:"relPath"`
	FileName string `json:"fileName"`
	MimeType string `json:"mimeType"`
}

// App struct
type App struct {
	ctx           context.Context
	workspacePath string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	globalCtx = ctx
	a.workspacePath = getWorkspacePath()
	os.MkdirAll(a.workspacePath, 0755)
	os.MkdirAll(filepath.Join(a.workspacePath, "_media"), 0755)

	runtime.LogInfof(a.ctx, "工作区目录: %s (开发模式: %v)", a.workspacePath, isDevBuild)

	// 首次启动时创建使用指南
	a.createWelcomeGuideIfNeeded()

	// 开发模式：确保存在表格功能测试笔记
	if isDevBuild {
		a.createDevTestNoteIfNeeded()
	}
}

// domReady is called after front-end resources have been loaded
func (a App) domReady(ctx context.Context) {}

// beforeClose is called when the application is about to quit
func (a *App) beforeClose(_ context.Context) (prevent bool) {
	return false
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {}

// createWelcomeGuideIfNeeded 首次启动时创建使用指南
func (a *App) createWelcomeGuideIfNeeded() {
	// 检查工作区是否为空（首次启动）
	entries, err := os.ReadDir(a.workspacePath)
	if err != nil {
		return
	}

	// 统计有效文件数（排除 _media 和隐藏文件）
	fileCount := 0
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasPrefix(name, ".") && name != "_media" {
			fileCount++
		}
	}

	// 如果工作区为空，创建使用指南
	if fileCount == 0 {
		// TipTap JSON 格式的使用指南内容
		welcomeJSON := `{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"欢迎使用独白 ✨"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"独白"},{"type":"text","text":"是一款简洁优雅的笔记应用，专注于让记录回归本质。"}]},{"type":"horizontalRule"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"快速开始"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"创建笔记"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"点击左上角的 "},{"type":"text","marks":[{"type":"bold"}],"text":"📄 新建笔记"},{"type":"text","text":" 按钮"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"支持文件夹组织，点击 "},{"type":"text","marks":[{"type":"bold"}],"text":"📁 新建文件夹"},{"type":"text","text":" 创建分类"}]}]}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"编辑笔记"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"使用工具栏快速设置格式"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"支持 "},{"type":"text","marks":[{"type":"bold"}],"text":"Markdown"},{"type":"text","text":" 语法，所见即所得"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"支持插入图片/视频/音频"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"编辑后3s自动保存，无需担心丢失"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ctrl+S手动保存笔记并备份"}]}]}]},{"type":"horizontalRule"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Markdown 及扩展语法指南"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"文字格式"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"加粗文字"},{"type":"text","text":"："},{"type":"text","marks":[{"type":"code"}],"text":"**文字**"},{"type":"text","text":" 或 Ctrl+B"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"斜体文字"},{"type":"text","text":"："},{"type":"text","marks":[{"type":"code"}],"text":"*文字*"},{"type":"text","text":" 或 Ctrl+I"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"underline"}],"text":"下划线"},{"type":"text","text":"：Ctrl+U"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"strike"}],"text":"删除线"},{"type":"text","text":"："},{"type":"text","marks":[{"type":"code"}],"text":"~~文字~~"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"highlight"}],"text":"高亮文本"},{"type":"text","text":"："},{"type":"text","marks":[{"type":"code"}],"text":"==文字=="}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"spoiler"}],"text":"黑幕文本"},{"type":"text","text":"：选中文本后点击工具栏黑幕⬛️按钮"}]}]}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"标题"}]},{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"# 一级标题\n## 二级标题\n### 三级标题"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"列表"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"无序列表："}]},{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"- 项目1\n- 项目2\n  - 子项目"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"有序列表："}]},{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"1. 第一项\n2. 第二项\n3. 第三项"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"引用"}]},{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"> 这是一段引用文字\n> 可以多行显示"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"链接"}]},{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"[链接文字](https://example.com)"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"代码"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"行内代码："},{"type":"text","marks":[{"type":"code"}],"text":"代码"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"代码块："}]},{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"` + "```javascript\\nfunction hello() {\\n  console.log(\\\"Hello World\\\");\\n}\\n```" + `"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"分割线"}]},{"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"---"}]},{"type":"horizontalRule"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"媒体管理"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"插入媒体"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"🖼️ "},{"type":"text","marks":[{"type":"bold"}],"text":"图片"},{"type":"text","text":"：工具栏点击图片按钮"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"🎬 "},{"type":"text","marks":[{"type":"bold"}],"text":"视频"},{"type":"text","text":"：工具栏点击视频按钮"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"🎵 "},{"type":"text","marks":[{"type":"bold"}],"text":"音频"},{"type":"text","text":"：工具栏点击音频按钮"}]}]}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"媒体操作"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"调整大小"},{"type":"text","text":"：拖动媒体边缘调整尺寸"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"右键菜单"},{"type":"text","text":"：打开、查看位置、删除"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"图片查看"},{"type":"text","text":"：点击图片全屏查看，滚轮缩放"}]}]}]},{"type":"horizontalRule"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"笔记迁移"}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"数据位置"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Windows"},{"type":"text","text":": "},{"type":"text","marks":[{"type":"code"}],"text":"C:\\Users\\你的用户名\\AppData\\Roaming\\独白"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"macOS"},{"type":"text","text":": "},{"type":"text","marks":[{"type":"code"}],"text":"~/Library/Application Support/独白"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Linux"},{"type":"text","text":": "},{"type":"text","marks":[{"type":"code"}],"text":"~/.config/独白"},{"type":"text","text":" "}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"笔记存储在："},{"type":"text","marks":[{"type":"code"}],"text":"独白/workspace"},{"type":"text","text":" "},{"type":"hardBreak"},{"type":"text","text":"媒体文件存储在："},{"type":"text","marks":[{"type":"code"}],"text":"独白/workspace/_media"},{"type":"text","text":" "},{"type":"hardBreak"},{"type":"text","text":"备份笔记存储在："},{"type":"text","marks":[{"type":"code"}],"text":"独白/_backup"},{"type":"text","text":" "}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"迁移方法"}]},{"type":"orderedList","attrs":{"start":1,"type":null},"content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"找到上述工作区目录"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"复制整个 "},{"type":"text","marks":[{"type":"code"}],"text":"独白"},{"type":"text","text":" 文件夹"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"将备份的 "},{"type":"text","marks":[{"type":"code"}],"text":"独白"},{"type":"text","text":" 文件夹替换到新设备的配置目录"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"点击左侧工具栏的"},{"type":"text","marks":[{"type":"bold"}],"text":"刷新"},{"type":"text","text":"按钮"}]}]}]},{"type":"horizontalRule"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"键盘快捷键"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Ctrl+S"},{"type":"text","text":"：保存笔记（含备份）"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Ctrl+F"},{"type":"text","text":"：搜索笔记"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Ctrl+B"},{"type":"text","text":"：加粗"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Ctrl+I"},{"type":"text","text":"：斜体"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Ctrl+U"},{"type":"text","text":"：下划线"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"ESC"},{"type":"text","text":"：退出当前界面"}]}]}]},{"type":"horizontalRule"},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"italic"}],"text":"提示：你可以随时删除这篇使用指南，开始你的创作。"}]}]}`

		// 直接写入 JSON 文件
		guidePath := filepath.Join(a.workspacePath, "使用指南.json")
		os.WriteFile(guidePath, []byte(welcomeJSON), 0644)
	}
}

// IsDevMode 前端查询当前是否为开发模式（wails dev），用于显示开发模式标识
func (a *App) IsDevMode() bool {
	return isDevBuild
}

// createDevTestNoteIfNeeded 开发模式下创建表格功能测试笔记（仅当不存在时）
func (a *App) createDevTestNoteIfNeeded() {
	testPath := filepath.Join(a.workspacePath, "表格测试.json")
	if _, err := os.Stat(testPath); err == nil {
		return
	}

	// 含对齐示例的 2x2 表格 + 多行文本，便于验证表格工具栏与粘贴行为
	testJSON := `{"type":"doc","content":[` +
		`{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"表格功能测试"}]},` +
		`{"type":"paragraph","content":[{"type":"text","text":"点击表格内任意单元格，上方会出现表格工具栏，可增删行列、整列对齐、删除表格。"}]},` +
		`{"type":"table","content":[` +
		`{"type":"tableRow","content":[` +
		`{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"列一"}]}]},` +
		`{"type":"tableHeader","attrs":{"textAlign":"center"},"content":[{"type":"paragraph","content":[{"type":"text","text":"列二（已居中）"}]}]}` +
		`]},` +
		`{"type":"tableRow","content":[` +
		`{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"数据 A"}]}]},` +
		`{"type":"tableCell","attrs":{"textAlign":"center"},"content":[{"type":"paragraph","content":[{"type":"text","text":"数据 B"}]}]}` +
		`]}]},` +
		`{"type":"paragraph","content":[{"type":"text","text":"下面几行用于测试粘贴：从外部复制多行文字粘贴到此处，首尾不应多出空行。"}]},` +
		`{"type":"paragraph"},{"type":"paragraph","content":[{"type":"text","text":"第一行"}]},{"type":"paragraph","content":[{"type":"text","text":"第二行"}]},{"type":"paragraph"}]}`

	os.WriteFile(testPath, []byte(testJSON), 0644)
}

// ============================================================
// 文件树相关
// ============================================================

// GetFileTree 获取工作区文件树
func (a *App) GetFileTree() []FileNode {
	// 排除 media 文件夹和隐藏文件
	nodes := a.readDir(a.workspacePath, "")
	return nodes
}

func (a *App) readDir(absPath string, relBase string) []FileNode {
	entries, err := os.ReadDir(absPath)
	if err != nil {
		return nil
	}

	var nodes []FileNode
	for _, entry := range entries {
		name := entry.Name()
		// 跳过隐藏文件和 media 目录
		if strings.HasPrefix(name, ".") || strings.HasSuffix(name, "_media") {
			continue
		}
		// 非目录文件只显示 .json
		if !entry.IsDir() && !strings.HasSuffix(name, ".json") {
			continue
		}

		abs := filepath.Join(absPath, name)
		rel := filepath.Join(relBase, name)

		node := FileNode{
			Name:    name,
			Path:    abs,
			RelPath: rel,
			IsDir:   entry.IsDir(),
		}

		if entry.IsDir() {
			node.Children = a.readDir(abs, rel)
			// 确保 Children 不为 null
			if node.Children == nil {
				node.Children = []FileNode{}
			}
		}
		nodes = append(nodes, node)
	}

	// 排序：文件夹在前，文件在后，同类按名称排序
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].IsDir != nodes[j].IsDir {
			return nodes[i].IsDir
		}
		return strings.ToLower(nodes[i].Name) < strings.ToLower(nodes[j].Name)
	})

	if nodes == nil {
		nodes = []FileNode{}
	}
	return nodes
}

// ============================================================
// 文件夹和笔记操作
// ============================================================

// CreateFolder 创建文件夹
func (a *App) CreateFolder(parentRelPath string, name string) error {
	parentAbs := a.workspacePath
	if parentRelPath != "" {
		parentAbs = filepath.Join(a.workspacePath, parentRelPath)
	}
	dirPath := filepath.Join(parentAbs, name)
	return os.MkdirAll(dirPath, 0755)
}

// CreateNote 创建笔记（.json文件）
func (a *App) CreateNote(parentRelPath string, name string) error {
	parentAbs := a.workspacePath
	if parentRelPath != "" {
		parentAbs = filepath.Join(a.workspacePath, parentRelPath)
	}
	noteName := name
	if !strings.HasSuffix(noteName, ".json") {
		noteName = noteName + ".json"
	}
	filePath := filepath.Join(parentAbs, noteName)
	return os.WriteFile(filePath, []byte(`{"type":"doc","content":[{"type":"paragraph"}]}`), 0644)
}

// RenameEntry 重命名文件或文件夹
func (a *App) RenameEntry(relPath string, newName string) error {
	oldPath := filepath.Join(a.workspacePath, relPath)
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, newName)
	return os.Rename(oldPath, newPath)
}

// DeleteEntry 删除文件或文件夹
func (a *App) DeleteEntry(relPath string) error {
	absPath := filepath.Join(a.workspacePath, relPath)
	return os.RemoveAll(absPath)
}

// MoveEntry 移动文件或文件夹到目标目录（媒体文件已在 _media/ 集中管理，无需跟随移动）
// destDirRel: 目标文件夹的相对路径, "" 表示根目录
func (a *App) MoveEntry(srcRelPath string, destDirRel string) error {
	srcAbs := filepath.Join(a.workspacePath, srcRelPath)
	destDirAbs := a.workspacePath
	if destDirRel != "" {
		destDirAbs = filepath.Join(a.workspacePath, destDirRel)
	}

	baseName := filepath.Base(srcAbs)
	destAbs := filepath.Join(destDirAbs, baseName)

	return os.Rename(srcAbs, destAbs)
}

// DeleteFolderWithContent 删除文件夹，将其内容上移一级后删除
func (a *App) DeleteFolderWithContent(relPath string) error {
	folderAbs := filepath.Join(a.workspacePath, relPath)
	parentAbs := filepath.Dir(folderAbs)

	// 获取文件夹下所有内容
	entries, err := os.ReadDir(folderAbs)
	if err != nil {
		return err
	}

	// 将内容移到上级目录
	for _, entry := range entries {
		srcPath := filepath.Join(folderAbs, entry.Name())
		destPath := filepath.Join(parentAbs, entry.Name())
		if err := os.Rename(srcPath, destPath); err != nil {
			return err
		}
	}

	// 删除空文件夹
	return os.Remove(folderAbs)
}

// ============================================================
// 笔记读写
// ============================================================

// ReadNote 读取笔记内容
func (a *App) ReadNote(relPath string) (string, error) {
	absPath := filepath.Join(a.workspacePath, relPath)
	data, err := os.ReadFile(absPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SaveNote 保存笔记内容
func (a *App) SaveNote(relPath string, content string) error {
	absPath := filepath.Join(a.workspacePath, relPath)
	return os.WriteFile(absPath, []byte(content), 0644)
}

// SaveNoteBackup 保存笔记并创建时间戳备份到 workspace 同级的 _backup 目录
func (a *App) SaveNoteBackup(relPath string, content string) error {
	absPath := filepath.Join(a.workspacePath, relPath)

	// 先保存原文件
	if err := os.WriteFile(absPath, []byte(content), 0644); err != nil {
		return err
	}

	// 创建备份目录（workspace 同级）
	backupDir := filepath.Join(filepath.Dir(a.workspacePath), "_backup")
	relDir := filepath.Dir(relPath)
	if relDir != "." {
		backupDir = filepath.Join(backupDir, relDir)
	}
	os.MkdirAll(backupDir, 0755)

	// 生成带时间戳的备份文件名
	ext := filepath.Ext(relPath)
	base := relPath[:len(relPath)-len(ext)]
	baseName := filepath.Base(base)
	timestamp := time.Now().Format("20060102_150405")
	backupName := fmt.Sprintf("%s_%s%s", baseName, timestamp, ext)
	backupPath := filepath.Join(backupDir, backupName)

	src, err := os.Open(absPath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(backupPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, src)
	return err
}

// ============================================================
// 媒体文件处理
// ============================================================

// ImportMedia 打开文件对话框选择媒体文件，复制到 _media 目录
func (a *App) ImportMedia(noteRelPath string, mediaType string) (*MediaInfo, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择文件",
		Filters: []runtime.FileFilter{
			{
				DisplayName: getMediaFilterName(mediaType),
				Pattern:     getMediaPattern(mediaType),
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if filePath == "" {
		return nil, nil
	}

	origName := filepath.Base(filePath)
	storedName, err := a.copyToMedia(filePath)
	if err != nil {
		return nil, err
	}

	return &MediaInfo{
		RelPath:  storedName,
		FileName: origName,
		MimeType: getMimeType(origName),
	}, nil
}

// ImportMediaFromPath 从指定路径导入媒体文件，复制到 _media 目录
func (a *App) ImportMediaFromPath(sourcePath string, noteRelPath string) (*MediaInfo, error) {
	origName := filepath.Base(sourcePath)
	storedName, err := a.copyToMedia(sourcePath)
	if err != nil {
		return nil, err
	}

	return &MediaInfo{
		RelPath:  storedName,
		FileName: origName,
		MimeType: getMimeType(origName),
	}, nil
}

// copyToMedia 将文件复制到 _media 目录，返回存储后的文件名
// 如果文件已在 _media 目录中则不复制，直接返回原文件名
func (a *App) copyToMedia(sourcePath string) (string, error) {
	mediaDir := filepath.Join(a.workspacePath, "_media")
	os.MkdirAll(mediaDir, 0755)

	origName := filepath.Base(sourcePath)
	mediaPath := filepath.Join(mediaDir, origName)

	// 检查文件是否已在 _media 目录中
	sourceAbs, _ := filepath.Abs(sourcePath)
	mediaAbs, _ := filepath.Abs(mediaPath)
	if sourceAbs == mediaAbs {
		return origName, nil
	}

	// 处理同名文件：追加 _1, _2 等后缀
	destPath := mediaPath
	ext := filepath.Ext(origName)
	base := origName[:len(origName)-len(ext)]
	counter := 1
	for {
		if _, err := os.Stat(destPath); os.IsNotExist(err) {
			break
		}
		destPath = filepath.Join(mediaDir, fmt.Sprintf("%s_%d%s", base, counter, ext))
		counter++
	}

	// 复制文件
	src, err := os.Open(sourcePath)
	if err != nil {
		return "", err
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}

	return filepath.Base(destPath), nil
}

// ImportMarkdownFile 导入外部 .md 文件，转换为 Tiptap JSON 格式
func (a *App) ImportMarkdownFile(destDirRel string) (*FileNode, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "导入 Markdown 文件",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Markdown 文件",
				Pattern:     "*.md",
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if filePath == "" {
		return nil, nil
	}

	// 读取 md 文件内容
	mdData, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	// 转换为 Tiptap JSON
	tiptapJSON, err := markdownToTiptapJSON(mdData)
	if err != nil {
		return nil, fmt.Errorf("转换 Markdown 失败: %w", err)
	}

	destDirAbs := a.workspacePath
	if destDirRel != "" {
		destDirAbs = filepath.Join(a.workspacePath, destDirRel)
	}

	// 生成 .json 文件名
	baseName := filepath.Base(filePath)
	ext := filepath.Ext(baseName)
	jsonName := strings.TrimSuffix(baseName, ext) + ".json"
	destPath := filepath.Join(destDirAbs, jsonName)

	// 处理文件名冲突
	counter := 1
	for {
		if _, err := os.Stat(destPath); os.IsNotExist(err) {
			break
		}
		base := strings.TrimSuffix(jsonName, ".json")
		jsonName = fmt.Sprintf("%s_%d.json", base, counter)
		destPath = filepath.Join(destDirAbs, jsonName)
		counter++
	}

	if err := os.WriteFile(destPath, tiptapJSON, 0644); err != nil {
		return nil, err
	}

	relPath, _ := filepath.Rel(a.workspacePath, destPath)
	return &FileNode{
		Name:    jsonName,
		Path:    destPath,
		RelPath: relPath,
		IsDir:   false,
	}, nil
}

// markdownToTiptapJSON 将 Markdown 内容转换为 Tiptap JSON
func markdownToTiptapJSON(source []byte) ([]byte, error) {
	md := goldmark.New(
		goldmark.WithExtensions(extension.Table),
	)
	doc := md.Parser().Parse(text.NewReader(source))

	contents := buildBlockNodes(doc, source)
	result := map[string]interface{}{
		"type":    "doc",
		"content": contents,
	}
	return json.Marshal(result)
}

// buildBlockNodes 遍历 AST 顶级块节点
func buildBlockNodes(node ast.Node, source []byte) []map[string]interface{} {
	var blocks []map[string]interface{}
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		block := convertASTNode(child, source)
		if block != nil {
			blocks = append(blocks, block)
		}
	}
	if blocks == nil {
		blocks = []map[string]interface{}{}
	}
	return blocks
}

// convertASTNode 将 AST 节点转换为 Tiptap JSON 节点
func convertASTNode(node ast.Node, source []byte) map[string]interface{} {
	switch n := node.(type) {
	case *ast.Heading:
		return map[string]interface{}{
			"type": "heading",
			"attrs": map[string]interface{}{
				"level": n.Level,
			},
			"content": buildInlineNodes(n, source),
		}
	case *ast.Paragraph:
		return map[string]interface{}{
			"type":    "paragraph",
			"content": buildInlineNodes(n, source),
		}
	case *ast.FencedCodeBlock:
		lines := n.Lines()
		var code strings.Builder
		for i := 0; i < lines.Len(); i++ {
			seg := lines.At(i)
			code.Write(seg.Value(source))
		}
		return map[string]interface{}{
			"type": "codeBlock",
			"content": []map[string]interface{}{
				{
					"type": "text",
					"text": code.String(),
				},
			},
		}
	case *ast.List:
		// 检查是否为任务列表：所有 listItem 第一段文本以 [ ] 或 [x] 开头
		isTaskList := !n.IsOrdered()
		if isTaskList {
			for child := n.FirstChild(); child != nil; child = child.NextSibling() {
				if li, ok := child.(*ast.ListItem); ok {
					text := extractFirstText(li, source)
					if !strings.HasPrefix(text, "[ ] ") && !strings.HasPrefix(text, "[x] ") && !strings.HasPrefix(text, "[X] ") {
						isTaskList = false
						break
					}
				}
			}
		}

		if isTaskList {
			var items []map[string]interface{}
			for child := n.FirstChild(); child != nil; child = child.NextSibling() {
				ti := convertTaskListItem(child.(*ast.ListItem), source)
				if ti != nil {
					items = append(items, ti)
				}
			}
			return map[string]interface{}{
				"type":    "taskList",
				"content": items,
			}
		}

		listType := "bulletList"
		if n.IsOrdered() {
			listType = "orderedList"
		}
		var items []map[string]interface{}
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			item := convertASTNode(child, source)
			if item != nil {
				items = append(items, item)
			}
		}
		return map[string]interface{}{
			"type":    listType,
			"content": items,
		}
	case *gast.Table:
		var rows []map[string]interface{}
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			row := convertTableRow(child, source)
			if row != nil {
				rows = append(rows, row)
			}
		}
		return map[string]interface{}{
			"type":    "table",
			"content": rows,
		}
	case *gast.TableHeader:
		return convertTableRow(n, source)
	case *gast.TableRow:
		return convertTableRow(n, source)
	case *ast.ListItem:
		var contents []map[string]interface{}
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			block := convertASTNode(child, source)
			if block != nil {
				contents = append(contents, block)
			}
		}
		return map[string]interface{}{
			"type":    "listItem",
			"content": contents,
		}
	case *ast.Blockquote:
		var contents []map[string]interface{}
		for child := n.FirstChild(); child != nil; child = child.NextSibling() {
			block := convertASTNode(child, source)
			if block != nil {
				contents = append(contents, block)
			}
		}
		return map[string]interface{}{
			"type":    "blockquote",
			"content": contents,
		}
	case *ast.ThematicBreak:
		return map[string]interface{}{
			"type": "horizontalRule",
		}
	case *ast.TextBlock:
		// 纯文本块，转为段落
		return map[string]interface{}{
			"type":    "paragraph",
			"content": buildInlineNodes(n, source),
		}
	}
	return nil
}

// buildInlineNodes 构建行内节点（text + marks）
func buildInlineNodes(parent ast.Node, source []byte) []map[string]interface{} {
	var nodes []map[string]interface{}
	collectInlines(parent, source, &nodes)
	if nodes == nil {
		nodes = []map[string]interface{}{}
	}
	return nodes
}

func collectInlines(node ast.Node, source []byte, nodes *[]map[string]interface{}) {
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch c := child.(type) {
		case *ast.Text:
			text := string(c.Segment.Value(source))
			*nodes = append(*nodes, map[string]interface{}{
				"type": "text",
				"text": text,
			})
		case *ast.String:
			text := string(c.Value)
			*nodes = append(*nodes, map[string]interface{}{
				"type": "text",
				"text": text,
			})
		case *ast.Emphasis:
			// Level 1 = italic, Level 2 = bold
			markType := "italic"
			if c.Level == 2 {
				markType = "bold"
			}
			var innerNodes []map[string]interface{}
			collectInlines(c, source, &innerNodes)
			for i := range innerNodes {
				marks, _ := innerNodes[i]["marks"].([]interface{})
				innerNodes[i]["marks"] = append(marks, map[string]interface{}{
					"type": markType,
				})
			}
			*nodes = append(*nodes, innerNodes...)
		case *ast.CodeSpan:
			var code strings.Builder
			for ic := c.FirstChild(); ic != nil; ic = ic.NextSibling() {
				if t, ok := ic.(*ast.Text); ok {
					code.Write(t.Segment.Value(source))
				}
			}
			*nodes = append(*nodes, map[string]interface{}{
				"type": "text",
				"text": code.String(),
				"marks": []map[string]interface{}{
					{"type": "code"},
				},
			})
		case *ast.Link:
			var innerNodes []map[string]interface{}
			collectInlines(c, source, &innerNodes)
			for i := range innerNodes {
				marks, _ := innerNodes[i]["marks"].([]interface{})
				innerNodes[i]["marks"] = append(marks, map[string]interface{}{
					"type": "link",
					"attrs": map[string]interface{}{
						"href": string(c.Destination),
					},
				})
			}
			*nodes = append(*nodes, innerNodes...)
		case *ast.Image:
			// 图片转自定义 resizableImage 节点
			*nodes = append(*nodes, map[string]interface{}{
				"type": "resizableImage",
				"attrs": map[string]interface{}{
					"src":   string(c.Destination),
					"alt":   string(c.Title),
					"width": 300,
				},
			})
		default:
			// 递归处理未知行内节点
			collectInlines(c, source, nodes)
		}
	}
}

// ============================================================
// Markdown 导入辅助函数
// ============================================================

// extractFirstText 提取节点中第一个纯文本（用于检测任务列表）
func extractFirstText(node ast.Node, source []byte) string {
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if p, ok := child.(*ast.Paragraph); ok {
			return extractAllText(p, source)
		}
		if t, ok := child.(*ast.TextBlock); ok {
			return extractAllText(t, source)
		}
	}
	return ""
}

func extractAllText(node ast.Node, source []byte) string {
	var buf strings.Builder
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if t, ok := child.(*ast.Text); ok {
			buf.Write(t.Segment.Value(source))
		}
	}
	return buf.String()
}

// convertTaskListItem 将 listItem 转为 taskItem
func convertTaskListItem(li *ast.ListItem, source []byte) map[string]interface{} {
	checked := false
	var realContent []map[string]interface{}

	for child := li.FirstChild(); child != nil; child = child.NextSibling() {
		if p, ok := child.(*ast.Paragraph); ok {
			// 去掉 [ ] 或 [x] 前缀
			text := extractAllText(p, source)
			if strings.HasPrefix(text, "[x] ") || strings.HasPrefix(text, "[X] ") {
				checked = true
				text = text[4:]
			} else if strings.HasPrefix(text, "[ ] ") {
				text = text[4:]
			}
			// 重建段落的 inline 节点，去掉前缀
			nodes := buildInlineNodesStripped(p, source, text)
			realContent = append(realContent, map[string]interface{}{
				"type":    "paragraph",
				"content": nodes,
			})
		} else {
			block := convertASTNode(child, source)
			if block != nil {
				realContent = append(realContent, block)
			}
		}
	}

	return map[string]interface{}{
		"type": "taskItem",
		"attrs": map[string]interface{}{
			"checked": checked,
		},
		"content": realContent,
	}
}

// buildInlineNodesStripped 构建行内节点，替换第一个 text 节点去掉前缀
func buildInlineNodesStripped(parent ast.Node, source []byte, strippedText string) []map[string]interface{} {
	var nodes []map[string]interface{}
	firstText := true
	collectInlinesStripped(parent, source, &nodes, &firstText, strippedText)
	if nodes == nil {
		nodes = []map[string]interface{}{}
	}
	return nodes
}

func collectInlinesStripped(node ast.Node, source []byte, nodes *[]map[string]interface{}, firstText *bool, strippedText string) {
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		switch c := child.(type) {
		case *ast.Text:
			text := string(c.Segment.Value(source))
			if *firstText {
				text = strippedText
				*firstText = false
			}
			if text != "" {
				*nodes = append(*nodes, map[string]interface{}{
					"type": "text",
					"text": text,
				})
			}
		case *ast.String:
			text := string(c.Value)
			if *firstText {
				text = strippedText
				*firstText = false
			}
			if text != "" {
				*nodes = append(*nodes, map[string]interface{}{
					"type": "text",
					"text": text,
				})
			}
		case *ast.Emphasis:
			markType := "italic"
			if c.Level == 2 {
				markType = "bold"
			}
			var innerNodes []map[string]interface{}
			collectInlinesStripped(c, source, &innerNodes, firstText, strippedText)
			for i := range innerNodes {
				marks, _ := innerNodes[i]["marks"].([]interface{})
				innerNodes[i]["marks"] = append(marks, map[string]interface{}{
					"type": markType,
				})
			}
			*nodes = append(*nodes, innerNodes...)
		case *ast.CodeSpan:
			var code strings.Builder
			for ic := c.FirstChild(); ic != nil; ic = ic.NextSibling() {
				if t, ok := ic.(*ast.Text); ok {
					code.Write(t.Segment.Value(source))
				}
			}
			// 去掉任务前缀（不太可能出现在 codeSpan 中，但处理一下）
			codeStr := code.String()
			if *firstText {
				codeStr = strippedText
				*firstText = false
			}
			if codeStr != "" {
				*nodes = append(*nodes, map[string]interface{}{
					"type": "text",
					"text": codeStr,
					"marks": []map[string]interface{}{
						{"type": "code"},
					},
				})
			}
		case *ast.Link:
			var innerNodes []map[string]interface{}
			collectInlinesStripped(c, source, &innerNodes, firstText, strippedText)
			for i := range innerNodes {
				marks, _ := innerNodes[i]["marks"].([]interface{})
				innerNodes[i]["marks"] = append(marks, map[string]interface{}{
					"type": "link",
					"attrs": map[string]interface{}{
						"href": string(c.Destination),
					},
				})
			}
			*nodes = append(*nodes, innerNodes...)
		default:
			collectInlinesStripped(c, source, nodes, firstText, strippedText)
		}
	}
}

// convertTableRow 转换表格行
func convertTableRow(node ast.Node, source []byte) map[string]interface{} {
	var cells []map[string]interface{}
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		if cell, ok := child.(*gast.TableCell); ok {
			cellType := "tableCell"
			// 检查是否为表头单元格
			if _, isHeader := node.(*gast.TableHeader); isHeader {
				cellType = "tableHeader"
			}
			cells = append(cells, map[string]interface{}{
				"type":    cellType,
				"content": buildInlineNodes(cell, source),
			})
		}
	}
	return map[string]interface{}{
		"type":    "tableRow",
		"content": cells,
	}
}

// ============================================================
// 工具方法
// ============================================================

// GetWorkspacePath 获取工作区路径
func (a *App) GetWorkspacePath() string {
	return a.workspacePath
}

// OpenMediaLocation 在文件管理器中打开媒体文件所在位置
func (a *App) OpenMediaLocation(fileName string) error {
	mediaPath := filepath.Join(a.workspacePath, "_media", fileName)
	return openFileLocation(mediaPath)
}

// OpenMediaWithDefaultApp 用系统默认程序打开媒体文件
func (a *App) OpenMediaWithDefaultApp(fileName string) error {
	mediaPath := filepath.Join(a.workspacePath, "_media", fileName)
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", mediaPath).Start()
}

// DeleteMediaFile 删除 _media 目录中的媒体文件
func (a *App) DeleteMediaFile(fileName string) error {
	mediaPath := filepath.Join(a.workspacePath, "_media", fileName)
	// 安全检查：确保文件确实在 _media 目录中
	absMedia, _ := filepath.Abs(mediaPath)
	absMediaDir, _ := filepath.Abs(filepath.Join(a.workspacePath, "_media"))
	if !strings.HasPrefix(absMedia, absMediaDir) {
		return fmt.Errorf("无效的媒体文件路径")
	}
	return os.Remove(mediaPath)
}

// OpenExternalLink 用系统默认浏览器打开链接
func (a *App) OpenExternalLink(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

// ============================================================
// 搜索
// ============================================================

// SearchNoteResult 搜索结果
type SearchNoteResult struct {
	RelPath    string `json:"relPath"`    // 相对于 workspace 的路径
	Context    string `json:"context"`    // 匹配上下文
	MatchStart int    `json:"matchStart"` // 关键词在 context 中的起始位置（字符数）
	MatchLen   int    `json:"matchLen"`   // 关键词字符长度
	MatchIndex int    `json:"matchIndex"` // 该文件中第几个匹配 (0-based)
}

// SearchNotes 在所有笔记中搜索关键词
func (a *App) SearchNotes(keyword string) ([]SearchNoteResult, error) {
	if keyword == "" {
		return nil, nil
	}
	kw := strings.ToLower(keyword)
	var results []SearchNoteResult

	err := filepath.Walk(a.workspacePath, func(absPath string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() || !strings.HasSuffix(info.Name(), ".json") {
			return nil
		}
		relPath, _ := filepath.Rel(a.workspacePath, absPath)
		if strings.HasPrefix(relPath, "_media") {
			return nil
		}

		data, err := os.ReadFile(absPath)
		if err != nil {
			return nil
		}

		plainText := extractPlainText(string(data))
		lowerText := strings.ToLower(plainText)
		if !strings.Contains(lowerText, kw) {
			return nil
		}

		// 基于 rune 查找所有匹配位置
		sourceRunes := []rune(plainText)
		lowerRunes := []rune(lowerText)
		kwRunes := []rune(kw)
		kwLen := len(kwRunes)

		var matchPositions []int
		for i := 0; i <= len(lowerRunes)-kwLen; i++ {
			match := true
			for j := 0; j < kwLen; j++ {
				if lowerRunes[i+j] != kwRunes[j] {
					match = false
					break
				}
			}
			if match {
				matchPositions = append(matchPositions, i)
				i += kwLen - 1 // 跳过本次匹配
			}
		}

		// 为每个匹配生成结果
		for idx, runeIdx := range matchPositions {
			ctxStart := runeIdx - 18
			if ctxStart < 0 {
				ctxStart = 0
			}
			ctxEnd := runeIdx + kwLen + 18
			if ctxEnd > len(sourceRunes) {
				ctxEnd = len(sourceRunes)
			}

			snippet := ""
			if ctxStart > 0 {
				snippet += "..."
			}
			snippet += string(sourceRunes[ctxStart:ctxEnd])
			if ctxEnd < len(sourceRunes) {
				snippet += "..."
			}

			matchStart := runeIdx - ctxStart
			if ctxStart > 0 {
				matchStart += 3 // "..." 的字符数
			}

			results = append(results, SearchNoteResult{
				RelPath:    filepath.ToSlash(relPath),
				Context:    snippet,
				MatchStart: matchStart,
				MatchLen:   kwLen,
				MatchIndex: idx,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

// ============================================================
// 高亮合集
// ============================================================

// HighlightResult 高亮结果
type HighlightResult struct {
	RelPath     string `json:"relPath"`     // 笔记相对路径
	NoteName    string `json:"noteName"`    // 笔记名称（无后缀）
	Highlighted string `json:"highlighted"` // 被高亮的文本
	Context     string `json:"context"`     // 上下文片段
}

// GetHighlights 获取所有笔记中的高亮文本
func (a *App) GetHighlights() ([]HighlightResult, error) {
	var results []HighlightResult

	err := filepath.Walk(a.workspacePath, func(absPath string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() || !strings.HasSuffix(info.Name(), ".json") {
			return nil
		}
		relPath, _ := filepath.Rel(a.workspacePath, absPath)
		if strings.HasPrefix(relPath, "_media") || strings.HasPrefix(relPath, "_backup") {
			return nil
		}

		data, err := os.ReadFile(absPath)
		if err != nil {
			return nil
		}

		var doc map[string]interface{}
		if err := json.Unmarshal(data, &doc); err != nil {
			return nil
		}

		noteName := strings.TrimSuffix(info.Name(), ".json")
		extractHighlights(doc, relPath, noteName, &results)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

// extractHighlights 递归提取高亮文本
func extractHighlights(node map[string]interface{}, relPath, noteName string, results *[]HighlightResult) {
	if node == nil {
		return
	}

	// 处理有 content 的块级节点（paragraph, heading, listItem 等）
	if content, ok := node["content"]; ok {
		if arr, ok := content.([]interface{}); ok {
			// 先收集该块内所有文本和哪些被高亮
			type textSpan struct {
				text      string
				highlight bool
			}
			var spans []textSpan
			hasHighlight := false

			for _, item := range arr {
				if m, ok := item.(map[string]interface{}); ok {
					if t, ok := m["text"]; ok {
						textStr, _ := t.(string)
						hl := false
						if marks, ok := m["marks"]; ok {
							if marksArr, ok := marks.([]interface{}); ok {
								for _, mark := range marksArr {
									if markMap, ok := mark.(map[string]interface{}); ok {
										if mt, _ := markMap["type"].(string); mt == "highlight" {
											hl = true
											hasHighlight = true
										}
									}
								}
							}
						}
						spans = append(spans, textSpan{text: textStr, highlight: hl})
					} else {
						// 嵌套子节点（如 bold 内的 text），递归处理
						extractHighlights(m, relPath, noteName, results)
					}
				}
			}

			// 如果该块有高亮，构建上下文
			if hasHighlight {
				// 拼接上下文全文
				var fullText strings.Builder
				for _, s := range spans {
					fullText.WriteString(s.text)
				}
				fullContext := fullText.String()

				for _, s := range spans {
					if s.highlight && s.text != "" {
						// 截取上下文（高亮部分前后各取最多 30 个 rune）
						hlIdx := strings.Index(fullContext, s.text)
						snippet := ""
						if hlIdx > 0 {
							prefix := []rune(fullContext[:hlIdx])
							if len(prefix) > 30 {
								snippet += "..." + string(prefix[len(prefix)-30:])
							} else {
								snippet += string(prefix)
							}
						}
						snippet += s.text
						suffix := []rune(fullContext[hlIdx+len(s.text):])
						if len(suffix) > 30 {
							snippet += string(suffix[:30]) + "..."
						} else {
							snippet += string(suffix)
						}

						*results = append(*results, HighlightResult{
							RelPath:     filepath.ToSlash(relPath),
							NoteName:    noteName,
							Highlighted: s.text,
							Context:     snippet,
						})
					}
				}
			}
		}
	}
}

// extractPlainText 从 Tiptap JSON 中提取纯文本和媒体文件名
func extractPlainText(content string) string {
	var doc map[string]interface{}
	if err := json.Unmarshal([]byte(content), &doc); err != nil {
		// 不是 JSON 格式，直接返回原始内容（兼容纯文本/markdown）
		return content
	}

	var texts []string
	extractTextFromNode(doc, &texts)
	return strings.Join(texts, "")
}

func extractTextFromNode(node map[string]interface{}, texts *[]string) {
	if node == nil {
		return
	}

	// 文本节点
	if t, ok := node["text"]; ok {
		if s, ok := t.(string); ok {
			*texts = append(*texts, s)
		}
	}

	// 媒体节点：提取文件名
	if t, ok := node["type"]; ok {
		typeStr, _ := t.(string)
		if typeStr == "resizableImage" || typeStr == "videoNode" || typeStr == "audioNode" {
			if attrs, ok := node["attrs"]; ok {
				attrsMap, _ := attrs.(map[string]interface{})
				if src, ok := attrsMap["src"]; ok {
					srcStr, _ := src.(string)
					if srcStr != "" {
						fileName := filepath.Base(srcStr)
						*texts = append(*texts, "["+fileName+"]")
					}
				}
			}
		}
	}

	// 递归处理子节点
	if content, ok := node["content"]; ok {
		if arr, ok := content.([]interface{}); ok {
			for _, item := range arr {
				if m, ok := item.(map[string]interface{}); ok {
					extractTextFromNode(m, texts)
				}
			}
		}
	}

	// 处理 marks（如链接文本等）
	if marks, ok := node["marks"]; ok {
		if arr, ok := marks.([]interface{}); ok {
			for _, item := range arr {
				if m, ok := item.(map[string]interface{}); ok {
					if href, ok := m["href"]; ok {
						if s, ok := href.(string); ok {
							*texts = append(*texts, " "+s)
						}
					}
				}
			}
		}
	}
}

// ============================================================
// 辅助函数
// ============================================================

func getMediaFilterName(mediaType string) string {
	switch mediaType {
	case "image":
		return "图片文件"
	case "video":
		return "视频文件"
	case "audio":
		return "音频文件"
	default:
		return "所有文件"
	}
}

func getMediaPattern(mediaType string) string {
	switch mediaType {
	case "image":
		return "*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp;*.svg"
	case "video":
		return "*.mp4;*.webm;*.mov;*.avi;*.mkv"
	case "audio":
		return "*.mp3;*.wav;*.ogg;*.flac;*.aac;*.m4a"
	default:
		return "*.*"
	}
}

func getMimeType(fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".bmp":
		return "image/bmp"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".avi":
		return "video/x-msvideo"
	case ".mkv":
		return "video/x-matroska"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".flac":
		return "audio/flac"
	case ".aac":
		return "audio/aac"
	case ".m4a":
		return "audio/mp4"
	default:
		return "application/octet-stream"
	}
}

// openFileLocation 在 Windows 资源管理器中打开并选中指定文件
func openFileLocation(filePath string) error {
	return exec.Command("explorer", "/select,", filePath).Start()
}
