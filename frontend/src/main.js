// ============================================================
// 独白 - 前端主逻辑
// ============================================================

// ============================================================
// 全局状态
// ============================================================
const state = {
    currentNote: null,          // 当前打开的笔记 relPath
    currentNoteName: null,      // 当前笔记文件名
    fileTree: [],               // 文件树数据
    expandedDirs: {},           // 展开的目录
    isDirty: false,             // 是否有未保存的修改
    audioEl: null,              // 当前音频元素
    audioContext: null,         // 当前音频上下文（文件名等）
    dragData: null,             // 拖拽数据
    sidebarWidth: 280,          // 侧边栏宽度
    inlineEditPath: null,       // 内联编辑中的节点路径
    inlineEditIsNew: false,     // 内联编辑是否是新建项
};

// Wails 运行时方法引用
const App = window.go?.main?.App;

// ============================================================
// DOM 元素引用
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
    titlebar: $('#titlebar'),
    fileTree: $('#file-tree'),
    editorContent: $('#editor-content'),
    editorEmpty: $('#editor-empty'),
    editorWrapper: $('#editor-wrapper'),
    audioControls: $('#audio-controls'),
    audioName: $('#audio-name'),
    audioTime: $('#audio-time'),
    audioProgressFill: $('#audio-progress-fill'),
    audioProgressBar: $('#audio-progress-bar'),
    audioVolume: $('#audio-volume'),
    imageViewer: $('#image-viewer'),
    imageViewerImg: $('#image-viewer-img'),
    videoPlayer: $('#video-player'),
    videoPlayerEl: $('#video-player-el'),
    contextMenu: $('#context-menu'),
    contextMenuFolder: $('#context-menu-folder'),
    renameOverlay: $('#rename-overlay'),
    renameInput: $('#rename-input'),
    sidebar: $('#sidebar'),
    sidebarResizer: $('#sidebar-resizer'),
    editorToolbar: $('#editor-toolbar'),
    confirmDialog: $('#confirm-dialog'),
    confirmMsg: $('#confirm-msg'),
    confirmOk: $('#confirm-ok'),
    confirmCancel: $('#confirm-cancel'),
};

// ============================================================
// 工具函数
// ============================================================

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function notify(msg, type = 'success') {
    const existing = $('.notification');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `notification ${type} show`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 2000);
}

// 自定义确认对话框（替代浏览器原生 confirm）
function showConfirm(msg) {
    return new Promise((resolve) => {
        el.confirmMsg.textContent = msg;
        el.confirmDialog.style.display = '';

        function cleanup(result) {
            el.confirmDialog.style.display = 'none';
            el.confirmOk.onclick = null;
            el.confirmCancel.onclick = null;
            el.confirmDialog.onkeydown = null;
            resolve(result);
        }

        el.confirmOk.onclick = () => cleanup(true);
        el.confirmCancel.onclick = () => cleanup(false);
        el.confirmOk.focus();

        el.confirmDialog.onkeydown = (e) => {
            if (e.key === 'Enter') cleanup(true);
            if (e.key === 'Escape') cleanup(false);
        };
    });
}

function getFileNameWithoutExt(name) {
    return name.replace(/\.md$/i, '');
}

function getFileNameFromPath(path) {
    return path.split(/[/\\]/).pop();
}

function getParentRelPath(relPath) {
    const parts = relPath.split(/[/\\]/);
    parts.pop();
    return parts.join('/');
}

// ============================================================
// Markdown ↔ HTML 转换
// ============================================================

function htmlToMarkdown(html) {
    let md = html;

    // 处理自定义视频占位
    md = md.replace(/<div\s+class="editor-video-placeholder"[^>]*data-src="([^"]*)"[^>]*data-name="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
        (_, src, name) => `\n[video](${src} "${name}")\n`);
    
    // 处理自定义音频占位
    md = md.replace(/<div\s+class="editor-audio-placeholder"[^>]*data-src="([^"]*)"[^>]*data-name="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
        (_, src, name) => `\n[audio](${src} "${name}")\n`);

    // 换行
    md = md.replace(/<br\s*\/?>/gi, '\n');
    
    // 分割线
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

    // 图片
    md = md.replace(/<img[^>]+src="([^"]*)"[^>]*>/gi, (_, src) => `\n![](${src})\n`);

    // 高亮
    md = md.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==');

    // 加粗
    md = md.replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**');

    // 斜体
    md = md.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*');

    // 下划线 - 保留 HTML
    md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');

    // 删除线
    md = md.replace(/<(?:s|strike|del)[^>]*>([\s\S]*?)<\/(?:s|strike|del)>/gi, '~~$1~~');

    // 段落处理 - 双换行
    md = md.replace(/<\/p>/gi, '\n\n');
    md = md.replace(/<p[^>]*>/gi, '');

    // div 块
    md = md.replace(/<\/div>/gi, '\n');
    md = md.replace(/<div[^>]*>/gi, '');

    // 其他块级元素
    md = md.replace(/<\/(?:h[1-6])>/gi, '\n\n');
    md = md.replace(/<(?:h[1-6])[^>]*>/gi, '');

    // 移除其他 HTML 标签
    md = md.replace(/<[^>]+>/g, '');

    // HTML 实体解码
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&quot;/g, '"');

    // 清理多余空行
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.trim();

    return md;
}

function markdownToHtml(md) {
    if (!md) return '';

    let html = md;

    // 转义 HTML
    html = html.replace(/&/g, '&amp;');
    html = html.replace(/</g, '&lt;');
    html = html.replace(/>/g, '&gt;');
    html = html.replace(/"/g, '&quot;');

    // 自定义视频语法 [video](src "name")
    html = html.replace(/\[video\]\(([^)]+)\s+"([^"]*)"\)/g,
        (_, src, name) => `<div class="editor-video-placeholder" contenteditable="false" data-src="${src}" data-name="${name}">` +
            `<video src="${src}" preload="metadata" controls></video>` +
            `</div>`);

    // 自定义音频语法 [audio](src "name")
    html = html.replace(/\[audio\]\(([^)]+)\s+"([^"]*)"\)/g,
        (_, src, name) => `<div class="editor-audio-placeholder" contenteditable="false" data-src="${src}" data-name="${name}">` +
            `<div class="audio-icon-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></div>` +
            `<span class="audio-filename">${name}</span>` +
            `</div>`);

    // 图片 ![alt](src)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
        (_, alt, src) => `<span class="resizable-image" contenteditable="false" style="width:300px;"><img src="${src}" alt="${alt}"></span>`);

    // 高亮 ==text==
    html = html.replace(/==([^=]+)==/g, '<mark>$1</mark>');

    // 加粗 **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 斜体 *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 删除线 ~~text~~
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // 下划线 <u>text</u>
    html = html.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>');

    // 分割线 ---
    html = html.replace(/^---$/gm, '<hr>');

    // 换行处理
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
}

// ============================================================
// 标题栏控制（JS 自定义拖动，不依赖 -webkit-app-region）
// ============================================================
function initTitlebar() {
    $('#btn-minimize').addEventListener('click', () => {
        window.runtime?.WindowMinimise();
    });
    $('#btn-maximize').addEventListener('click', async () => {
        if (window.runtime?.WindowIsMaximised) {
            const isMax = await window.runtime.WindowIsMaximised();
            if (isMax) {
                await window.runtime.WindowUnmaximise();
            } else {
                await window.runtime.WindowMaximise();
            }
        }
    });
    $('#btn-close').addEventListener('click', () => {
        window.runtime?.Quit();
    });

    // 双击标题栏最大化/还原
    el.titlebar.addEventListener('dblclick', async (e) => {
        if (e.target.closest('.titlebar-controls')) return;
        if (window.runtime?.WindowIsMaximised) {
            const isMax = await window.runtime.WindowIsMaximised();
            if (isMax) {
                await window.runtime.WindowUnmaximise();
            } else {
                await window.runtime.WindowMaximise();
            }
        }
    });

    // JS 自定义窗口拖动（替代不可靠的 -webkit-app-region）
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let winStartX = 0;
    let winStartY = 0;

    el.titlebar.addEventListener('mousedown', async (e) => {
        if (e.target.closest('.titlebar-controls')) return;
        if (e.button !== 0) return;
        isDragging = true;
        dragStartX = e.screenX;
        dragStartY = e.screenY;
        try {
            const pos = await window.runtime.WindowGetPosition();
            winStartX = pos.x;
            winStartY = pos.y;
        } catch (_) {}
        e.preventDefault();
    });

    document.addEventListener('mousemove', async (e) => {
        if (!isDragging) return;
        const dx = e.screenX - dragStartX;
        const dy = e.screenY - dragStartY;
        try {
            window.runtime.WindowSetPosition(winStartX + dx, winStartY + dy);
        } catch (_) {}
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// ============================================================
// 侧边栏拖拽调整宽度
// ============================================================
function initSidebarResizer() {
    let startX = 0;
    let startWidth = 0;

    el.sidebarResizer.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startWidth = el.sidebar.offsetWidth;
        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', onResizeEnd);
        e.preventDefault();
    });

    function onResize(e) {
        const dx = e.clientX - startX;
        const newWidth = Math.max(180, Math.min(500, startWidth + dx));
        el.sidebar.style.width = newWidth + 'px';
        state.sidebarWidth = newWidth;
    }

    function onResizeEnd() {
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('mouseup', onResizeEnd);
    }
}

// ============================================================
// 文件树
// ============================================================

async function refreshFileTree() {
    if (!App) return;
    try {
        state.fileTree = await App.GetFileTree();
        renderFileTree();
    } catch (err) {
        console.error('获取文件树失败:', err);
    }
}

function renderFileTree() {
    el.fileTree.innerHTML = '';

    if (!state.fileTree || state.fileTree.length === 0) {
        el.fileTree.innerHTML = '<div class="tree-empty">暂无笔记，点击 + 创建</div>';
        return;
    }

    state.fileTree.forEach(node => {
        el.fileTree.appendChild(createTreeNode(node, 0));
    });
}

function createTreeNode(node, depth) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node';
    wrapper.dataset.relPath = node.relPath;
    wrapper.dataset.isDir = node.isDir;

    const header = document.createElement('div');
    header.className = 'tree-node-header';
    header.style.paddingLeft = (8 + depth * 16) + 'px';
    header.draggable = true;

    // 当前激活的笔记高亮
    if (!node.isDir && state.currentNote === node.relPath) {
        header.classList.add('active');
    }

    // 文件夹展开/折叠箭头
    const arrow = document.createElement('span');
    arrow.className = 'tree-arrow';
    if (node.isDir) {
        arrow.textContent = '▶';
        if (state.expandedDirs[node.relPath]) {
            arrow.classList.add('expanded');
        }
    } else {
        arrow.classList.add('tree-arrow-hidden');
    }
    header.appendChild(arrow);

    // 图标
    const icon = document.createElement('span');
    icon.className = 'tree-node-icon';
    if (node.isDir) {
        icon.classList.add('folder');
        icon.innerHTML = state.expandedDirs[node.relPath]
            ? '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H8.414L7.121 2.707A1 1 0 0 0 6.414 2.5H3a1 1 0 0 0-1 .5z" fill="currentColor" opacity="0.8"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H8.414L7.121 2.707A1 1 0 0 0 6.414 2.5H3a1 1 0 0 0-1 .5z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
    } else {
        icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M10 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4l-4-3z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 1v3h3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
    }
    header.appendChild(icon);

    // 名称（支持内联编辑）
    const isInlineEditing = (state.inlineEditPath === node.relPath);
    if (isInlineEditing) {
        const input = document.createElement('input');
        input.className = 'tree-inline-input';
        input.value = node.isDir ? node.name : getFileNameWithoutExt(node.name);
        header.appendChild(input);

        setTimeout(() => { input.focus(); input.select(); }, 50);

        const finalizeRename = async () => {
            const newName = input.value.trim();
            const oldName = node.isDir ? node.name : getFileNameWithoutExt(node.name);
            if (newName && newName !== oldName) {
                let finalName = node.isDir ? newName : (newName.endsWith('.md') ? newName : newName + '.md');
                try {
                    await App.RenameEntry(node.relPath, finalName);
                    // 如果是当前笔记，更新引用
                    if (state.currentNote === node.relPath) {
                        const parentRel = getParentRelPath(node.relPath);
                        state.currentNote = parentRel ? parentRel + '/' + finalName : finalName;
                        state.currentNoteName = finalName;
                    }
                } catch (err) {
                    console.error('重命名失败:', err);
                    notify('重命名失败: ' + err, 'error');
                }
            }
            state.inlineEditPath = null;
            await refreshFileTree();
        };

        const cancelInline = async () => {
            if (state.inlineEditIsNew) {
                try {
                    await App.DeleteEntry(node.relPath);
                    if (state.currentNote === node.relPath) closeNote();
                } catch (err) {
                    console.error('取消创建失败:', err);
                }
            }
            state.inlineEditPath = null;
            state.inlineEditIsNew = false;
            await refreshFileTree();
        };

        let finalized = false;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!finalized) { finalized = true; finalizeRename(); }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (!finalized) { finalized = true; cancelInline(); }
            }
        });

        input.addEventListener('blur', () => {
            if (!finalized) { finalized = true; setTimeout(finalizeRename, 150); }
        });
    } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-node-name';
        nameSpan.textContent = node.isDir ? node.name : getFileNameWithoutExt(node.name);
        header.appendChild(nameSpan);
    }

    // 事件绑定
    header.addEventListener('click', (e) => {
        e.stopPropagation();
        if (node.isDir) {
            toggleDir(node.relPath);
        } else {
            openNote(node.relPath, node.name);
        }
    });

    header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, node);
    });

    // 拖拽事件
    header.addEventListener('dragstart', (e) => {
        state.dragData = node;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.relPath);
    });
    header.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (node.isDir) {
            header.classList.add('drag-over');
        }
    });
    header.addEventListener('dragleave', () => {
        header.classList.remove('drag-over');
    });
    header.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.remove('drag-over');
        const srcNode = state.dragData;
        if (!srcNode) return;
        if (srcNode.relPath === node.relPath) return;

        let destDir = node.isDir ? node.relPath : getParentRelPath(node.relPath);
        try {
            await App.MoveEntry(srcNode.relPath, destDir);
            await refreshFileTree();
            state.dragData = null;
        } catch (err) {
            console.error('移动失败:', err);
            notify('移动失败: ' + err, 'error');
        }
    });

    wrapper.appendChild(header);

    // 子节点
    if (node.isDir && node.children) {
        const children = document.createElement('div');
        children.className = 'tree-children';
        if (state.expandedDirs[node.relPath]) {
            children.classList.add('expanded');
        }
        node.children.forEach(child => {
            children.appendChild(createTreeNode(child, depth + 1));
        });
        wrapper.appendChild(children);
    }

    return wrapper;
}

function toggleDir(relPath) {
    state.expandedDirs[relPath] = !state.expandedDirs[relPath];
    renderFileTree();
}

// ============================================================
// 笔记操作
// ============================================================

async function openNote(relPath, name) {
    // 先保存当前笔记
    if (state.isDirty && state.currentNote) {
        await saveCurrentNote();
    }

    try {
        const content = await App.ReadNote(relPath);
        state.currentNote = relPath;
        state.currentNoteName = name;
        state.isDirty = false;

        el.editorEmpty.style.display = 'none';
        el.editorContent.style.display = 'block';
        el.editorContent.innerHTML = markdownToHtml(content);
        el.editorContent.focus();

        // 绑定媒体点击事件
        bindMediaClickEvents();

        renderFileTree();
        updateToolbarState();
    } catch (err) {
        console.error('打开笔记失败:', err);
        notify('打开笔记失败: ' + err, 'error');
    }
}

async function saveCurrentNote() {
    if (!state.currentNote) return;
    try {
        const html = el.editorContent.innerHTML;
        const md = htmlToMarkdown(html);
        await App.SaveNote(state.currentNote, md);
        state.isDirty = false;
    } catch (err) {
        console.error('保存失败:', err);
        notify('保存失败: ' + err, 'error');
    }
}

function closeNote() {
    state.currentNote = null;
    state.currentNoteName = null;
    state.isDirty = false;
    el.editorContent.style.display = 'none';
    el.editorContent.innerHTML = '';
    el.editorEmpty.style.display = '';
    renderFileTree();
    updateToolbarState();
}

// ============================================================
// 媒体点击绑定
// ============================================================

function bindMediaClickEvents() {
    // 图片点击查看大图
    el.editorContent.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            openImageViewer(img.src);
        });
    });

    // 视频：controls 属性自带播放/全屏，无需额外点击处理

    // 音频占位点击
    el.editorContent.querySelectorAll('.editor-audio-placeholder').forEach(div => {
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            const src = div.dataset.src;
            const name = div.dataset.name;
            playAudio(src, name);
        });
    });
}

// ============================================================
// 图片查看器
// ============================================================

function openImageViewer(src) {
    el.imageViewerImg.src = src;
    el.imageViewer.style.display = '';
}

function closeImageViewer() {
    el.imageViewer.style.display = 'none';
    el.imageViewerImg.src = '';
}

$('#btn-close-viewer').addEventListener('click', closeImageViewer);
$('.image-viewer-bg').addEventListener('click', closeImageViewer);

// ============================================================
// 视频播放器
// ============================================================

function openVideoPlayer(src) {
    el.videoPlayerEl.src = src;
    el.videoPlayer.style.display = '';
    el.videoPlayerEl.play();
}

function closeVideoPlayer() {
    el.videoPlayer.style.display = 'none';
    el.videoPlayerEl.pause();
    el.videoPlayerEl.src = '';
}

$('#btn-close-video').addEventListener('click', closeVideoPlayer);
$('.video-player-bg').addEventListener('click', closeVideoPlayer);

// ============================================================
// 音频播放器
// ============================================================

function playAudio(src, name) {
    // 停止之前的音频
    if (state.audioEl) {
        state.audioEl.pause();
        state.audioEl = null;
    }

    const audio = new Audio(src);
    audio.volume = el.audioVolume.value / 100;
    state.audioEl = audio;
    state.audioContext = { src, name };

    el.audioControls.style.display = '';
    el.audioName.textContent = name;
    updatePlayPauseIcon(false);

    audio.addEventListener('timeupdate', updateAudioProgress);
    audio.addEventListener('loadedmetadata', updateAudioProgress);
    audio.addEventListener('ended', () => {
        updatePlayPauseIcon(false);
        updateAudioProgress();
    });

    audio.play().then(() => {
        updatePlayPauseIcon(true);
    }).catch(err => {
        console.error('音频播放失败:', err);
    });
}

function updatePlayPauseIcon(playing) {
    const btn = $('#btn-audio-play');
    if (playing) {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="2" width="3" height="12" fill="currentColor"/><rect x="10" y="2" width="3" height="12" fill="currentColor"/></svg>';
    } else {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16"><polygon points="4,2 4,14 13,8" fill="currentColor"/></svg>';
    }
}

function updateAudioProgress() {
    if (!state.audioEl) return;
    const audio = state.audioEl;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    el.audioProgressFill.style.width = pct + '%';
    el.audioTime.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
}

$('#btn-audio-play').addEventListener('click', () => {
    if (!state.audioEl) return;
    if (state.audioEl.paused) {
        state.audioEl.play();
        updatePlayPauseIcon(true);
    } else {
        state.audioEl.pause();
        updatePlayPauseIcon(false);
    }
});

$('#btn-audio-close').addEventListener('click', () => {
    if (state.audioEl) {
        state.audioEl.pause();
        state.audioEl = null;
    }
    el.audioControls.style.display = 'none';
});

el.audioVolume.addEventListener('input', () => {
    if (state.audioEl) {
        state.audioEl.volume = el.audioVolume.value / 100;
    }
});

el.audioProgressBar.addEventListener('click', (e) => {
    if (!state.audioEl || !state.audioEl.duration) return;
    const rect = el.audioProgressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    state.audioEl.currentTime = pct * state.audioEl.duration;
});

$('#audio-progress-bar').addEventListener('click', (e) => {
    if (!state.audioEl || !state.audioEl.duration) return;
    const rect = el.audioProgressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    state.audioEl.currentTime = pct * state.audioEl.duration;
});

// ============================================================
// 右键菜单
// ============================================================

let contextMenuTarget = null;

function showContextMenu(x, y, node) {
    contextMenuTarget = node;
    const menu = node.isDir ? el.contextMenuFolder : el.contextMenu;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = '';
}

function hideContextMenus() {
    el.contextMenu.style.display = 'none';
    el.contextMenuFolder.style.display = 'none';
    contextMenuTarget = null;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu') && !e.target.closest('#context-menu-folder')) {
        hideContextMenus();
    }
});

// 右键菜单项点击
el.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
        const action = item.dataset.action;
        const node = contextMenuTarget;
        hideContextMenus();
        if (!node) return;

        if (action === 'rename') {
            // 内联编辑，不复用弹窗
            state.inlineEditPath = node.relPath;
            state.inlineEditIsNew = false;
            renderFileTree();
        } else if (action === 'delete') {
            const noteName = getFileNameWithoutExt(node.name);
            const ok = await showConfirm(`确定删除笔记"${noteName}"吗？`);
            if (ok) {
                try {
                    if (state.currentNote === node.relPath) {
                        closeNote();
                    }
                    await App.DeleteEntry(node.relPath);
                    await refreshFileTree();
                } catch (err) {
                    console.error('删除失败:', err);
                    notify('删除失败: ' + err, 'error');
                }
            }
        }
    });
});

el.contextMenuFolder.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
        const action = item.dataset.action;
        const node = contextMenuTarget;
        hideContextMenus();
        if (!node) return;

        if (action === 'rename') {
            showRenameDialog(node);
        } else if (action === 'delete-folder') {
            const hasContent = node.children && node.children.length > 0;
            const msg = hasContent
                ? `文件夹"${node.name}"内有内容，确认后内容将上移一级，然后删除空文件夹。确定吗？`
                : `确定删除空文件夹"${node.name}"吗？`;
            const ok = await showConfirm(msg);
            if (ok) {
                try {
                    if (hasContent) {
                        await App.DeleteFolderWithContent(node.relPath);
                    } else {
                        await App.DeleteEntry(node.relPath);
                    }
                    await refreshFileTree();
                } catch (err) {
                    console.error('删除文件夹失败:', err);
                    notify('删除失败: ' + err, 'error');
                }
            }
        }
    });
});

// ============================================================
// 重命名对话框
// ============================================================

let renameTarget = null;

function showRenameDialog(node) {
    renameTarget = node;
    const oldName = node.isDir ? node.name : getFileNameWithoutExt(node.name);
    el.renameInput.value = oldName;
    el.renameInput.focus();
    el.renameInput.select();
    el.renameOverlay.style.display = '';
}

function hideRenameDialog() {
    el.renameOverlay.style.display = 'none';
    renameTarget = null;
    el.renameInput.value = '';
}

$('#btn-rename-cancel').addEventListener('click', hideRenameDialog);

$('#btn-rename-confirm').addEventListener('click', async () => {
    const newName = el.renameInput.value.trim();
    if (!newName || !renameTarget) return;

    let finalName = newName;
    if (!renameTarget.isDir && !newName.endsWith('.md')) {
        finalName = newName + '.md';
    }

    try {
        // 更新当前笔记引用
        const oldRelPath = renameTarget.relPath;
        await App.RenameEntry(oldRelPath, finalName);

        if (state.currentNote === oldRelPath) {
            const parentRel = getParentRelPath(oldRelPath);
            state.currentNote = parentRel ? parentRel + '/' + finalName : finalName;
            state.currentNoteName = finalName;
        }

        hideRenameDialog();
        await refreshFileTree();
    } catch (err) {
        console.error('重命名失败:', err);
        notify('重命名失败: ' + err, 'error');
    }
});

el.renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        $('#btn-rename-confirm').click();
    } else if (e.key === 'Escape') {
        hideRenameDialog();
    }
});

el.renameOverlay.addEventListener('click', (e) => {
    if (e.target === el.renameOverlay) {
        hideRenameDialog();
    }
});

// ============================================================
// 编辑器工具栏
// ============================================================

function updateToolbarState() {
    const hasNote = !!state.currentNote;
    $$('#editor-toolbar .format-btn').forEach(btn => {
        btn.disabled = !hasNote;
        btn.style.opacity = hasNote ? '' : '0.4';
    });

    if (!hasNote) {
        $$('.format-btn.active').forEach(b => b.classList.remove('active'));
    }
}

// 格式按钮
$$('.format-btn').forEach(btn => {
    const format = btn.dataset.format;
    if (!format) return;

    btn.addEventListener('click', () => {
        if (!state.currentNote) return;
        el.editorContent.focus();

        switch (format) {
            case 'bold':
                document.execCommand('bold');
                break;
            case 'italic':
                document.execCommand('italic');
                break;
            case 'underline':
                document.execCommand('underline');
                break;
            case 'strikeThrough':
                document.execCommand('strikeThrough');
                break;
            case 'highlight':
                // 使用背景色模拟高亮
                document.execCommand('hiliteColor', false, 'rgba(102,167,189,0.35)');
                break;
            case 'hr':
                document.execCommand('insertHorizontalRule');
                break;
        }

        updateFormatButtonStates();
        state.isDirty = true;
    });
});

function updateFormatButtonStates() {
    $$('.format-btn[data-format]').forEach(btn => {
        const format = btn.dataset.format;
        let active = false;

        switch (format) {
            case 'bold':
                active = document.queryCommandState('bold');
                break;
            case 'italic':
                active = document.queryCommandState('italic');
                break;
            case 'underline':
                active = document.queryCommandState('underline');
                break;
            case 'strikeThrough':
                active = document.queryCommandState('strikeThrough');
                break;
            case 'highlight':
                // highlight 不通过 queryCommandState，通过检查
                active = false;
                break;
            case 'hr':
                active = false;
                break;
        }

        if (active) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 编辑器选择变化时更新工具栏
document.addEventListener('selectionchange', () => {
    if (document.activeElement === el.editorContent || el.editorContent.contains(document.activeElement)) {
        updateFormatButtonStates();
    }
});

// 编辑器内容变化
el.editorContent.addEventListener('input', () => {
    state.isDirty = true;
});

// ============================================================
// 媒体插入按钮
// ============================================================

$('#btn-insert-image').addEventListener('click', async () => {
    if (!state.currentNote) return;
    try {
        const mediaInfo = await App.ImportMedia(state.currentNote, 'image');
        if (!mediaInfo) return;
        const url = '/workspace/' + mediaInfo.relPath.replace(/\\/g, '/');
        insertMediaAtCursor('image', url, mediaInfo.fileName);
    } catch (err) {
        console.error('插入图片失败:', err);
        notify('插入图片失败', 'error');
    }
});

$('#btn-insert-video').addEventListener('click', async () => {
    if (!state.currentNote) return;
    try {
        const mediaInfo = await App.ImportMedia(state.currentNote, 'video');
        if (!mediaInfo) return;
        const url = '/workspace/' + mediaInfo.relPath.replace(/\\/g, '/');
        insertMediaAtCursor('video', url, mediaInfo.fileName);
    } catch (err) {
        console.error('插入视频失败:', err);
        notify('插入视频失败', 'error');
    }
});

$('#btn-insert-audio').addEventListener('click', async () => {
    if (!state.currentNote) return;
    try {
        const mediaInfo = await App.ImportMedia(state.currentNote, 'audio');
        if (!mediaInfo) return;
        const url = '/workspace/' + mediaInfo.relPath.replace(/\\/g, '/');
        insertMediaAtCursor('audio', url, mediaInfo.fileName);
    } catch (err) {
        console.error('插入音频失败:', err);
        notify('插入音频失败', 'error');
    }
});

function insertMediaAtCursor(type, url, name) {
    el.editorContent.focus();

    let html = '';
    if (type === 'image') {
        html = `<span class="resizable-image" contenteditable="false" style="width:300px;"><img src="${url}" alt="${name}"></span>`;
    } else if (type === 'video') {
        html = `<div class="editor-video-placeholder" contenteditable="false" data-src="${url}" data-name="${name}">` +
            `<video src="${url}" preload="metadata" controls></video>` +
            `</div><br>`;
    } else if (type === 'audio') {
        html = `<div class="editor-audio-placeholder" contenteditable="false" data-src="${url}" data-name="${name}">` +
            `<div class="audio-icon-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></div>` +
            `<span class="audio-filename">${name}</span>` +
            `</div>`;
    }

    document.execCommand('insertHTML', false, html);
    bindMediaClickEvents();
    state.isDirty = true;
}

// ============================================================
// 键盘快捷键
// ============================================================

document.addEventListener('keydown', (e) => {
    // Ctrl+S 保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCurrentNote().then(() => notify('已保存'));
    }

    // Ctrl+B/I/U 格式
    if (e.ctrlKey && state.currentNote) {
        const key = e.key.toLowerCase();
        if (key === 'b' || key === 'i' || key === 'u') {
            e.preventDefault();
            const formatMap = { b: 'bold', i: 'italic', u: 'underline' };
            $$(`.format-btn[data-format="${formatMap[key]}"]`)[0]?.click();
        }
    }
});

// ============================================================
// 拖入文件支持（从外部拖入媒体到编辑器）
// ============================================================

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!state.currentNote) return;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
        // 无法直接获取文件路径，需要用其他方式
        // WebView2 中可以通过 file.path 获取
        // 但标准 Web API 中不可用，在 Wails 中可以通过 file 对象的特殊属性
        // 尝试使用 file.path（Wails/WebView2 特有）
        const filePath = file.path;
        if (filePath) {
            try {
                const mediaInfo = await App.ImportMediaFromPath(filePath, state.currentNote);
                if (!mediaInfo) continue;
                const url = '/workspace/' + mediaInfo.relPath.replace(/\\/g, '/');
                const type = getMediaTypeFromMime(mediaInfo.mimeType);
                insertMediaAtCursor(type, url, mediaInfo.fileName);
            } catch (err) {
                console.error('拖入文件处理失败:', err);
            }
        }
    }
});

function getMediaTypeFromMime(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'image';
}

// ============================================================
// 文件树根区域拖放（移动到根目录）
// ============================================================

el.fileTree.addEventListener('dragover', (e) => {
    e.preventDefault();
});

el.fileTree.addEventListener('drop', async (e) => {
    e.preventDefault();
    // 如果落在具体节点上，由节点处理
    if (e.target.closest('.tree-node-header')) return;

    const srcNode = state.dragData;
    if (!srcNode) return;

    try {
        await App.MoveEntry(srcNode.relPath, '');
        await refreshFileTree();
        state.dragData = null;
    } catch (err) {
        console.error('移动失败:', err);
        notify('移动失败: ' + err, 'error');
    }
});

// ============================================================
// 侧边栏按钮
// ============================================================

function getUniqueName(baseName, isDir) {
    const existing = state.fileTree
        .filter(n => n.isDir === isDir)
        .map(n => isDir ? n.name : getFileNameWithoutExt(n.name));
    if (!existing.includes(baseName)) return baseName;
    let counter = 1;
    let name;
    do {
        name = `${baseName}${counter}`;
        counter++;
    } while (existing.includes(name));
    return name;
}

$('#btn-new-folder').addEventListener('click', async () => {
    const name = getUniqueName('新文件夹', true);
    try {
        await App.CreateFolder('', name);
        state.inlineEditPath = name;
        state.inlineEditIsNew = true;
        await refreshFileTree();
    } catch (err) {
        console.error('创建文件夹失败:', err);
        notify('创建失败: ' + err, 'error');
    }
});

$('#btn-new-note').addEventListener('click', async () => {
    const name = getUniqueName('新笔记', false);
    try {
        await App.CreateNote('', name);
        state.inlineEditPath = name + '.md';
        state.inlineEditIsNew = true;
        await refreshFileTree();
    } catch (err) {
        console.error('创建笔记失败:', err);
        notify('创建失败: ' + err, 'error');
    }
});

$('#btn-collapse-all').addEventListener('click', () => {
    state.expandedDirs = {};
    renderFileTree();
});

$('#btn-import-md').addEventListener('click', async () => {
    try {
        const node = await App.ImportMarkdownFile('');
        if (node) {
            await refreshFileTree();
            notify('导入成功: ' + node.name);
        }
    } catch (err) {
        console.error('导入失败:', err);
        notify('导入失败: ' + err, 'error');
    }
});

$('#btn-refresh').addEventListener('click', async () => {
    await refreshFileTree();
    notify('已刷新');
});

// ============================================================
// 禁用浏览器右键菜单
// ============================================================

document.addEventListener('contextmenu', (e) => {
    // 编辑器内部不阻止（但也不显示默认菜单，由自定义菜单处理）
    if (e.target.closest('#editor-content')) {
        e.preventDefault();
        return;
    }
    // 文件树由自定义右键菜单处理
    if (e.target.closest('#file-tree')) {
        return; // 由各个节点的 contextmenu 事件处理
    }
    e.preventDefault();
});

// ============================================================
// 初始化
// ============================================================

async function init() {
    initTitlebar();
    initSidebarResizer();
    updateToolbarState();

    // 加载文件树
    if (App) {
        await refreshFileTree();
    }

    // 监听窗口关闭前保存
    window.addEventListener('beforeunload', async (e) => {
        if (state.isDirty && state.currentNote) {
            await saveCurrentNote();
        }
    });
}

// ============================================================
// 页面失去焦点时自动保存
// ============================================================
let autoSaveTimer = null;

el.editorContent.addEventListener('input', () => {
    state.isDirty = true;
    // 3 秒无输入后自动保存
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        if (state.isDirty && state.currentNote) {
            await saveCurrentNote();
        }
    }, 3000);
});

// 启动
document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => console.error('初始化失败:', err));
});
