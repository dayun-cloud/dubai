// ============================================================
// 独白 - 前端主逻辑（Tiptap 编辑器）
// ============================================================

// Tiptap 来自 tiptap-bundle.js (IIFE)
const { Editor, Node, Mark, StarterKit, ImageExtension, Underline, Highlight, Link, Table, TableRow, TableCell, TableHeader, TaskList, TaskItem } = window.TiptapBundle;

// ============================================================
// 自定义 Tiptap 扩展
// ============================================================

// 可缩放图片（继承 Image 扩展，添加宽度属性）
const ResizableImage = ImageExtension.extend({
    name: 'resizableImage',
    addAttributes() {
        return {
            ...this.parent?.(),
            width: { default: 300, parseHTML: el => parseInt(el.getAttribute('data-width')) || 300 },
        };
    },
    parseHTML() {
        return [{ tag: 'span[data-type="resizable-image"]' }];
    },
    renderHTML({ HTMLAttributes }) {
        const { width, ...attrs } = HTMLAttributes;
        return ['span', { 'data-type': 'resizable-image', class: 'resizable-image', style: `width:${width}px`, 'data-width': width },
            ['img', attrs],
        ];
    },
    addNodeView() {
        return ({ node, getPos, editor }) => {
            const container = document.createElement('span');
            container.className = 'resizable-image';
            container.setAttribute('data-type', 'resizable-image');
            const initW = node.attrs.width || 300;
            container.style.width = initW + 'px';
            container.contentEditable = 'false';

            const img = document.createElement('img');
            img.src = node.attrs.src;
            img.alt = node.attrs.alt || '';
            img.draggable = false;
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                openImageViewer(node.attrs.src);
            });
            // 在容器上存储媒体信息，供全局 contextmenu 使用
            container.__mediaFileName = node.attrs.src.replace(/^\/media\//, '');
            container.__mediaGetPos = getPos;
            container.__mediaEditor = editor;
            container.appendChild(img);

            // 文件名标签（小图时显示在底部）
            const label = document.createElement('span');
            label.className = 'resizable-image-label';
            const rawName = node.attrs.alt || '';
            label.textContent = rawName.replace(/\.[^.]+$/, ''); // 去掉扩展名
            container.appendChild(label);

            // 自定义缩放手柄
            const handle = document.createElement('span');
            handle.className = 'resizable-handle';
            container.appendChild(handle);

            let dragState = null;

            const onPointerDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragState = {
                    startX: e.clientX,
                    startW: parseInt(container.style.width) || 300
                };
                document.addEventListener('pointermove', onPointerMove);
                document.addEventListener('pointerup', onPointerUp);
            };

            const onPointerMove = (e) => {
                if (!dragState) return;
                const w = Math.max(60, dragState.startW + e.clientX - dragState.startX);
                container.style.width = w + 'px';
            };

            const onPointerUp = () => {
                if (!dragState) return;
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                const w = parseInt(container.style.width) || 300;
                if (w !== node.attrs.width) {
                    const pos = getPos();
                    if (pos !== undefined && !editor.isDestroyed) {
                        editor.view.dispatch(
                            editor.state.tr.setNodeMarkup(pos, null, { ...node.attrs, width: w })
                        );
                    }
                }
                dragState = null;
            };

            handle.addEventListener('pointerdown', onPointerDown);

            return { dom: container, destroy() {
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
            }};
        };
    },
    addCommands() {
        return {
            setResizableImage: (attrs) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs }),
        };
    },
});

// 视频节点（可缩放）
const VideoNode = Node.create({
    name: 'videoNode',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            src: { default: null },
            name: { default: '' },
            width: { default: 480, parseHTML: el => parseInt(el.getAttribute('data-width')) || 480 },
        };
    },
    parseHTML() {
        return [{ tag: 'div[data-type="video-node"]' }];
    },
    renderHTML({ HTMLAttributes }) {
        const { width, ...attrs } = HTMLAttributes;
        return ['div', { 'data-type': 'video-node', class: 'editor-video-placeholder', 'data-width': width, style: `width:${width}px` },
            ['video', { src: HTMLAttributes.src, preload: 'metadata', controls: true }],
        ];
    },
    addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('div');
            dom.className = 'editor-video-placeholder';
            dom.setAttribute('data-type', 'video-node');
            dom.style.width = (node.attrs.width || 480) + 'px';

            const video = document.createElement('video');
            video.src = node.attrs.src;
            video.preload = 'metadata';
            video.controls = true;
            video.volume = 0.1;

            dom.appendChild(video);

            // 在容器上存储媒体信息，供全局 contextmenu 使用
            dom.__mediaFileName = node.attrs.src.replace(/^\/media\//, '');
            dom.__mediaGetPos = getPos;
            dom.__mediaEditor = editor;

            // 缩放手柄
            const handle = document.createElement('span');
            handle.className = 'resizable-handle';
            dom.appendChild(handle);

            let dragState = null;

            const onPointerDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragState = {
                    startX: e.clientX,
                    startW: parseInt(dom.style.width) || 480
                };
                document.addEventListener('pointermove', onPointerMove);
                document.addEventListener('pointerup', onPointerUp);
            };

            const onPointerMove = (e) => {
                if (!dragState) return;
                const w = Math.max(200, dragState.startW + e.clientX - dragState.startX);
                dom.style.width = w + 'px';
            };

            const onPointerUp = () => {
                if (!dragState) return;
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                const w = parseInt(dom.style.width) || 480;
                if (w !== node.attrs.width) {
                    const pos = getPos();
                    if (pos !== undefined && !editor.isDestroyed) {
                        editor.view.dispatch(
                            editor.state.tr.setNodeMarkup(pos, null, { ...node.attrs, width: w })
                        );
                    }
                }
                dragState = null;
            };

            handle.addEventListener('pointerdown', onPointerDown);

            return { dom, destroy() {
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
            }};
        };
    },
    addCommands() {
        return {
            setVideoNode: (attrs) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs }),
        };
    },
});

// 音频节点
const AudioNode = Node.create({
    name: 'audioNode',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            src: { default: null },
            name: { default: '' },
        };
    },
    parseHTML() {
        return [{ tag: 'div[data-type="audio-node"]' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', { 'data-type': 'audio-node', class: 'editor-audio-placeholder' },
            ['span', { class: 'audio-icon-circle' },
                ['svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'white', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
                    ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
                    ['path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' }],
                    ['path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' }],
                ],
            ],
            ['span', { class: 'audio-filename' }, HTMLAttributes.name],
        ];
    },
    addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('div');
            dom.className = 'editor-audio-placeholder';
            dom.setAttribute('data-type', 'audio-node');
            dom.addEventListener('click', (e) => {
                e.stopPropagation();
                playAudio(node.attrs.src, node.attrs.name);
            });
            // 在容器上存储媒体信息，供全局 contextmenu 使用
            dom.__mediaFileName = node.attrs.src.replace(/^\/media\//, '');
            dom.__mediaGetPos = getPos;
            dom.__mediaEditor = editor;

            const iconSpan = document.createElement('span');
            iconSpan.className = 'audio-icon-circle';
            iconSpan.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'audio-filename';
            nameSpan.textContent = node.attrs.name;

            dom.appendChild(iconSpan);
            dom.appendChild(nameSpan);
            return { dom };
        };
    },
    addCommands() {
        return {
            setAudioNode: (attrs) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs }),
        };
    },
});

// 黑幕标记（Spoiler）
const Spoiler = Mark.create({
    name: 'spoiler',
    parseHTML() {
        return [{ tag: 'span.spoiler' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', { class: 'spoiler' }, 0];
    },
    addCommands() {
        return {
            toggleSpoiler: () => ({ commands }) => {
                return commands.toggleMark(this.name);
            },
        };
    },
});

// 表格单元格/表头附加 textAlign 属性（渲染为内联样式，随笔记 JSON 持久化）
const withTextAlign = (BaseExtension) => BaseExtension.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            textAlign: {
                default: null,
                parseHTML: (element) => element.style.textAlign || null,
                renderHTML: (attrs) => attrs.textAlign ? { style: `text-align: ${attrs.textAlign}` } : {},
            },
        };
    },
});
const AlignableTableCell = withTextAlign(TableCell);
const AlignableTableHeader = withTextAlign(TableHeader);

// 表格节点附加 fitWidth 属性（宽度自适应编辑区，列宽按比例缩放）
const FitWidthTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            fitWidth: {
                default: null,
                parseHTML: (el) => (el.hasAttribute('data-fit-width') ? true : null),
                renderHTML: (attrs) => (attrs.fitWidth ? { 'data-fit-width': 'true' } : {}),
            },
        };
    },
});

// ============================================================
// 全局状态
// ============================================================
const state = {
    currentNote: null,
    currentNoteName: null,
    fileTree: [],
    expandedDirs: {},
    isDirty: false,
    audioEl: null,
    audioContext: null,
    dragData: null,
    sidebarWidth: 280,
    inlineEditPath: null,
    inlineEditIsNew: false,
    editor: null,  // Tiptap 编辑器实例
};

const App = window.go?.main?.App;

// ============================================================
// DOM 元素引用
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
    titlebar: $('#titlebar'),
    fileTree: $('#file-tree'),
    editorContainer: $('#editor-container'),
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
    contextMenuMedia: $('#context-menu-media'),
    renameOverlay: $('#rename-overlay'),
    renameInput: $('#rename-input'),
    sidebar: $('#sidebar'),
    sidebarResizer: $('#sidebar-resizer'),
    editorToolbar: $('#editor-toolbar'),
    confirmDialog: $('#confirm-dialog'),
    confirmMsg: $('#confirm-msg'),
    confirmOk: $('#confirm-ok'),
    confirmCancel: $('#confirm-cancel'),
    linkOverlay: $('#link-overlay'),
    linkInput: $('#link-input'),
    searchPanel: $('#search-panel'),
    searchInput: $('#search-input'),
    searchResults: $('#search-results'),

    highlightsPanel: $('#highlights-panel'),
    highlightsResults: $('#highlights-results'),
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

function makeMediaUrl(filePath) {
    return '/media/' + filePath;
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
    return name.replace(/\.json$/i, '');
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
// Tiptap 编辑器初始化
// ============================================================

// 去掉粘贴切片首尾的空段落/换行符（外部复制常带首尾换行，粘贴后内容上下会多出空行）。
// 两类边缘杂质：
// 1. 空段落（含 <p><br></p> 这种）——外部 HTML 粘贴常见；
// 2. 顶层的 hardBreak——带 data-pm-slice 标记的内部粘贴经 preserveWhitespace 重建后，
//    源 HTML 里的空白符与仅含 <br> 的空段会变成切片两端的行内换行节点。
// 注意：PM 对所有外部粘贴统一走 Slice.maxOpen（边缘段落 open 深度为 1），
// 所以不能只处理闭合切片；裁掉处于打开深度的边缘节点时，需同步减掉对应 open 深度。
function trimPastedSlice(slice) {
    const isEmptyish = (node) => {
        if (node.type.name === 'hardBreak') return true;
        if (node.type.name !== 'paragraph' || node.textContent.trim() !== '') return false;
        let onlyBreaks = true;
        node.forEach(child => { if (child.type.name !== 'hardBreak') onlyBreaks = false; });
        return onlyBreaks;
    };
    let content = slice.content;
    let openStart = slice.openStart, openEnd = slice.openEnd;
    let changed = false;

    while (content.childCount > 0 && isEmptyish(content.firstChild)) {
        if (content.firstChild.type.name === 'paragraph' && openStart > 0) openStart -= 1;
        content = content.cut(content.firstChild.nodeSize);
        changed = true;
    }
    while (content.childCount > 0 && isEmptyish(content.lastChild)) {
        if (content.lastChild.type.name === 'paragraph' && openEnd > 0) openEnd -= 1;
        content = content.cut(0, content.size - content.lastChild.nodeSize);
        changed = true;
    }
    // 整片都是空段落/换行符时不裁剪（保留"粘贴一个空行"的原有行为）
    if (!changed || content.childCount === 0) return slice;
    return Object.assign(Object.create(Object.getPrototypeOf(slice)), slice, { content, openStart, openEnd });
}

    // 整块粘贴（闭合切片）落在段落边界时避免切出多余空行：
    // - 粘贴到空段落：直接用粘贴内容替换该段落（默认行为会切出上下两个空段）
    // - 行首/行尾：插到段落之前/之后（默认行为会切出一个空半段）
    // 行中间的闭合切片粘贴保持默认行为（按块插入、切开当前行）。
    function pasteAtBlockBoundary(view, _event, slice) {
        if (!slice || slice.openStart !== 0 || slice.openEnd !== 0) return false;
        const first = slice.content.firstChild;
        if (!first || !first.isBlock) return false;
        const { $from, empty } = view.state.selection;
        if (!empty || !$from.parent.inlineContent) return false;

        try {
            if ($from.parent.content.size === 0) {
                view.dispatch(view.state.tr.replace($from.before(), $from.after(), slice).scrollIntoView());
                return true;
            }
            if ($from.parentOffset === 0) {
                const pos = $from.before();
                view.dispatch(view.state.tr.replace(pos, pos, slice).scrollIntoView());
                return true;
            }
            if ($from.parentOffset === $from.parent.content.size) {
                const pos = $from.after();
                view.dispatch(view.state.tr.replace(pos, pos, slice).scrollIntoView());
                return true;
            }
        } catch (err) {
            console.error('粘贴失败:', err);
        }
        return false;
    }

    function initEditor() {
    state.editor = new Editor({
        element: el.editorContainer,
        extensions: [
            StarterKit.configure({
                history: true,
            }),
            Underline,
            Highlight.configure({ multicolor: false }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
            }),
            ResizableImage,
            VideoNode,
            AudioNode,
            Spoiler,
            FitWidthTable.configure({
                resizable: true,
            }),
            TableRow,
            AlignableTableCell,
            AlignableTableHeader,
            TaskList,
            TaskItem,
        ],
        editorProps: {
            transformPasted: trimPastedSlice,
            handlePaste: pasteAtBlockBoundary,
        },
        content: '',
        editable: true,
        scrollThreshold: 0,
        scrollMargin: 200,
        onTransaction: () => {
            updateFormatButtonStates();
            updateTableToolbar();
            syncFitWidthDom();
        },
        onUpdate: ({ editor }) => {
            state.isDirty = true;
            requestAnimationFrame(() => {
                const view = editor.view;
                const { from } = view.state.selection;
                const coords = view.coordsAtPos(from);
                if (!coords) return;
                const wrapper = el.editorWrapper;
                const wrapperRect = wrapper.getBoundingClientRect();
                const cursorBottom = coords.bottom - wrapperRect.top;
                const ratio = cursorBottom / wrapperRect.height;
                // 光标进入视口底部 10% 时，滚动到 40% 位置
                if (ratio > 0.99) {
                    wrapper.scrollTop += cursorBottom - wrapperRect.height * 0.4;
                }
            });
        },
        onSelectionUpdate: () => {
            updateFormatButtonStates();
            updateTableToolbar();
        },
    });

    // 重新聚焦编辑器时恢复表格工具栏（点击侧边栏等场景会先隐藏）
    state.editor.on('focus', () => updateTableToolbar());

    window.__editor = state.editor; // 调试钩子（浏览器测试用）
    window.__state = state;

    // 拦截编辑器内链接点击，用系统默认浏览器打开
    el.editorContainer.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (a && a.href) {
            e.preventDefault();
            window.runtime.BrowserOpenURL(a.href);
        }
    });
}

// ============================================================
// 笔记操作
// ============================================================

async function openNote(relPath, name) {
    if (state.isDirty && state.currentNote) {
        await saveCurrentNote();
    }

    try {
        const content = await App.ReadNote(relPath);
        state.currentNote = relPath;
        state.currentNoteName = name;
        state.isDirty = false;

        el.editorEmpty.style.display = 'none';
        el.editorContainer.style.display = '';

        const doc = JSON.parse(content);
        setContentNoHistory(doc);
        state.editor.commands.focus();
        requestAnimationFrame(() => { el.editorWrapper.scrollTop = 0; });
        renderFileTree();
        updateToolbarState();
        updateFormatButtonStates();
    } catch (err) {
        console.error('打开笔记失败:', err);
        notify('打开笔记失败: ' + err, 'error');
    }
}

// 设置编辑器内容但不写入撤销历史（避免 Ctrl+Z 回退到上一个笔记）
function setContentNoHistory(doc) {
    const view = state.editor.view;
    const docNode = view.state.schema.nodeFromJSON(doc);
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, docNode.content);
    tr.setMeta('addToHistory', false);
    view.dispatch(tr);
}

async function saveCurrentNote() {
    if (!state.currentNote || !state.editor) return;
    try {
        const content = JSON.stringify(state.editor.getJSON());
        await App.SaveNote(state.currentNote, content);
        state.isDirty = false;
    } catch (err) {
        console.error('保存失败:', err);
        notify('保存失败: ' + err, 'error');
    }
}

async function saveCurrentNoteWithBackup() {
    if (!state.currentNote || !state.editor) return;
    try {
        const content = JSON.stringify(state.editor.getJSON());
        await App.SaveNoteBackup(state.currentNote, content);
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
    state.editor.commands.clearContent();
    hideTableToolbar();
    el.editorContainer.style.display = 'none';
    el.editorEmpty.style.display = '';
    renderFileTree();
    updateToolbarState();
}

// ============================================================
// 标题栏控制
// ============================================================
function initTitlebar() {
    $('#btn-minimize').addEventListener('click', () => {
        // 最小化前清除 JS hover class，避免恢复后残留
        document.querySelectorAll('.titlebar-btn').forEach(btn => btn.classList.remove('hovered'));
        window.runtime?.WindowMinimise();
    });
    $('#btn-maximize').addEventListener('click', () => {
        window.runtime?.WindowToggleMaximise();
    });
    $('#btn-close').addEventListener('click', () => { window.runtime?.Quit(); });

    // 用 mouseenter/mouseleave 替代 CSS :hover 管理按钮悬停
    document.querySelectorAll('.titlebar-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => btn.classList.add('hovered'));
        btn.addEventListener('mouseleave', () => btn.classList.remove('hovered'));
    });

    el.titlebar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.titlebar-controls')) return;
        window.runtime?.WindowToggleMaximise();
    });
}

// ============================================================
// 侧边栏拖拽
// ============================================================
function initSidebarResizer() {
    let startX = 0, startWidth = 0;
    el.sidebarResizer.addEventListener('mousedown', (e) => {
        startX = e.clientX; startWidth = el.sidebar.offsetWidth;
        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', onResizeEnd);
        e.preventDefault();
    });
    function onResize(e) {
        const newWidth = Math.max(180, Math.min(500, startWidth + e.clientX - startX));
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
    state.fileTree.forEach(node => el.fileTree.appendChild(createTreeNode(node, 0)));
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
    if (!node.isDir && state.currentNote === node.relPath) header.classList.add('active');

    const arrow = document.createElement('span');
    arrow.className = 'tree-arrow';
    if (node.isDir) {
        arrow.textContent = '▶';
        if (state.expandedDirs[node.relPath]) arrow.classList.add('expanded');
    } else {
        arrow.classList.add('tree-arrow-hidden');
    }
    header.appendChild(arrow);

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

    const isInlineEditing = (state.inlineEditPath === (node.relPath || '').replace(/\\/g, '/'));
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
                let finalName = node.isDir ? newName : (newName.endsWith('.json') ? newName : newName + '.json');
                try {
                    await App.RenameEntry(node.relPath, finalName);
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
                } catch (err) { console.error('取消创建失败:', err); }
            }
            state.inlineEditPath = null;
            state.inlineEditIsNew = false;
            await refreshFileTree();
        };

        let finalized = false;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (!finalized) { finalized = true; finalizeRename(); } }
            else if (e.key === 'Escape') { e.preventDefault(); if (!finalized) { finalized = true; cancelInline(); } }
        });
        input.addEventListener('blur', () => { if (!finalized) { finalized = true; setTimeout(finalizeRename, 150); } });
    } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-node-name';
        nameSpan.textContent = node.isDir ? node.name : getFileNameWithoutExt(node.name);
        header.appendChild(nameSpan);
    }

    header.addEventListener('click', (e) => {
        e.stopPropagation();
        if (node.isDir) toggleDir(node.relPath);
        else openNote(node.relPath, node.name);
    });
    header.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, node);
    });

    header.addEventListener('dragstart', (e) => {
        state.dragData = node;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.relPath);
    });
    header.addEventListener('dragover', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (node.isDir) header.classList.add('drag-over');
    });
    header.addEventListener('dragleave', () => { header.classList.remove('drag-over'); });
    header.addEventListener('drop', async (e) => {
        e.preventDefault(); e.stopPropagation();
        header.classList.remove('drag-over');
        const srcNode = state.dragData;
        if (!srcNode || srcNode.relPath === node.relPath) return;
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
    if (node.isDir && node.children) {
        const children = document.createElement('div');
        children.className = 'tree-children';
        if (state.expandedDirs[node.relPath]) children.classList.add('expanded');
        node.children.forEach(child => children.appendChild(createTreeNode(child, depth + 1)));
        wrapper.appendChild(children);
    }
    return wrapper;
}

function toggleDir(relPath) {
    state.expandedDirs[relPath] = !state.expandedDirs[relPath];
    renderFileTree();
}

// ============================================================
// 图片查看器（支持滚轮缩放和拖动平移）
// ============================================================
const imgViewerState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    hasMoved: false,
    dragStartX: 0,
    dragStartY: 0,
    lastTranslateX: 0,
    lastTranslateY: 0,
};

function applyImageTransform() {
    el.imageViewerImg.style.transform =
        `translate(${imgViewerState.translateX}px, ${imgViewerState.translateY}px) scale(${imgViewerState.scale})`;
}

function resetImageViewer() {
    imgViewerState.translateX = 0;
    imgViewerState.translateY = 0;
    imgViewerState.isDragging = false;
    imgViewerState.hasMoved = false;

    const naturalW = el.imageViewerImg.naturalWidth;
    const naturalH = el.imageViewerImg.naturalHeight;
    if (naturalW && naturalH) {
        const viewportW = window.innerWidth * 0.9;
        const viewportH = window.innerHeight * 0.9;
        imgViewerState.scale = Math.min(viewportW / naturalW, viewportH / naturalH, 1);
    } else {
        imgViewerState.scale = 1;
    }
    applyImageTransform();
}

function openImageViewer(src) {
    el.imageViewerImg.src = src;
    el.imageViewer.style.display = '';

    // 等图片加载完后计算初始适配比例
    if (el.imageViewerImg.complete && el.imageViewerImg.naturalWidth) {
        resetImageViewer();
    } else {
        // 先以 scale=1 显示，onload 后再调整
        imgViewerState.scale = 1;
        imgViewerState.translateX = 0;
        imgViewerState.translateY = 0;
        applyImageTransform();
    }
}

function closeImageViewer() {
    el.imageViewer.style.display = 'none';
    el.imageViewerImg.src = '';
    imgViewerState.isDragging = false;
    imgViewerState.hasMoved = false;
    el.imageViewer.classList.remove('dragging');
}

// 图片加载完成后自动适配
el.imageViewerImg.addEventListener('load', () => {
    if (el.imageViewer.style.display !== 'none') {
        resetImageViewer();
    }
});

// 滚轮缩放（以鼠标位置为中心）
el.imageViewer.addEventListener('wheel', (e) => {
    if (el.imageViewer.style.display === 'none') return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newScale = Math.max(0.1, Math.min(10, imgViewerState.scale + delta));

    const rect = el.imageViewer.getBoundingClientRect();
    // 鼠标相对于 viewer 中心的位置
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const scaleRatio = newScale / imgViewerState.scale;
    imgViewerState.translateX = mouseX - scaleRatio * (mouseX - imgViewerState.translateX);
    imgViewerState.translateY = mouseY - scaleRatio * (mouseY - imgViewerState.translateY);
    imgViewerState.scale = newScale;

    applyImageTransform();
}, { passive: false });

// 指针按下开始拖动
el.imageViewerImg.addEventListener('pointerdown', (e) => {
    if (el.imageViewer.style.display === 'none') return;
    imgViewerState.isDragging = true;
    imgViewerState.hasMoved = false;
    imgViewerState.dragStartX = e.clientX;
    imgViewerState.dragStartY = e.clientY;
    imgViewerState.lastTranslateX = imgViewerState.translateX;
    imgViewerState.lastTranslateY = imgViewerState.translateY;
    el.imageViewer.classList.add('dragging');
    el.imageViewerImg.setPointerCapture(e.pointerId);
    e.preventDefault();
});

// 指针移动拖动
el.imageViewerImg.addEventListener('pointermove', (e) => {
    if (!imgViewerState.isDragging) return;
    const dx = e.clientX - imgViewerState.dragStartX;
    const dy = e.clientY - imgViewerState.dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        imgViewerState.hasMoved = true;
    }
    imgViewerState.translateX = imgViewerState.lastTranslateX + dx;
    imgViewerState.translateY = imgViewerState.lastTranslateY + dy;
    applyImageTransform();
});

// 指针释放
el.imageViewerImg.addEventListener('pointerup', (e) => {
    if (!imgViewerState.isDragging) return;
    imgViewerState.isDragging = false;
    el.imageViewer.classList.remove('dragging');
    el.imageViewerImg.releasePointerCapture(e.pointerId);
});

el.imageViewerImg.addEventListener('pointercancel', () => {
    imgViewerState.isDragging = false;
    el.imageViewer.classList.remove('dragging');
});

// 双击重置缩放和位置
el.imageViewerImg.addEventListener('dblclick', (e) => {
    if (el.imageViewer.style.display === 'none') return;
    e.preventDefault();
    resetImageViewer();
});

// 关闭按钮与背景点击
$('#btn-close-viewer').addEventListener('click', closeImageViewer);
$('.image-viewer-bg').addEventListener('click', (e) => {
    // 拖动过则不关闭
    if (imgViewerState.hasMoved) return;
    closeImageViewer();
});

// ============================================================
// 视频播放器
// ============================================================
function openVideoPlayer(src) {
    el.videoPlayerEl.src = src;
    el.videoPlayerEl.volume = 0.1;
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
    audio.addEventListener('ended', () => { updatePlayPauseIcon(false); updateAudioProgress(); });
    audio.play().then(() => updatePlayPauseIcon(true)).catch(err => console.error('音频播放失败:', err));
}

function updatePlayPauseIcon(playing) {
    const btn = $('#btn-audio-play');
    btn.innerHTML = playing
        ? '<svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="2" width="3" height="12" fill="currentColor"/><rect x="10" y="2" width="3" height="12" fill="currentColor"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 16 16"><polygon points="4,2 4,14 13,8" fill="currentColor"/></svg>';
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
    if (state.audioEl.paused) { state.audioEl.play(); updatePlayPauseIcon(true); }
    else { state.audioEl.pause(); updatePlayPauseIcon(false); }
});

$('#btn-audio-close').addEventListener('click', () => {
    if (state.audioEl) { state.audioEl.pause(); state.audioEl = null; }
    el.audioControls.style.display = 'none';
});

el.audioVolume.addEventListener('input', () => {
    if (state.audioEl) state.audioEl.volume = el.audioVolume.value / 100;
});

el.audioProgressBar.addEventListener('click', (e) => {
    if (!state.audioEl || !state.audioEl.duration) return;
    const rect = el.audioProgressBar.getBoundingClientRect();
    state.audioEl.currentTime = ((e.clientX - rect.left) / rect.width) * state.audioEl.duration;
});

// ============================================================
// 右键菜单
// ============================================================
let contextMenuTarget = null;
function showContextMenu(x, y, node) {
    contextMenuTarget = node;
    const menu = node.isDir ? el.contextMenuFolder : el.contextMenu;
    menu.style.display = '';
    
    // 获取菜单尺寸
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 调整水平位置
    let finalX = x;
    if (x + menuRect.width > viewportWidth) {
        finalX = viewportWidth - menuRect.width - 5;
    }
    
    // 调整垂直位置
    let finalY = y;
    if (y + menuRect.height > viewportHeight) {
        finalY = viewportHeight - menuRect.height - 5;
    }
    
    menu.style.left = finalX + 'px';
    menu.style.top = finalY + 'px';
}
function hideContextMenus() {
    el.contextMenu.style.display = 'none';
    el.contextMenuFolder.style.display = 'none';
    el.contextMenuMedia.style.display = 'none';
    contextMenuTarget = null;
    mediaContextTarget = null;
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu') && !e.target.closest('#context-menu-folder') && !e.target.closest('#context-menu-media')) {
        hideContextMenus();
    }
    // 点击编辑器与表格工具栏以外的区域时，隐藏表格工具栏
    if (!e.target.closest('#table-toolbar') && !e.target.closest('#editor-container') && !e.target.closest('#editor-toolbar')) {
        hideTableToolbar();
    }
});

// 媒体右键菜单
let mediaContextTarget = null;
function showMediaContextMenu(x, y, fileName, nodePos, editor) {
    hideContextMenus();
    mediaContextTarget = { fileName, nodePos, editor };
    el.contextMenuMedia.style.display = '';
    
    // 获取菜单尺寸
    const menuRect = el.contextMenuMedia.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 调整水平位置
    let finalX = x;
    if (x + menuRect.width > viewportWidth) {
        finalX = viewportWidth - menuRect.width - 5;
    }
    
    // 调整垂直位置
    let finalY = y;
    if (y + menuRect.height > viewportHeight) {
        finalY = viewportHeight - menuRect.height - 5;
    }
    
    el.contextMenuMedia.style.left = finalX + 'px';
    el.contextMenuMedia.style.top = finalY + 'px';
}

el.contextMenuMedia.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
        const action = item.dataset.action;
        const target = mediaContextTarget;
        hideContextMenus();
        if (!target) return;

        if (action === 'open-location') {
            try {
                await App.OpenMediaLocation(target.fileName);
            } catch (err) {
                console.error('打开文件位置失败:', err);
                notify('打开文件位置失败', 'error');
            }
        } else if (action === 'open-default') {
            try {
                await App.OpenMediaWithDefaultApp(target.fileName);
            } catch (err) {
                console.error('打开文件失败:', err);
                notify('打开文件失败', 'error');
            }
        } else if (action === 'delete-media') {
            const ok = await showConfirm(`确定删除媒体文件"${target.fileName}"吗？该操作将从磁盘中删除文件。`);
            if (!ok) return;
            try {
                await App.DeleteMediaFile(target.fileName);
                // 从编辑器中移除对应节点
                if (target.editor && !target.editor.isDestroyed && target.nodePos !== undefined) {
                    target.editor.view.dispatch(
                        target.editor.state.tr.delete(target.nodePos, target.nodePos + 1)
                    );
                }
            } catch (err) {
                console.error('删除媒体文件失败:', err);
                notify('删除媒体文件失败', 'error');
            }
        }
    });
});

el.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
        const action = item.dataset.action;
        const node = contextMenuTarget;
        hideContextMenus();
        if (!node) return;
        if (action === 'rename') {
            state.inlineEditPath = node.relPath.replace(/\\/g, '/');
            state.inlineEditIsNew = false;
            renderFileTree();
        } else if (action === 'delete') {
            const ok = await showConfirm(`确定删除笔记"${getFileNameWithoutExt(node.name)}"吗？`);
            if (ok) {
                try {
                    if (state.currentNote === node.relPath) closeNote();
                    await App.DeleteEntry(node.relPath);
                    await refreshFileTree();
                } catch (err) { console.error('删除失败:', err); notify('删除失败: ' + err, 'error'); }
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
        if (action === 'rename') showRenameDialog(node);
        else if (action === 'delete-folder') {
            const hasContent = node.children && node.children.length > 0;
            const msg = hasContent
                ? `文件夹"${node.name}"内有内容，确认后内容将上移一级，然后删除空文件夹。确定吗？`
                : `确定删除空文件夹"${node.name}"吗？`;
            const ok = await showConfirm(msg);
            if (ok) {
                try {
                    if (hasContent) await App.DeleteFolderWithContent(node.relPath);
                    else await App.DeleteEntry(node.relPath);
                    await refreshFileTree();
                } catch (err) { console.error('删除失败:', err); notify('删除失败: ' + err, 'error'); }
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
    el.renameInput.value = node.isDir ? node.name : getFileNameWithoutExt(node.name);
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
    let finalName = renameTarget.isDir ? newName : (newName.endsWith('.json') ? newName : newName + '.json');
    try {
        const oldRelPath = renameTarget.relPath;
        await App.RenameEntry(oldRelPath, finalName);
        if (state.currentNote === oldRelPath) {
            const parentRel = getParentRelPath(oldRelPath);
            state.currentNote = parentRel ? parentRel + '/' + finalName : finalName;
            state.currentNoteName = finalName;
        }
        hideRenameDialog();
        await refreshFileTree();
    } catch (err) { console.error('重命名失败:', err); notify('重命名失败: ' + err, 'error'); }
});
el.renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-rename-confirm').click();
    else if (e.key === 'Escape') hideRenameDialog();
});
el.renameOverlay.addEventListener('click', (e) => { if (e.target === el.renameOverlay) hideRenameDialog(); });

// ============================================================
// 链接输入对话框
// ============================================================
function showLinkDialog() {
    el.linkInput.value = 'https://';
    el.linkOverlay.style.display = '';
    setTimeout(() => {
        el.linkInput.focus();
        el.linkInput.select();
    }, 10);
}
function hideLinkDialog() {
    el.linkOverlay.style.display = 'none';
    el.linkInput.value = '';
}
$('#btn-link-cancel').addEventListener('click', hideLinkDialog);
$('#btn-link-confirm').addEventListener('click', () => {
    const url = el.linkInput.value.trim();
    if (!url) return;
    if (state.editor && state.currentNote) {
        state.editor.chain().focus().setLink({ href: url }).run();
    }
    hideLinkDialog();
});
el.linkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-link-confirm').click();
    else if (e.key === 'Escape') hideLinkDialog();
});
el.linkOverlay.addEventListener('click', (e) => { if (e.target === el.linkOverlay) hideLinkDialog(); });

// ============================================================
// 搜索面板
// ============================================================
let searchTimer = null;
let lastSearchKeyword = '';

function openSearchPanel() {
    el.searchPanel.style.display = '';
    el.searchInput.value = '';
    el.searchResults.innerHTML = '';
    lastSearchKeyword = '';
    el.searchInput.focus();
}

function closeSearchPanel() {
    el.searchPanel.style.display = 'none';
    el.searchInput.value = '';
    el.searchResults.innerHTML = '';
    lastSearchKeyword = '';
    if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
}

async function doSearch(keyword) {
    if (!keyword.trim()) {
        el.searchResults.innerHTML = '';
        return;
    }
    lastSearchKeyword = keyword;
    try {
        const results = await App.SearchNotes(keyword.trim());
        if (results && results.length > 0) {
            el.searchResults.innerHTML = results.map(r => {
                const displayPath = r.relPath.endsWith('.json')
                    ? r.relPath.slice(0, -5).replace(/\\/g, ' / ')
                    : r.relPath;
                // 高亮关键词
                const ctx = escapeHtml(r.context);
                const matchStart = r.matchStart || 0;
                const matchLen = r.matchLen || 0;
                let highlighted = ctx;
                if (matchLen > 0 && matchStart + matchLen <= ctx.length) {
                    const before = ctx.slice(0, matchStart);
                    const match = ctx.slice(matchStart, matchStart + matchLen);
                    const after = ctx.slice(matchStart + matchLen);
                    highlighted = before + '<mark class="search-highlight">' + match + '</mark>' + after;
                }
                return `<div class="search-result-item" data-path="${escapeHtml(r.relPath)}" data-match-index="${r.matchIndex || 0}">
                    <span class="search-result-path">${escapeHtml(displayPath)}</span>
                    <span class="search-result-context">${highlighted}</span>
                </div>`;
            }).join('');
            // 点击结果打开对应笔记并跳转到匹配位置
            el.searchResults.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const relPath = item.dataset.path;
                    const matchIndex = parseInt(item.dataset.matchIndex) || 0;
                    const name = relPath.split(/[\\/]/).pop();
                    await openNote(relPath, name);
                    // 等待渲染后滚动，最后再关闭面板（避免布局变化干扰）
                    setTimeout(() => {
                        for (let i = 0; i < 3; i++) requestAnimationFrame(() => {});
                        requestAnimationFrame(() => {
                            scrollToKeyword(lastSearchKeyword, matchIndex);
                            closeSearchPanel();
                        });
                    }, 300);
                });
            });
        } else {
            el.searchResults.innerHTML = '<div class="search-no-results">无匹配结果</div>';
        }
    } catch (err) {
        console.error('搜索失败:', err);
        el.searchResults.innerHTML = '<div class="search-no-results">搜索出错</div>';
    }
}

function scrollToKeyword(keyword, matchIndex = 0) {
    if (!state.editor || !keyword) return;
    const kw = keyword.toLowerCase();

    // 用 TreeWalker 在 DOM 中定位关键词（精确到像素）
    const editorDom = document.querySelector('.ProseMirror');
    if (!editorDom) return;

    let nth = 0;
    const walker = document.createTreeWalker(editorDom, NodeFilter.SHOW_TEXT);
    let textNode;
    while (textNode = walker.nextNode()) {
        const text = textNode.textContent;
        let localIdx = 0;
        while (localIdx <= text.length - keyword.length) {
            if (text.slice(localIdx, localIdx + keyword.length).toLowerCase() === kw) {
                if (nth === matchIndex) {
                    // 创建 Range 获取精确屏幕坐标
                    const range = document.createRange();
                    range.setStart(textNode, localIdx);
                    range.setEnd(textNode, localIdx + keyword.length);
                    const rect = range.getBoundingClientRect();

                    const wrapper = el.editorWrapper;
                    const wrapperTop = wrapper.getBoundingClientRect().top;
                    const targetScroll = wrapper.scrollTop + rect.top - wrapperTop - 150;
                    wrapper.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });

                    // 光标移到关键词结尾
                    const pos = state.editor.view.posAtDOM(textNode, localIdx + keyword.length);
                    state.editor.commands.setTextSelection(pos);
                    return;
                }
                nth++;
                localIdx += keyword.length;
            } else {
                localIdx++;
            }
        }
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 搜索按钮
$('#btn-search').addEventListener('click', openSearchPanel);

// 关闭按钮
$('#btn-search-close').addEventListener('click', closeSearchPanel);

// 输入时防抖搜索
el.searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(el.searchInput.value), 300);
});

// ============================================================
// 高亮合集
// ============================================================

async function openHighlightsPanel() {
    el.highlightsPanel.style.display = '';
    el.highlightsResults.innerHTML = '<div class="highlights-loading">加载中...</div>';

    try {
        const results = await App.GetHighlights();
        if (!results || results.length === 0) {
            el.highlightsResults.innerHTML = '<div class="highlights-empty">暂无高亮内容</div>';
            return;
        }

        el.highlightsResults.innerHTML = results.map(r => {
            const displayPath = r.relPath.endsWith('.json')
                ? r.relPath.slice(0, -5).replace(/\\/g, ' / ')
                : r.relPath;
            // 在上下文中高亮被标记的文本
            const ctx = escapeHtml(r.context);
            const hlText = escapeHtml(r.highlighted);
            const idx = ctx.indexOf(hlText);
            let highlighted = ctx;
            if (idx >= 0) {
                highlighted = ctx.slice(0, idx) + '<mark class="search-highlight">' + hlText + '</mark>' + ctx.slice(idx + hlText.length);
            }
            return `<div class="search-result-item" data-path="${escapeHtml(r.relPath)}" data-text="${escapeHtml(r.highlighted)}">
                <span class="search-result-path">${escapeHtml(displayPath)}</span>
                <span class="search-result-context">${highlighted}</span>
            </div>`;
        }).join('');

        // 点击跳转
        el.highlightsResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', async () => {
                const relPath = item.dataset.path;
                const text = item.dataset.text;
                const name = relPath.split(/[\\/]/).pop();
                await openNote(relPath, name);
                closeHighlightsPanel();
                // 等待渲染后滚动到高亮文本
                setTimeout(() => {
                    for (let i = 0; i < 3; i++) requestAnimationFrame(() => {});
                    requestAnimationFrame(() => {
                        scrollToKeyword(text, 0);
                    });
                }, 300);
            });
        });
    } catch (err) {
        console.error('加载高亮失败:', err);
        el.highlightsResults.innerHTML = '<div class="highlights-empty">加载失败</div>';
    }
}

function closeHighlightsPanel() {
    el.highlightsPanel.style.display = 'none';
}

$('#btn-highlights').addEventListener('click', openHighlightsPanel);
$('#btn-highlights-close').addEventListener('click', closeHighlightsPanel);

// 统一 ESC 处理：图片查看器 > 高亮面板 > 搜索面板 > 关闭笔记
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    if (el.imageViewer.style.display !== 'none') {
        e.preventDefault();
        closeImageViewer();
        return;
    }

    if (el.highlightsPanel.style.display !== 'none') {
        e.preventDefault();
        closeHighlightsPanel();
        return;
    }

    if (el.searchPanel.style.display !== 'none') {
        e.preventDefault();
        closeSearchPanel();
        return;
    }

    // 焦点在编辑器内且有打开的笔记 → 保存并关闭
    if (state.currentNote && state.editor && state.editor.isFocused) {
        e.preventDefault();
        if (state.isDirty) {
            saveCurrentNote().then(() => closeNote());
        } else {
            closeNote();
        }
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
    if (!hasNote) $$('.format-btn.active').forEach(b => b.classList.remove('active'));
}

$$('.format-btn').forEach(btn => {
    const format = btn.dataset.format;
    if (!format) return;
    btn.addEventListener('click', () => {
        if (!state.currentNote || !state.editor) return;
        const ed = state.editor;
        const chain = ed.chain().focus();
        switch (format) {
            case 'bold': chain.toggleBold().run(); break;
            case 'italic': chain.toggleItalic().run(); break;
            case 'underline': chain.toggleUnderline().run(); break;
            case 'strikeThrough': chain.toggleStrike().run(); break;
            case 'highlight': chain.toggleHighlight().run(); break;
            case 'spoiler': chain.toggleSpoiler().run(); break;
            case 'heading1': chain.toggleHeading({ level: 1 }).run(); break;
            case 'heading2': chain.toggleHeading({ level: 2 }).run(); break;
            case 'heading3': chain.toggleHeading({ level: 3 }).run(); break;
            case 'hr': chain.setHorizontalRule().run(); break;
            case 'blockquote': chain.toggleBlockquote().run(); break;
            case 'link': {
                const prev = ed.getAttributes('link');
                if (prev.href) {
                    chain.unsetLink().run();
                } else {
                    showLinkDialog();
                }
                break;
            }
        }
        updateFormatButtonStates();
    });
});

function updateFormatButtonStates() {
    if (!state.editor) return;
    const ed = state.editor;
    $$('.format-btn[data-format]').forEach(btn => {
        const format = btn.dataset.format;
        let active = false;
        switch (format) {
            case 'bold': active = ed.isActive('bold'); break;
            case 'italic': active = ed.isActive('italic'); break;
            case 'underline': active = ed.isActive('underline'); break;
            case 'strikeThrough': active = ed.isActive('strike'); break;
            case 'highlight': active = ed.isActive('highlight'); break;
            case 'spoiler': active = ed.isActive('spoiler'); break;
            case 'heading1': active = ed.isActive('heading', { level: 1 }); break;
            case 'heading2': active = ed.isActive('heading', { level: 2 }); break;
            case 'heading3': active = ed.isActive('heading', { level: 3 }); break;
            case 'blockquote': active = ed.isActive('blockquote'); break;
            case 'link': active = ed.isActive('link'); break;
        }
        btn.classList.toggle('active', active);
    });
}

// ============================================================
// 媒体插入按钮
// ============================================================

$('#btn-insert-image').addEventListener('click', async () => {
    if (!state.currentNote || !state.editor) return;
    
    // 在打开文件对话框之前，保存当前光标位置
    const { from, to } = state.editor.state.selection;
    
    try {
        const mediaInfo = await App.ImportMedia(state.currentNote, 'image');
        if (!mediaInfo) return;
        const url = makeMediaUrl(mediaInfo.relPath);
        
        // 插入媒体，然后插入一个段落并将光标移到段落中
        state.editor.chain()
            .insertContentAt({ from, to }, [
                { type: 'resizableImage', attrs: { src: url, alt: mediaInfo.fileName, width: 300 } },
                { type: 'paragraph' }
            ])
            .focus()
            .run();
    } catch (err) { console.error('插入图片失败:', err); notify('插入图片失败', 'error'); }
});

$('#btn-insert-video').addEventListener('click', async () => {
    if (!state.currentNote || !state.editor) return;
    
    // 在打开文件对话框之前，保存当前光标位置
    const { from, to } = state.editor.state.selection;
    
    try {
        const mediaInfo = await App.ImportMedia(state.currentNote, 'video');
        if (!mediaInfo) return;
        const url = makeMediaUrl(mediaInfo.relPath);
        
        // 插入媒体，然后插入一个段落并将光标移到段落中
        state.editor.chain()
            .insertContentAt({ from, to }, [
                { type: 'videoNode', attrs: { src: url, name: mediaInfo.fileName, width: 480 } },
                { type: 'paragraph' }
            ])
            .focus()
            .run();
    } catch (err) { console.error('插入视频失败:', err); notify('插入视频失败', 'error'); }
});

$('#btn-insert-audio').addEventListener('click', async () => {
    if (!state.currentNote || !state.editor) return;
    
    // 在打开文件对话框之前，保存当前光标位置
    const { from, to } = state.editor.state.selection;
    
    try {
        const mediaInfo = await App.ImportMedia(state.currentNote, 'audio');
        if (!mediaInfo) return;
        const url = makeMediaUrl(mediaInfo.relPath);
        
        // 插入媒体，然后插入一个段落并将光标移到段落中
        state.editor.chain()
            .insertContentAt({ from, to }, [
                { type: 'audioNode', attrs: { src: url, name: mediaInfo.fileName } },
                { type: 'paragraph' }
            ])
            .focus()
            .run();
    } catch (err) { console.error('插入音频失败:', err); notify('插入音频失败', 'error'); }
});

// ============================================================
// 表格：插入按钮 + 浮动工具栏
// ============================================================

// 构建 2×2（首行为表头）的表格节点
function buildTableNode(schema) {
    const { table, tableRow, tableHeader, tableCell, paragraph } = schema.nodes;
    const makeRow = (cellType) => tableRow.create(null, [
        cellType.create(null, paragraph.create()),
        cellType.create(null, paragraph.create()),
    ]);
    return table.create(null, [makeRow(tableHeader), makeRow(tableCell)]);
}

$('#btn-insert-table').addEventListener('click', () => {
    if (!state.currentNote || !state.editor) return;
    const ed = state.editor;
    const { $from } = ed.state.selection;

    // 找光标所在的最外层表格：光标已在表格内时直接 insertTable 会嵌套进单元格，
    // 此时把新表格插到该表格之后
    let tableDepth = -1;
    for (let d = 1; d <= $from.depth; d++) {
        if ($from.node(d).type.name === 'table') tableDepth = d;
    }

    if (tableDepth === -1) {
        ed.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
        return;
    }

    // 新表格起点之后的偏移：+1 进表格、+2 进首行、+3 进首个单元格、+4 进单元格内段落
    const posAfter = $from.before(tableDepth) + $from.node(tableDepth).nodeSize;
    ed.chain().focus()
        .command(({ tr }) => { tr.insert(posAfter, buildTableNode(ed.state.schema)); return true; })
        .setTextSelection(posAfter + 4)
        .run();
});

const tableToolbar = $('#table-toolbar');

function hideTableToolbar() {
    tableToolbar.style.display = 'none';
}

// 查找光标所在单元格及所属表格的 DOM 信息；光标不在表格内时返回 null
function findCurrentCell() {
    if (!state.editor) return null;
    const { $from } = state.editor.state.selection;
    const view = state.editor.view;
    let cellDom = null, cellNode = null, tableDom = null, tableNode = null, tablePos = null;
    for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (!cellDom && (node.type.name === 'tableCell' || node.type.name === 'tableHeader')) {
            const dom = view.nodeDOM($from.before(d));
            if (dom && dom.tagName) {
                cellDom = dom;
                cellNode = node;
            }
        } else if (!tableDom && node.type.name === 'table') {
            const dom = view.nodeDOM($from.before(d));
            if (dom && dom.tagName) {
                tableDom = dom.tagName === 'TABLE' ? dom : (dom.querySelector('table') || dom);
                tableNode = node;
                tablePos = $from.before(d);
            }
        }
    }
    if (!cellDom || !tableDom) return null;
    return { cellDom, cellNode, tableDom, tableNode, tablePos, colIndex: cellDom.cellIndex };
}

// 光标在表格内时，将浮动工具栏定位到表格上方居中
function updateTableToolbar() {
    if (!state.editor || !state.currentNote) { hideTableToolbar(); return; }
    const cellInfo = findCurrentCell();
    if (!cellInfo) { hideTableToolbar(); return; }

    // 对齐按钮高亮（未设置属性时视为左对齐）
    const align = cellInfo.cellNode.attrs.textAlign || 'left';
    tableToolbar.querySelectorAll('[data-align]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === align);
    });
    // 宽度自适应按钮高亮
    const fitBtn = tableToolbar.querySelector('[data-action="fitWidth"]');
    if (fitBtn) fitBtn.classList.toggle('active', !!cellInfo.tableNode.attrs.fitWidth);

    const rect = cellInfo.tableDom.getBoundingClientRect();
    if (rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
        hideTableToolbar();
        return;
    }

    tableToolbar.style.display = '';
    const tbRect = tableToolbar.getBoundingClientRect();
    // 固定在表格左上角：左边缘与表格左边缘对齐
    let left = Math.max(8, Math.min(rect.left, window.innerWidth - tbRect.width - 8));
    // 默认在表格上方；空间不足（被标题栏/编辑器工具栏遮挡）时叠在表格上沿
    const minTop = 80;
    let top = rect.top - tbRect.height - 6;
    if (top < minTop) top = Math.max(minTop, rect.top + 6);
    tableToolbar.style.left = left + 'px';
    tableToolbar.style.top = top + 'px';
}

tableToolbar.querySelectorAll('.table-tb-btn').forEach(btn => {
    // 阻止 mousedown 默认行为，避免点击按钮导致编辑器失焦、光标移出表格
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
        const ed = state.editor;
        if (!ed || !state.currentNote) return;
        const action = btn.dataset.action;
        const commands = {
            addRowAbove: 'addRowBefore',
            addRowBelow: 'addRowAfter',
            deleteRow: 'deleteRow',
            addColumnLeft: 'addColumnBefore',
            addColumnRight: 'addColumnAfter',
            deleteColumn: 'deleteColumn',
            deleteTable: 'deleteTable',
        };
        if (commands[action]) {
            ed.chain().focus()[commands[action]]().run();
        } else if (action.startsWith('align')) {
            alignColumn(action.slice(5).toLowerCase());
        } else if (action === 'fitWidth') {
            toggleFitWidth();
        }
        // 删除表格后光标已不在表格内，这里会自动隐藏
        updateTableToolbar();
    });
});

// 切换表格宽度自适应（拉伸至编辑区全宽，列宽随窗口变化）
function toggleFitWidth() {
    const ed = state.editor;
    const info = findCurrentCell();
    if (!ed || !info) return;
    ed.view.dispatch(ed.state.tr.setNodeMarkup(info.tablePos, null, {
        ...info.tableNode.attrs,
        fitWidth: !info.tableNode.attrs.fitWidth,
    }));
}

// 将 fitWidth 节点属性同步到表格 DOM。
// resizable 表格由 prosemirror-tables 的 TableView 节点视图接管 DOM（只更新列宽），
// 自定义属性不会经 renderHTML 渲染，因此在每次事务后手动同步。
function syncFitWidthDom() {
    if (!state.editor) return;
    state.editor.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'table') return true;
        const dom = state.editor.view.nodeDOM(pos);
        const tableEl = dom && (dom.tagName === 'TABLE' ? dom : dom.querySelector('table'));
        if (tableEl) {
            if (node.attrs.fitWidth) tableEl.setAttribute('data-fit-width', 'true');
            else tableEl.removeAttribute('data-fit-width');
        }
        return false;
    });
}

// 整列设置对齐（含表头行）；该列已是此对齐时再次点击则取消
function alignColumn(value) {
    const ed = state.editor;
    if (!ed) return;
    const cellInfo = findCurrentCell();
    if (!cellInfo) return;
    const target = cellInfo.cellNode.attrs.textAlign === value ? null : value;
    const view = ed.view;
    const tr = ed.state.tr;
    let changed = false;
    cellInfo.tableDom.querySelectorAll('tr').forEach((row) => {
        const cellEl = row.cells[cellInfo.colIndex];
        if (!cellEl) return;
        let pos = view.posAtDOM(cellEl, 0);
        let node = tr.doc.nodeAt(pos);
        if (!node || (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader')) {
            // posAtDOM 也可能落在单元格内部（+1），回退到单元格起点
            node = tr.doc.nodeAt(--pos);
            if (!node || (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader')) return;
        }
        tr.setNodeMarkup(pos, null, { ...node.attrs, textAlign: target });
        changed = true;
    });
    if (changed) view.dispatch(tr);
}

// 滚动/窗口变化时重新定位表格工具栏
el.editorWrapper.addEventListener('scroll', () => {
    if (tableToolbar.style.display !== 'none') updateTableToolbar();
});
window.addEventListener('resize', () => {
    if (tableToolbar.style.display !== 'none') updateTableToolbar();
});

// ============================================================
// 键盘快捷键
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCurrentNoteWithBackup().then(() => notify('已保存（含备份）'));
    }
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        openSearchPanel();
    }
});

// ============================================================
// 阻止外部文件拖入的默认行为（避免打开新窗口）
// ============================================================
document.addEventListener('dragover', (e) => { 
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'none';
});

document.addEventListener('drop', (e) => { 
    e.preventDefault();
    // 不处理任何拖入文件，只是阻止浏览器默认行为
});

// ============================================================
// 文件树根区域拖放
// ============================================================
el.fileTree.addEventListener('dragover', (e) => { 
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
});
el.fileTree.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.closest('.tree-node-header')) return;
    const srcNode = state.dragData;
    if (!srcNode) return;
    try {
        await App.MoveEntry(srcNode.relPath, '');
        await refreshFileTree();
        state.dragData = null;
    } catch (err) { console.error('移动失败:', err); notify('移动失败: ' + err, 'error'); }
});

// ============================================================
// 侧边栏按钮
// ============================================================
function getUniqueName(baseName, isDir, parentDir) {
    // 在指定目录下查找已存在的名称
    let existing = [];
    if (parentDir) {
        const findNode = (tree, path) => {
            for (const n of tree) {
                if (n.relPath === path) return n;
                if (n.children) {
                    const found = findNode(n.children, path);
                    if (found) return found;
                }
            }
            return null;
        };
        const parent = findNode(state.fileTree, parentDir);
        if (parent && parent.children) {
            existing = parent.children
                .filter(n => n.isDir === isDir)
                .map(n => isDir ? n.name : getFileNameWithoutExt(n.name));
        }
    } else {
        existing = state.fileTree
            .filter(n => n.isDir === isDir)
            .map(n => isDir ? n.name : getFileNameWithoutExt(n.name));
    }
    if (!existing.includes(baseName)) return baseName;
    let counter = 1, name;
    do { name = `${baseName}${counter}`; counter++; } while (existing.includes(name));
    return name;
}

$('#btn-new-folder').addEventListener('click', async () => {
    const idx = state.currentNote ? Math.max(state.currentNote.lastIndexOf('/'), state.currentNote.lastIndexOf('\\')) : -1;
    const parentDir = idx > 0 ? state.currentNote.substring(0, idx) : '';
    if (parentDir) state.expandedDirs[parentDir] = true;
    const name = getUniqueName('新文件夹', true, parentDir);
    try {
        await App.CreateFolder(parentDir, name);
        state.inlineEditPath = parentDir ? parentDir + '/' + name : name;
        state.inlineEditIsNew = true;
        await refreshFileTree();
    } catch (err) { console.error('创建失败:', err); notify('创建失败: ' + err, 'error'); }
});

$('#btn-new-note').addEventListener('click', async () => {
    const idx = state.currentNote ? Math.max(state.currentNote.lastIndexOf('/'), state.currentNote.lastIndexOf('\\')) : -1;
    const parentDir = idx > 0 ? state.currentNote.substring(0, idx) : '';
    if (parentDir) state.expandedDirs[parentDir] = true;
    const name = getUniqueName('新笔记', false, parentDir);
    try {
        await App.CreateNote(parentDir, name);
        state.inlineEditPath = parentDir ? parentDir + '/' + name + '.json' : name + '.json';
        state.inlineEditIsNew = true;
        await refreshFileTree();
    } catch (err) { console.error('创建失败:', err); notify('创建失败: ' + err, 'error'); }
});

$('#btn-collapse-all').addEventListener('click', () => { state.expandedDirs = {}; renderFileTree(); });

$('#btn-import-md').addEventListener('click', async () => {
    try {
        const node = await App.ImportMarkdownFile('');
        if (node) { await refreshFileTree(); notify('导入成功: ' + node.name); }
    } catch (err) { console.error('导入失败:', err); notify('导入失败: ' + err, 'error'); }
});

$('#btn-refresh').addEventListener('click', async () => { await refreshFileTree(); notify('已刷新'); });

// ============================================================
// 禁用浏览器右键菜单
// ============================================================
// 用捕获阶段监听，确保在 ProseMirror 之前拦截
document.addEventListener('contextmenu', (e) => {
    // 编辑器区域：检测是否右键点击了媒体元素
    if (e.target.closest('.ProseMirror') || e.target.closest('#editor-container')) {
        e.preventDefault();
        const mediaEl = e.target.closest('[data-type="resizable-image"]') ||
                        e.target.closest('[data-type="video-node"]') ||
                        e.target.closest('[data-type="audio-node"]');
        if (mediaEl && mediaEl.__mediaFileName) {
            e.stopPropagation();
            const pos = mediaEl.__mediaGetPos ? mediaEl.__mediaGetPos() : undefined;
            showMediaContextMenu(e.clientX, e.clientY, mediaEl.__mediaFileName, pos, mediaEl.__mediaEditor);
        }
        return;
    }
    if (e.target.closest('#file-tree')) return;
    e.preventDefault();
}, true);

// ============================================================
// 初始化
// ============================================================
async function init() {
    initEditor();
    initTitlebar();
    initSidebarResizer();
    updateToolbarState();

    // 开发模式（wails dev）在标题栏显示徽标，确认使用的是隔离的测试数据
    if (App && App.IsDevMode) {
        App.IsDevMode().then((isDev) => {
            if (isDev) $('#dev-mode-badge').style.display = '';
        }).catch(() => {});
    }

    if (App) await refreshFileTree();

    window.addEventListener('beforeunload', async (e) => {
        if (state.isDirty && state.currentNote) await saveCurrentNote();
    });

    // 3秒无操作自动保存
    let autoSaveTimer = null;
    state.editor.on('update', () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
            if (state.isDirty && state.currentNote) await saveCurrentNote();
        }, 3000);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => console.error('初始化失败:', err));
});
