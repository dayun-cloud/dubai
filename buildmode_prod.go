//go:build !dev

package main

// isDevBuild 生产模式恒为 false（wails build 附加 production 标签，不带 dev）
const isDevBuild = false
