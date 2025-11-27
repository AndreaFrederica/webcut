// ==================== WebGL 渲染器 ====================
class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            preserveDrawingBuffer: true
        }) || canvas.getContext('experimental-webgl');

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        this.programs = {};
        this.buffers = {};
        this.textures = {};
        this.init();
    }

    init() {
        const gl = this.gl;

        // 图片着色器
        this.programs.image = this.createProgram(
            `attribute vec2 a_position;
             attribute vec2 a_texCoord;
             varying vec2 v_texCoord;
             void main() {
                 gl_Position = vec4(a_position, 0.0, 1.0);
                 v_texCoord = a_texCoord;
             }`,
            `precision mediump float;
             uniform sampler2D u_image;
             varying vec2 v_texCoord;
             void main() {
                 gl_FragColor = texture2D(u_image, v_texCoord);
             }`
        );

        // 线条着色器
        this.programs.line = this.createProgram(
            `attribute vec2 a_position;
             uniform vec2 u_resolution;
             void main() {
                 vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
                 gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
             }`,
            `precision mediump float;
             uniform vec4 u_color;
             void main() {
                 gl_FragColor = u_color;
             }`
        );

        // 矩形填充着色器
        this.programs.rect = this.programs.line;

        // 创建缓冲区
        this.buffers.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 0, 1,
             1, -1, 1, 1,
            -1,  1, 0, 0,
             1,  1, 1, 0
        ]), gl.STATIC_DRAW);

        this.buffers.lines = gl.createBuffer();
    }

    createProgram(vertexSrc, fragmentSrc) {
        const gl = this.gl;

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vertexSrc);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fragmentSrc);
        gl.compileShader(fs);

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        return program;
    }

    setImage(image) {
        const gl = this.gl;

        if (this.textures.image) {
            gl.deleteTexture(this.textures.image);
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        this.textures.image = texture;
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    clear() {
        const gl = this.gl;
        gl.clearColor(0.95, 0.95, 0.95, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    drawImage() {
        const gl = this.gl;
        const program = this.programs.image;

        gl.useProgram(program);

        const posLoc = gl.getAttribLocation(program, 'a_position');
        const texLoc = gl.getAttribLocation(program, 'a_texCoord');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.image);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawRect(x, y, w, h, color, filled = true) {
        const gl = this.gl;
        const program = this.programs.rect;

        gl.useProgram(program);

        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const colorLoc = gl.getUniformLocation(program, 'u_color');
        const posLoc = gl.getAttribLocation(program, 'a_position');

        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);
        gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);

        let vertices;
        if (filled) {
            vertices = new Float32Array([
                x, y,
                x + w, y,
                x, y + h,
                x + w, y + h
            ]);
        } else {
            vertices = new Float32Array([
                x, y, x + w, y,
                x + w, y, x + w, y + h,
                x + w, y + h, x, y + h,
                x, y + h, x, y
            ]);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lines);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        if (filled) {
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        } else {
            gl.drawArrays(gl.LINES, 0, 8);
        }
    }

    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
        const gl = this.gl;
        const program = this.programs.line;

        gl.useProgram(program);
        gl.lineWidth(lineWidth);

        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const colorLoc = gl.getUniformLocation(program, 'u_color');
        const posLoc = gl.getAttribLocation(program, 'a_position');

        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);
        gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);

        const vertices = new Float32Array([x1, y1, x2, y2]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lines);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.LINES, 0, 2);
    }

    drawCircle(cx, cy, radius, color, filled = true) {
        const gl = this.gl;
        const program = this.programs.line;

        gl.useProgram(program);

        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const colorLoc = gl.getUniformLocation(program, 'u_color');
        const posLoc = gl.getAttribLocation(program, 'a_position');

        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);
        gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);

        const segments = 32;
        const vertices = [];

        if (filled) {
            vertices.push(cx, cy);
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                vertices.push(cx + Math.cos(angle) * radius);
                vertices.push(cy + Math.sin(angle) * radius);
            }
        } else {
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                vertices.push(cx + Math.cos(angle) * radius);
                vertices.push(cy + Math.sin(angle) * radius);
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lines);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        if (filled) {
            gl.drawArrays(gl.TRIANGLE_FAN, 0, segments + 2);
        } else {
            gl.drawArrays(gl.LINE_STRIP, 0, segments + 1);
        }
    }

    hexToGL(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b, 1.0];
    }
}

// ==================== 全局状态 ====================
const state = {
    originalImage: null,
    imageCache: null,
    rows: 6,
    cols: 4,
    gridColor: '#ff0000',
    lineWidth: 2,
    mode: 'uniform',

    centerLinesX: [],
    centerLinesY: [],
    cellWidth: 100,
    cellHeight: 100,

    scale: 1,
    canvasWidth: 0,
    canvasHeight: 0,

    dragging: null,
    hovered: null,

    disabledCells: new Set(),
    croppedImages: [],
    customAreas: {}
};

let renderer = null;
let previewScale = 0.25; // 预览图使用 1/4 尺寸

// ==================== DOM 元素 ====================
const elements = {};

// ==================== 本地存储 ====================
const STORAGE_KEY = 'emoji-cutter-settings';

function saveSettings() {
    const settings = {
        rows: state.rows,
        cols: state.cols,
        gridColor: state.gridColor,
        lineWidth: state.lineWidth,
        mode: state.mode,
        cellWidth: state.cellWidth,
        cellHeight: state.cellHeight
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {}
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const s = JSON.parse(saved);
            state.rows = s.rows || 6;
            state.cols = s.cols || 4;
            state.gridColor = s.gridColor || '#ff0000';
            state.lineWidth = s.lineWidth || 2;
            state.mode = s.mode || 'uniform';
            state.cellWidth = s.cellWidth || 100;
            state.cellHeight = s.cellHeight || 100;
            return true;
        }
    } catch (e) {}
    return false;
}

function applySettingsToUI() {
    document.getElementById('rowsRange').value = Math.min(state.rows, 12);
    document.getElementById('rowsInput').value = state.rows;
    document.getElementById('colsRange').value = Math.min(state.cols, 12);
    document.getElementById('colsInput').value = state.cols;
    document.getElementById('gridColor').value = state.gridColor;
    document.getElementById('colorValue').textContent = state.gridColor;
    document.getElementById('lineWidth').value = state.lineWidth;
    document.getElementById('lineWidthValue').textContent = state.lineWidth + 'px';
    document.getElementById('cellWidth').value = state.cellWidth;
    document.getElementById('cellHeight').value = state.cellHeight;

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });

    document.querySelectorAll('.quick-grid-btn').forEach(btn => {
        const r = parseInt(btn.dataset.rows);
        const c = parseInt(btn.dataset.cols);
        btn.classList.toggle('active', r === state.rows && c === state.cols);
    });

    updateModeUI();
}

// ==================== 初始化 ====================
function init() {
    elements.uploadArea = document.getElementById('uploadArea');
    elements.fileInput = document.getElementById('fileInput');
    elements.mainCanvas = document.getElementById('mainCanvas');
    elements.canvasContainer = document.getElementById('canvasContainer');
    elements.placeholder = document.getElementById('placeholder');
    elements.imageInfo = document.getElementById('imageInfo');
    elements.previewGrid = document.getElementById('previewGrid');
    elements.exportBtn = document.getElementById('exportBtn');
    elements.exportSingleBtn = document.getElementById('exportSingleBtn');
    elements.progressOverlay = document.getElementById('progressOverlay');
    elements.progressText = document.getElementById('progressText');
    elements.modeHint = document.getElementById('modeHint');
    elements.editHint = document.getElementById('editHint');
    elements.cellSizeControl = document.getElementById('cellSizeControl');

    // 初始化 WebGL 渲染器
    try {
        renderer = new WebGLRenderer(elements.mainCanvas);
    } catch (e) {
        console.error('WebGL init failed:', e);
        alert('您的浏览器不支持 WebGL，请使用现代浏览器');
        return;
    }

    loadSettings();
    applySettingsToUI();
    setupEventListeners();
}

// ==================== 渲染 ====================
let renderPending = false;

function scheduleRender() {
    if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(() => {
            renderPending = false;
            performRender();
        });
    }
}

function performRender() {
    if (!state.originalImage || !renderer) return;

    const w = state.canvasWidth;
    const h = state.canvasHeight;

    // 启用混合
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 绘制背景图
    renderer.drawImage();

    // 绘制网格
    if (state.mode === 'uniform') {
        drawUniformGridGL(w, h);
    } else {
        drawCenterLineModeGL(w, h);
    }
}

function drawUniformGridGL(w, h) {
    const cellW = w / state.cols;
    const cellH = h / state.rows;
    const color = renderer.hexToGL(state.gridColor);
    const customColor = [0.3, 0.8, 0.4, 1]; // 绿色表示自定义区域

    // 绘制所有单元格
    for (let row = 0; row < state.rows; row++) {
        for (let col = 0; col < state.cols; col++) {
            const idx = row * state.cols + col;
            const isDisabled = state.disabledCells.has(idx);
            const hasCustom = state.customAreas && state.customAreas[idx];

            if (isDisabled) {
                // 禁用遮罩
                renderer.drawRect(col * cellW, row * cellH, cellW, cellH, [0, 0, 0, 0.5], true);
                // X 标记
                const x = col * cellW;
                const y = row * cellH;
                renderer.drawLine(x + 10, y + 10, x + cellW - 10, y + cellH - 10, [1, 0.3, 0.3, 1]);
                renderer.drawLine(x + cellW - 10, y + 10, x + 10, y + cellH - 10, [1, 0.3, 0.3, 1]);
            } else if (hasCustom) {
                // 显示自定义裁剪区域
                const custom = state.customAreas[idx];
                const cx = custom.x * state.scale;
                const cy = custom.y * state.scale;
                const cw = custom.width * state.scale;
                const ch = custom.height * state.scale;

                // 原网格位置半透明
                renderer.drawRect(col * cellW, row * cellH, cellW, cellH, [0.5, 0.5, 0.5, 0.2], true);

                // 自定义区域高亮
                renderer.drawRect(cx, cy, cw, ch, [0.3, 0.8, 0.4, 0.25], true);
                renderer.drawRect(cx, cy, cw, ch, customColor, false);
            }
        }
    }

    // 网格线
    for (let i = 1; i < state.cols; i++) {
        renderer.drawLine(i * cellW, 0, i * cellW, h, color);
    }
    for (let i = 1; i < state.rows; i++) {
        renderer.drawLine(0, i * cellH, w, i * cellH, color);
    }

    // 边框
    renderer.drawRect(0, 0, w, h, color, false);
}

function drawCenterLineModeGL(w, h) {
    const scale = state.scale;
    const halfW = state.cellWidth / 2 * scale;
    const halfH = state.cellHeight / 2 * scale;
    const color = renderer.hexToGL(state.gridColor);
    const hoverColor = [1, 1, 0, 1];
    const customColor = [0.3, 0.8, 0.4, 1]; // 绿色表示自定义区域

    // 裁剪区域框
    let index = 0;
    for (const cy of state.centerLinesY) {
        for (const cx of state.centerLinesX) {
            const displayX = cx * scale;
            const displayY = cy * scale;
            const left = displayX - halfW;
            const top = displayY - halfH;
            const rectW = state.cellWidth * scale;
            const rectH = state.cellHeight * scale;

            const isDisabled = state.disabledCells.has(index);
            const hasCustom = state.customAreas && state.customAreas[index];

            // 填充
            if (isDisabled) {
                renderer.drawRect(left, top, rectW, rectH, [0, 0, 0, 0.5], true);
                renderer.drawLine(left + 10, top + 10, left + rectW - 10, top + rectH - 10, [1, 0.3, 0.3, 1]);
                renderer.drawLine(left + rectW - 10, top + 10, left + 10, top + rectH - 10, [1, 0.3, 0.3, 1]);
                // 边框
                renderer.drawRect(left, top, rectW, rectH, [1, 0.3, 0.3, 0.8], false);
            } else if (hasCustom) {
                // 显示自定义裁剪区域
                const custom = state.customAreas[index];
                const customLeft = custom.x * scale;
                const customTop = custom.y * scale;
                const customW = custom.width * scale;
                const customH = custom.height * scale;

                // 原位置半透明
                renderer.drawRect(left, top, rectW, rectH, [0.5, 0.5, 0.5, 0.15], true);
                renderer.drawRect(left, top, rectW, rectH, [1, 1, 1, 0.3], false);

                // 自定义区域高亮
                renderer.drawRect(customLeft, customTop, customW, customH, [0.3, 0.8, 0.4, 0.25], true);
                renderer.drawRect(customLeft, customTop, customW, customH, customColor, false);
            } else {
                renderer.drawRect(left, top, rectW, rectH, [0.4, 0.5, 0.9, 0.15], true);
                // 边框
                renderer.drawRect(left, top, rectW, rectH, [1, 1, 1, 0.8], false);
            }

            index++;
        }
    }

    // 垂直中心线
    for (let i = 0; i < state.centerLinesX.length; i++) {
        const x = state.centerLinesX[i] * scale;
        const isActive = (state.hovered?.type === 'x' && state.hovered?.index === i) ||
                        (state.dragging?.type === 'x' && state.dragging?.index === i);

        renderer.drawLine(x, 0, x, h, isActive ? hoverColor : color);

        // 手柄
        const radius = isActive ? 10 : 8;
        renderer.drawCircle(x, h / 2, radius, [1, 1, 1, 1], true);
        renderer.drawCircle(x, h / 2, radius, isActive ? hoverColor : color, false);
    }

    // 水平中心线
    for (let i = 0; i < state.centerLinesY.length; i++) {
        const y = state.centerLinesY[i] * scale;
        const isActive = (state.hovered?.type === 'y' && state.hovered?.index === i) ||
                        (state.dragging?.type === 'y' && state.dragging?.index === i);

        renderer.drawLine(0, y, w, y, isActive ? hoverColor : color);

        // 手柄
        const radius = isActive ? 10 : 8;
        renderer.drawCircle(w / 2, y, radius, [1, 1, 1, 1], true);
        renderer.drawCircle(w / 2, y, radius, isActive ? hoverColor : color, false);
    }
}

// ==================== 事件监听 ====================
function setupEventListeners() {
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);

    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });
    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });
    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.mode = btn.dataset.mode;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateModeUI();
            saveSettings();
            if (state.originalImage) {
                initializeCenterLines();
                scheduleRender();
                schedulePreviewUpdate();
            }
        });
    });

    setupGridControls();
    setupCanvasEvents();

    document.getElementById('gridColor').addEventListener('input', (e) => {
        state.gridColor = e.target.value;
        document.getElementById('colorValue').textContent = state.gridColor;
        scheduleRender();
        saveSettings();
    });

    document.getElementById('lineWidth').addEventListener('input', (e) => {
        state.lineWidth = parseInt(e.target.value);
        document.getElementById('lineWidthValue').textContent = state.lineWidth + 'px';
        scheduleRender();
        saveSettings();
    });

    document.getElementById('cellWidth').addEventListener('change', (e) => {
        state.cellWidth = Math.max(10, parseInt(e.target.value) || 100);
        e.target.value = state.cellWidth;
        scheduleRender();
        schedulePreviewUpdate();
        saveSettings();
    });

    document.getElementById('cellHeight').addEventListener('change', (e) => {
        state.cellHeight = Math.max(10, parseInt(e.target.value) || 100);
        e.target.value = state.cellHeight;
        scheduleRender();
        schedulePreviewUpdate();
        saveSettings();
    });

    document.getElementById('autoCalcSize').addEventListener('click', () => {
        autoCalculateCellSize();
        scheduleRender();
        schedulePreviewUpdate();
    });

    document.getElementById('resetLines').addEventListener('click', () => {
        initializeCenterLines();
        state.disabledCells.clear();
        scheduleRender();
        schedulePreviewUpdate();
    });

    document.getElementById('quality').addEventListener('input', (e) => {
        document.getElementById('qualityValue').textContent = Math.round(e.target.value * 100) + '%';
    });

    elements.exportBtn.addEventListener('click', exportAsZip);
    elements.exportSingleBtn.addEventListener('click', exportSeparately);
}

function setupGridControls() {
    const rowsRange = document.getElementById('rowsRange');
    const rowsInput = document.getElementById('rowsInput');
    const colsRange = document.getElementById('colsRange');
    const colsInput = document.getElementById('colsInput');

    rowsRange.addEventListener('input', (e) => {
        state.rows = parseInt(e.target.value);
        rowsInput.value = state.rows;
        onGridSettingsChange();
    });
    rowsInput.addEventListener('change', (e) => {
        state.rows = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
        rowsInput.value = state.rows;
        rowsRange.value = Math.min(state.rows, 12);
        onGridSettingsChange();
    });

    colsRange.addEventListener('input', (e) => {
        state.cols = parseInt(e.target.value);
        colsInput.value = state.cols;
        onGridSettingsChange();
    });
    colsInput.addEventListener('change', (e) => {
        state.cols = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
        colsInput.value = state.cols;
        colsRange.value = Math.min(state.cols, 12);
        onGridSettingsChange();
    });

    document.querySelectorAll('.quick-grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.rows = parseInt(btn.dataset.rows);
            state.cols = parseInt(btn.dataset.cols);
            document.getElementById('rowsRange').value = Math.min(state.rows, 12);
            document.getElementById('rowsInput').value = state.rows;
            document.getElementById('colsRange').value = Math.min(state.cols, 12);
            document.getElementById('colsInput').value = state.cols;

            document.querySelectorAll('.quick-grid-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            onGridSettingsChange();
        });
    });
}

function setupCanvasEvents() {
    let lastMoveTime = 0;
    const THROTTLE = 16;
    let isDragging = false;

    elements.mainCanvas.addEventListener('mousedown', (e) => {
        if (!state.originalImage) return;

        const coords = getCanvasCoords(e);

        if (state.mode === 'centerline') {
            const line = findLineAtPosition(coords.x, coords.y);
            if (line) {
                state.dragging = line;
                isDragging = true;
                elements.mainCanvas.style.cursor = line.type === 'x' ? 'ew-resize' : 'ns-resize';
                e.preventDefault();
            }
        }
    });

    elements.mainCanvas.addEventListener('click', (e) => {
        if (isDragging) {
            isDragging = false;
            return;
        }

        if (!state.originalImage) return;

        const coords = getCanvasCoords(e);

        if (state.mode === 'centerline') {
            const line = findLineAtPosition(coords.x, coords.y);
            if (line) return;
        }

        const cellIndex = findCellAtPosition(coords.x, coords.y);
        if (cellIndex >= 0) {
            if (state.disabledCells.has(cellIndex)) {
                state.disabledCells.delete(cellIndex);
            } else {
                state.disabledCells.add(cellIndex);
            }
            scheduleRender();
            schedulePreviewUpdate();
        }
    });

    let currentHovered = null;

    elements.mainCanvas.addEventListener('mousemove', (e) => {
        const now = performance.now();
        if (now - lastMoveTime < THROTTLE) return;
        lastMoveTime = now;

        if (!state.originalImage) return;

        const coords = getCanvasCoords(e);

        if (state.dragging) {
            if (state.dragging.type === 'x') {
                let newX = coords.x / state.scale;
                newX = Math.max(10, Math.min(state.originalImage.width - 10, newX));
                state.centerLinesX[state.dragging.index] = newX;
            } else {
                let newY = coords.y / state.scale;
                newY = Math.max(10, Math.min(state.originalImage.height - 10, newY));
                state.centerLinesY[state.dragging.index] = newY;
            }
            scheduleRender();
            return;
        }

        if (state.mode !== 'centerline') return;

        const line = findLineAtPosition(coords.x, coords.y);
        const key = line ? `${line.type}-${line.index}` : null;

        if (key !== currentHovered) {
            currentHovered = key;
            state.hovered = line;
            elements.mainCanvas.style.cursor = line ? (line.type === 'x' ? 'ew-resize' : 'ns-resize') : 'default';
            scheduleRender();
        }
    }, { passive: true });

    window.addEventListener('mouseup', () => {
        if (state.dragging) {
            state.dragging = null;
            state.hovered = null;
            currentHovered = null;
            elements.mainCanvas.style.cursor = 'default';
            schedulePreviewUpdate();
            setTimeout(() => { isDragging = false; }, 50);
        }
    }, { passive: true });

    elements.mainCanvas.addEventListener('mouseleave', () => {
        if (!state.dragging) {
            state.hovered = null;
            currentHovered = null;
            elements.mainCanvas.style.cursor = 'default';
            scheduleRender();
        }
    }, { passive: true });
}

// ==================== 坐标计算 ====================
function getCanvasCoords(e) {
    const rect = elements.mainCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function findCellAtPosition(x, y) {
    if (!state.originalImage) return -1;

    if (state.mode === 'uniform') {
        const cellW = state.canvasWidth / state.cols;
        const cellH = state.canvasHeight / state.rows;
        const col = Math.floor(x / cellW);
        const row = Math.floor(y / cellH);
        if (col >= 0 && col < state.cols && row >= 0 && row < state.rows) {
            return row * state.cols + col;
        }
    } else {
        const scale = state.scale;
        const halfW = state.cellWidth / 2 * scale;
        const halfH = state.cellHeight / 2 * scale;

        let index = 0;
        for (const cy of state.centerLinesY) {
            for (const cx of state.centerLinesX) {
                const displayX = cx * scale;
                const displayY = cy * scale;
                const left = displayX - halfW;
                const top = displayY - halfH;

                if (x >= left && x <= left + halfW * 2 && y >= top && y <= top + halfH * 2) {
                    return index;
                }
                index++;
            }
        }
    }
    return -1;
}

function findLineAtPosition(x, y) {
    if (state.mode !== 'centerline') return null;

    const hitRadius = 15;

    for (let i = 0; i < state.centerLinesX.length; i++) {
        const lineX = state.centerLinesX[i] * state.scale;
        if (Math.abs(x - lineX) < hitRadius) {
            return { type: 'x', index: i };
        }
    }

    for (let i = 0; i < state.centerLinesY.length; i++) {
        const lineY = state.centerLinesY[i] * state.scale;
        if (Math.abs(y - lineY) < hitRadius) {
            return { type: 'y', index: i };
        }
    }

    return null;
}

// ==================== 文件处理 ====================
function handleFileSelect(e) {
    if (e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
}

async function handleFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
        alert('请选择有效的图片文件 (JPG, PNG, GIF, WebP)');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            state.originalImage = img;
            state.disabledCells.clear();

            try {
                state.imageCache = await createImageBitmap(img);
            } catch (err) {
                state.imageCache = null;
            }

            initializeCenterLines();
            displayImage();
            updateImageInfo(file.name);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ==================== 显示图片 ====================
function displayImage() {
    if (!state.originalImage || !renderer) return;

    elements.placeholder.classList.add('hidden');
    elements.mainCanvas.classList.remove('hidden');
    elements.imageInfo.classList.remove('hidden');

    const containerWidth = elements.canvasContainer.clientWidth - 40;
    const containerHeight = 600;
    state.scale = Math.min(
        containerWidth / state.originalImage.width,
        containerHeight / state.originalImage.height,
        1
    );

    state.canvasWidth = Math.floor(state.originalImage.width * state.scale);
    state.canvasHeight = Math.floor(state.originalImage.height * state.scale);

    renderer.resize(state.canvasWidth, state.canvasHeight);
    renderer.setImage(state.imageCache || state.originalImage);

    scheduleRender();
    schedulePreviewUpdate();

    elements.exportBtn.disabled = false;
    elements.exportSingleBtn.disabled = false;
}

// ==================== 模式UI ====================
function updateModeUI() {
    if (state.mode === 'uniform') {
        elements.modeHint.textContent = '自动将图片等分为网格，点击单元格可禁用';
        elements.editHint.textContent = '(点击单元格禁用/启用)';
        elements.cellSizeControl.classList.add('hidden');
    } else {
        elements.modeHint.textContent = '拖拽中心线设置位置，点击单元格可禁用';
        elements.editHint.textContent = '(拖拽线条 / 点击单元格禁用)';
        elements.cellSizeControl.classList.remove('hidden');
    }
}

// ==================== 网格设置 ====================
function onGridSettingsChange() {
    state.disabledCells.clear();
    state.customAreas = {};
    updateCellSizeInfo();
    initializeCenterLines();
    scheduleRender();
    schedulePreviewUpdate();
    saveSettings();
}

function initializeCenterLines() {
    if (!state.originalImage) return;

    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;

    state.centerLinesX = [];
    state.centerLinesY = [];

    for (let i = 0; i < state.cols; i++) {
        state.centerLinesX.push((i + 0.5) * imgW / state.cols);
    }

    for (let i = 0; i < state.rows; i++) {
        state.centerLinesY.push((i + 0.5) * imgH / state.rows);
    }

    autoCalculateCellSize();
}

function autoCalculateCellSize() {
    if (!state.originalImage || state.centerLinesX.length === 0) return;

    let minDistX = Infinity;
    let minDistY = Infinity;

    for (let i = 1; i < state.centerLinesX.length; i++) {
        minDistX = Math.min(minDistX, state.centerLinesX[i] - state.centerLinesX[i-1]);
    }
    for (let i = 1; i < state.centerLinesY.length; i++) {
        minDistY = Math.min(minDistY, state.centerLinesY[i] - state.centerLinesY[i-1]);
    }

    if (state.centerLinesX.length > 0) {
        minDistX = Math.min(minDistX, state.centerLinesX[0] * 2);
        minDistX = Math.min(minDistX, (state.originalImage.width - state.centerLinesX[state.centerLinesX.length-1]) * 2);
    }
    if (state.centerLinesY.length > 0) {
        minDistY = Math.min(minDistY, state.centerLinesY[0] * 2);
        minDistY = Math.min(minDistY, (state.originalImage.height - state.centerLinesY[state.centerLinesY.length-1]) * 2);
    }

    state.cellWidth = Math.floor(minDistX * 0.95);
    state.cellHeight = Math.floor(minDistY * 0.95);

    document.getElementById('cellWidth').value = state.cellWidth;
    document.getElementById('cellHeight').value = state.cellHeight;
}

// ==================== 预览 (使用压缩图) ====================
let previewTimeout = null;
let previewCanvas = null;
let previewCtx = null;

function schedulePreviewUpdate() {
    if (previewTimeout) clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
        generatePreviews();
        updateCellSizeInfo();
    }, 200);
}

function generatePreviews() {
    if (!state.originalImage) return;

    state.croppedImages = [];
    elements.previewGrid.innerHTML = '';

    const cropAreas = getCropAreas();
    const previewCols = Math.min(state.cols, 4);
    elements.previewGrid.style.gridTemplateColumns = `repeat(${previewCols}, 1fr)`;

    const totalCells = state.rows * state.cols;

    // 预览使用小尺寸
    const maxPreviewSize = 100;

    for (let idx = 0; idx < totalCells; idx++) {
        const isDisabled = state.disabledCells.has(idx);
        const area = cropAreas[idx];

        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item' + (isDisabled ? ' disabled' : '');
        previewItem.dataset.index = idx;

        if (!isDisabled) {
            // 计算预览尺寸
            const previewW = Math.min(area.width, maxPreviewSize);
            const previewH = Math.min(area.height, maxPreviewSize);
            const scale = Math.min(previewW / area.width, previewH / area.height);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.floor(area.width * scale);
            tempCanvas.height = Math.floor(area.height * scale);
            const ctx = tempCanvas.getContext('2d');

            // 使用原图裁剪（预览用小图）
            ctx.drawImage(
                state.originalImage,
                area.x, area.y, area.width, area.height,
                0, 0, tempCanvas.width, tempCanvas.height
            );

            const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.6);

            // 保存裁剪区域信息，导出时再用原图
            state.croppedImages.push({
                dataUrl,
                area: area,
                index: idx + 1
            });

            previewItem.innerHTML = `
                <img src="${dataUrl}" alt="预览 ${idx + 1}">
                <span class="index">${idx + 1}</span>
                <div class="preview-menu">
                    <button class="preview-menu-btn" data-action="edit">编辑</button>
                    <button class="preview-menu-btn" data-action="delete">禁用</button>
                </div>
            `;
        } else {
            previewItem.innerHTML = `
                <div class="disabled-mark">已禁用</div>
                <span class="index">${idx + 1}</span>
                <div class="preview-menu">
                    <button class="preview-menu-btn" data-action="restore">恢复</button>
                </div>
            `;
        }

        // 悬浮菜单按钮事件
        previewItem.querySelectorAll('.preview-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'edit') {
                    openCropEditor(idx);
                } else if (action === 'delete') {
                    state.disabledCells.add(idx);
                    scheduleRender();
                    schedulePreviewUpdate();
                } else if (action === 'restore') {
                    state.disabledCells.delete(idx);
                    scheduleRender();
                    schedulePreviewUpdate();
                }
            });
        });

        elements.previewGrid.appendChild(previewItem);
    }

    const enabledCount = totalCells - state.disabledCells.size;
    document.getElementById('previewCount').textContent = enabledCount;
}

function getCropAreas() {
    const areas = [];

    if (state.mode === 'uniform') {
        const cellW = state.originalImage.width / state.cols;
        const cellH = state.originalImage.height / state.rows;

        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                const idx = row * state.cols + col;
                if (state.customAreas && state.customAreas[idx]) {
                    areas.push({ ...state.customAreas[idx] });
                } else {
                    areas.push({
                        x: col * cellW,
                        y: row * cellH,
                        width: cellW,
                        height: cellH
                    });
                }
            }
        }
    } else {
        const halfW = state.cellWidth / 2;
        const halfH = state.cellHeight / 2;

        let idx = 0;
        for (const cy of state.centerLinesY) {
            for (const cx of state.centerLinesX) {
                if (state.customAreas && state.customAreas[idx]) {
                    areas.push({ ...state.customAreas[idx] });
                } else {
                    let x = cx - halfW;
                    let y = cy - halfH;

                    x = Math.max(0, Math.min(state.originalImage.width - state.cellWidth, x));
                    y = Math.max(0, Math.min(state.originalImage.height - state.cellHeight, y));

                    areas.push({ x, y, width: state.cellWidth, height: state.cellHeight });
                }
                idx++;
            }
        }
    }

    return areas;
}

// ==================== 信息显示 ====================
function updateImageInfo(fileName) {
    document.getElementById('fileName').textContent = fileName;
    document.getElementById('imageSize').textContent =
        `${state.originalImage.width} × ${state.originalImage.height} 像素`;
    updateCellSizeInfo();
}

function updateCellSizeInfo() {
    if (!state.originalImage) return;

    const total = state.rows * state.cols;
    const enabled = total - state.disabledCells.size;

    if (state.mode === 'uniform') {
        const cellW = Math.floor(state.originalImage.width / state.cols);
        const cellH = Math.floor(state.originalImage.height / state.rows);
        document.getElementById('cellSize').textContent =
            `${cellW} × ${cellH} 像素 (${enabled}/${total}张)`;
    } else {
        document.getElementById('cellSize').textContent =
            `${state.cellWidth} × ${state.cellHeight} 像素 (${enabled}/${total}张)`;
    }
}

// ==================== 导出 (使用原图) ====================
async function exportAsZip() {
    if (state.croppedImages.length === 0) {
        alert('没有可导出的图片');
        return;
    }

    showProgress('正在生成 ZIP 压缩包...');

    try {
        const zip = new JSZip();
        const format = document.getElementById('exportFormat').value;
        const quality = parseFloat(document.getElementById('quality').value);
        const prefix = document.getElementById('filePrefix').value || 'emoji';

        const mimeType = format === 'jpeg' ? 'image/jpeg' :
                        format === 'webp' ? 'image/webp' : 'image/png';

        for (let i = 0; i < state.croppedImages.length; i++) {
            const item = state.croppedImages[i];
            updateProgress(`正在处理 ${i + 1}/${state.croppedImages.length}...`);

            // 使用原图裁剪
            const canvas = document.createElement('canvas');
            canvas.width = item.area.width;
            canvas.height = item.area.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
                state.originalImage,
                item.area.x, item.area.y, item.area.width, item.area.height,
                0, 0, item.area.width, item.area.height
            );

            const dataUrl = format === 'png' ?
                canvas.toDataURL(mimeType) :
                canvas.toDataURL(mimeType, quality);

            const base64Data = dataUrl.split(',')[1];
            zip.file(`${prefix}_${item.index}.${format}`, base64Data, { base64: true });

            // 让出主线程
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        updateProgress('正在压缩...');
        const content = await zip.generateAsync({ type: 'blob' });

        const link = document.createElement('a');
        link.download = `${prefix}_表情包_${state.croppedImages.length}张.zip`;
        link.href = URL.createObjectURL(content);
        link.click();
        URL.revokeObjectURL(link.href);

        hideProgress();
    } catch (error) {
        hideProgress();
        alert('导出失败: ' + error.message);
    }
}

async function exportSeparately() {
    if (state.croppedImages.length === 0) {
        alert('没有可导出的图片');
        return;
    }

    showProgress('正在准备下载...');

    const format = document.getElementById('exportFormat').value;
    const quality = parseFloat(document.getElementById('quality').value);
    const prefix = document.getElementById('filePrefix').value || 'emoji';

    const mimeType = format === 'jpeg' ? 'image/jpeg' :
                    format === 'webp' ? 'image/webp' : 'image/png';

    for (let i = 0; i < state.croppedImages.length; i++) {
        const item = state.croppedImages[i];
        updateProgress(`正在下载 ${i + 1}/${state.croppedImages.length}...`);

        const canvas = document.createElement('canvas');
        canvas.width = item.area.width;
        canvas.height = item.area.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            state.originalImage,
            item.area.x, item.area.y, item.area.width, item.area.height,
            0, 0, item.area.width, item.area.height
        );

        const dataUrl = format === 'png' ?
            canvas.toDataURL(mimeType) :
            canvas.toDataURL(mimeType, quality);

        const link = document.createElement('a');
        link.download = `${prefix}_${item.index}.${format}`;
        link.href = dataUrl;
        link.click();

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    hideProgress();
}

// ==================== 进度 ====================
function showProgress(text) {
    elements.progressText.textContent = text;
    elements.progressOverlay.classList.remove('hidden');
}

function updateProgress(text) {
    elements.progressText.textContent = text;
}

function hideProgress() {
    elements.progressOverlay.classList.add('hidden');
}

// ==================== 裁剪编辑器 ====================
const cropEditor = {
    modal: null,
    canvas: null,
    ctx: null,
    currentIndex: -1,
    originalArea: null,
    cropArea: null,
    dragging: false,
    resizing: null,
    lastMouse: { x: 0, y: 0 },
    scale: 1,
    imageRegion: { x: 0, y: 0, width: 0, height: 0 }
};

function initCropEditor() {
    cropEditor.modal = document.getElementById('cropModal');
    cropEditor.canvas = document.getElementById('cropCanvas');
    cropEditor.ctx = cropEditor.canvas.getContext('2d');

    document.getElementById('cropModalClose').addEventListener('click', closeCropEditor);
    document.getElementById('cropReset').addEventListener('click', resetCrop);
    document.getElementById('cropCenter').addEventListener('click', centerCrop);
    document.getElementById('cropSave').addEventListener('click', saveCrop);

    cropEditor.modal.addEventListener('click', (e) => {
        if (e.target === cropEditor.modal) closeCropEditor();
    });

    cropEditor.canvas.addEventListener('mousedown', onCropMouseDown);
    cropEditor.canvas.addEventListener('mousemove', onCropMouseMove);
    cropEditor.canvas.addEventListener('mouseup', onCropMouseUp);
    cropEditor.canvas.addEventListener('mouseleave', onCropMouseUp);
}

function openCropEditor(index) {
    if (!state.originalImage || state.disabledCells.has(index)) return;

    const areas = getCropAreas();
    if (index >= areas.length) return;

    cropEditor.currentIndex = index;
    cropEditor.originalArea = { ...areas[index] };
    cropEditor.cropArea = { ...areas[index] };

    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;

    const maxCanvasW = Math.min(800, window.innerWidth * 0.8);
    const maxCanvasH = Math.min(600, window.innerHeight * 0.6);

    cropEditor.scale = Math.min(maxCanvasW / imgW, maxCanvasH / imgH, 1);

    cropEditor.canvas.width = Math.floor(imgW * cropEditor.scale);
    cropEditor.canvas.height = Math.floor(imgH * cropEditor.scale);

    cropEditor.imageRegion = {
        x: 0,
        y: 0,
        width: cropEditor.canvas.width,
        height: cropEditor.canvas.height
    };

    document.getElementById('cropModalIndex').textContent = `#${index + 1}`;
    cropEditor.modal.classList.remove('hidden');

    renderCropEditor();
}

function closeCropEditor() {
    cropEditor.modal.classList.add('hidden');
    cropEditor.currentIndex = -1;
}

function renderCropEditor() {
    const ctx = cropEditor.ctx;
    const canvas = cropEditor.canvas;
    const scale = cropEditor.scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(state.originalImage, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = cropEditor.cropArea.x * scale;
    const cy = cropEditor.cropArea.y * scale;
    const cw = cropEditor.cropArea.width * scale;
    const ch = cropEditor.cropArea.height * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();
    ctx.drawImage(state.originalImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.strokeStyle = '#4f6ef7';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    const handleSize = 8;
    ctx.fillStyle = '#4f6ef7';

    ctx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw - handleSize/2, cy - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx - handleSize/2, cy + ch - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw - handleSize/2, cy + ch - handleSize/2, handleSize, handleSize);

    ctx.fillRect(cx + cw/2 - handleSize/2, cy - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw/2 - handleSize/2, cy + ch - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx - handleSize/2, cy + ch/2 - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw - handleSize/2, cy + ch/2 - handleSize/2, handleSize, handleSize);

    updateCropInfo();
}

function updateCropInfo() {
    const area = cropEditor.cropArea;
    document.getElementById('cropPosition').textContent =
        `${Math.round(area.x)}, ${Math.round(area.y)}`;
    document.getElementById('cropSize').textContent =
        `${Math.round(area.width)} x ${Math.round(area.height)}`;
}

function getCropHandle(x, y) {
    const scale = cropEditor.scale;
    const cx = cropEditor.cropArea.x * scale;
    const cy = cropEditor.cropArea.y * scale;
    const cw = cropEditor.cropArea.width * scale;
    const ch = cropEditor.cropArea.height * scale;
    const threshold = 12;

    const handles = [
        { name: 'nw', x: cx, y: cy },
        { name: 'ne', x: cx + cw, y: cy },
        { name: 'sw', x: cx, y: cy + ch },
        { name: 'se', x: cx + cw, y: cy + ch },
        { name: 'n', x: cx + cw/2, y: cy },
        { name: 's', x: cx + cw/2, y: cy + ch },
        { name: 'w', x: cx, y: cy + ch/2 },
        { name: 'e', x: cx + cw, y: cy + ch/2 }
    ];

    for (const h of handles) {
        if (Math.abs(x - h.x) < threshold && Math.abs(y - h.y) < threshold) {
            return h.name;
        }
    }

    if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
        return 'move';
    }

    return null;
}

function onCropMouseDown(e) {
    const rect = cropEditor.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const handle = getCropHandle(x, y);
    if (handle) {
        if (handle === 'move') {
            cropEditor.dragging = true;
        } else {
            cropEditor.resizing = handle;
        }
        cropEditor.lastMouse = { x, y };
    }
}

function onCropMouseMove(e) {
    const rect = cropEditor.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!cropEditor.dragging && !cropEditor.resizing) {
        const handle = getCropHandle(x, y);
        if (handle === 'move') {
            cropEditor.canvas.style.cursor = 'move';
        } else if (handle === 'nw' || handle === 'se') {
            cropEditor.canvas.style.cursor = 'nwse-resize';
        } else if (handle === 'ne' || handle === 'sw') {
            cropEditor.canvas.style.cursor = 'nesw-resize';
        } else if (handle === 'n' || handle === 's') {
            cropEditor.canvas.style.cursor = 'ns-resize';
        } else if (handle === 'e' || handle === 'w') {
            cropEditor.canvas.style.cursor = 'ew-resize';
        } else {
            cropEditor.canvas.style.cursor = 'default';
        }
        return;
    }

    const dx = (x - cropEditor.lastMouse.x) / cropEditor.scale;
    const dy = (y - cropEditor.lastMouse.y) / cropEditor.scale;
    cropEditor.lastMouse = { x, y };

    const area = cropEditor.cropArea;
    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;

    if (cropEditor.dragging) {
        area.x = Math.max(0, Math.min(imgW - area.width, area.x + dx));
        area.y = Math.max(0, Math.min(imgH - area.height, area.y + dy));
    } else if (cropEditor.resizing) {
        const r = cropEditor.resizing;
        let newX = area.x, newY = area.y, newW = area.width, newH = area.height;

        if (r.includes('w')) {
            newX = Math.max(0, Math.min(area.x + area.width - 20, area.x + dx));
            newW = area.x + area.width - newX;
        }
        if (r.includes('e')) {
            newW = Math.max(20, Math.min(imgW - area.x, area.width + dx));
        }
        if (r.includes('n')) {
            newY = Math.max(0, Math.min(area.y + area.height - 20, area.y + dy));
            newH = area.y + area.height - newY;
        }
        if (r.includes('s')) {
            newH = Math.max(20, Math.min(imgH - area.y, area.height + dy));
        }

        area.x = newX;
        area.y = newY;
        area.width = newW;
        area.height = newH;
    }

    renderCropEditor();
}

function onCropMouseUp() {
    cropEditor.dragging = false;
    cropEditor.resizing = null;
}

function resetCrop() {
    cropEditor.cropArea = { ...cropEditor.originalArea };
    renderCropEditor();
}

function centerCrop() {
    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;
    const area = cropEditor.cropArea;

    area.x = (imgW - area.width) / 2;
    area.y = (imgH - area.height) / 2;

    renderCropEditor();
}

function saveCrop() {
    const index = cropEditor.currentIndex;
    if (index < 0) return;

    const area = cropEditor.cropArea;

    // 单独保存这个单元格的自定义裁剪区域
    if (!state.customAreas) {
        state.customAreas = {};
    }
    state.customAreas[index] = { ...area };

    closeCropEditor();
    scheduleRender();
    schedulePreviewUpdate();
}

// ==================== 启动 ====================
init();
initCropEditor();
