package main

import (
	"context"
	"embed"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/src
var assets embed.FS

// globalCtx 保存应用上下文，供单实例回调使用
var globalCtx context.Context

func main() {
	app := NewApp()

	workspacePath := getWorkspacePath()

	err := wails.Run(&options.App{
		Title:                    "独白",
		Width:                    1200,
		Height:                   800,
		MinWidth:                 800,
		MinHeight:                500,
		Frameless:                true,
		EnableDefaultContextMenu: false,
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: singleInstanceID(),
			OnSecondInstanceLaunch: func(secondInstanceData options.SecondInstanceData) {
				runtimeWindowShow()
			},
		},
		AssetServer: &assetserver.Options{
			Assets: assets,
			Middleware: func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if strings.HasPrefix(r.URL.Path, "/workspace/") {
						filePath := filepath.Join(workspacePath, strings.TrimPrefix(r.URL.Path, "/workspace/"))
						http.ServeFile(w, r, filePath)
						return
					}
					if strings.HasPrefix(r.URL.Path, "/media/") {
						fileName := strings.TrimPrefix(r.URL.Path, "/media/")
						http.ServeFile(w, r, filepath.Join(workspacePath, "_media", fileName))
						return
					}
					next.ServeHTTP(w, r)
				})
			},
		},
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 30, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			IsZoomControlEnabled: false,
			DisablePinchZoom:     true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

// getWorkspacePath 返回笔记工作区路径。
// 开发模式（wails dev，带 -tags dev 构建）使用独立的 独白-dev 目录，
// 确保开发调试永远不会读写到真实笔记数据。
func getWorkspacePath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		exePath, exeErr := os.Executable()
		if exeErr != nil {
			return filepath.Join(".", "workspace")
		}
		return filepath.Join(filepath.Dir(exePath), "workspace")
	}
	rootName := "独白"
	if isDevBuild {
		rootName = "独白-dev"
	}
	return filepath.Join(configDir, rootName, "workspace")
}

// singleInstanceID 开发模式使用独立的单实例锁，避免开发实例与正式版互相抢占焦点
func singleInstanceID() string {
	if isDevBuild {
		return "dubai-app-single-instance-dev"
	}
	return "dubai-app-single-instance"
}

func runtimeWindowShow() {
	// 恢复可能最小化的窗口，并显示到前台
	if globalCtx != nil {
		runtime.WindowUnminimise(globalCtx)
		runtime.WindowShow(globalCtx)
	}
}
