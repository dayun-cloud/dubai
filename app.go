package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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
}

// domReady is called after front-end resources have been loaded
func (a App) domReady(ctx context.Context) {}

// beforeClose is called when the application is about to quit
func (a *App) beforeClose(_ context.Context) (prevent bool) {
	return false
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {}

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
		// 非目录文件只显示 .md
		if !entry.IsDir() && !strings.HasSuffix(name, ".md") {
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

// CreateNote 创建笔记（.md文件）
func (a *App) CreateNote(parentRelPath string, name string) error {
	parentAbs := a.workspacePath
	if parentRelPath != "" {
		parentAbs = filepath.Join(a.workspacePath, parentRelPath)
	}
	noteName := name
	if !strings.HasSuffix(noteName, ".md") {
		noteName = noteName + ".md"
	}
	filePath := filepath.Join(parentAbs, noteName)
	return os.WriteFile(filePath, []byte(""), 0644)
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

// ImportMarkdownFile 导入外部 .md 文件
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

	destDirAbs := a.workspacePath
	if destDirRel != "" {
		destDirAbs = filepath.Join(a.workspacePath, destDirRel)
	}

	fileName := filepath.Base(filePath)
	destPath := filepath.Join(destDirAbs, fileName)

	// 处理文件名冲突
	counter := 1
	for {
		if _, err := os.Stat(destPath); os.IsNotExist(err) {
			break
		}
		ext := filepath.Ext(fileName)
		base := strings.TrimSuffix(fileName, ext)
		fileName = fmt.Sprintf("%s_%d%s", base, counter, ext)
		destPath = filepath.Join(destDirAbs, fileName)
		counter++
	}

	srcFile, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(destPath)
	if err != nil {
		return nil, err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return nil, err
	}

	relPath, _ := filepath.Rel(a.workspacePath, destPath)
	return &FileNode{
		Name:    fileName,
		Path:    destPath,
		RelPath: relPath,
		IsDir:   false,
	}, nil
}

// ============================================================
// 工具方法
// ============================================================

// GetWorkspacePath 获取工作区路径
func (a *App) GetWorkspacePath() string {
	return a.workspacePath
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
		if info.IsDir() || !strings.HasSuffix(info.Name(), ".md") {
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
