package main

import (
	"embed"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/src
var assets embed.FS

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
			UniqueId: "dubai-app-single-instance",
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

func getWorkspacePath() string {
	exePath, err := os.Executable()
	if err != nil {
		return filepath.Join(".", "workspace")
	}
	return filepath.Join(filepath.Dir(exePath), "workspace")
}

func runtimeWindowShow() {
	// This will be handled by Wails single instance lock
}
