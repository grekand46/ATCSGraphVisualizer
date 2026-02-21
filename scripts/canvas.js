import { data } from "./data.js";
import { config, updateTooltipText, updateTooltipPos, updateTooltipBorderColor, hideTooltip, GRAPH_ALGOS, renderLoop } from "./uiControls.js";
import { toTitleCase } from "./util.js";

const canvasWrapper = document.querySelector(".canvas-wrapper");
export const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");

const drawPositions = [];
let VERTEX_RADIUS = GRAPH_ALGOS.CARTESIAN;

const camera = {
    scale: 1,
    offsetX: 0,
    offsetY: 0
};

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

let cameraStartX = 0;
let cameraStartY = 0;

const DRAG_THRESHOLD = 5;
let hasMoved = false;

export function attachCanvasEventListeners() {
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    // canvas.addEventListener("mouseleave", onMouseUp);

    canvas.addEventListener("mouseleave", () => {
        isDragging = false;
        hasMoved = false;
        canvas.style.cursor = "default";
    });
}

export function screenTooSmall() {
    return window.innerWidth < 900 || window.innerHeight < 600;
}

export function resizeCanvas() {
    renderLoop.cancel();

    canvas.width = 0;
    canvas.height = 0;

    const rect = canvasWrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

export function clearCanvas() {
    renderLoop.cancel();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function screenToWorld(x, y) {
    return {
        x: (x - camera.offsetX) / camera.scale,
        y: (y - camera.offsetY) / camera.scale
    };
}

export function zoomAt(screenX, screenY, factor) {
    const prevScale = camera.scale;
    const newScale = prevScale * factor;

    camera.offsetX = screenX - (screenX - camera.offsetX) * (newScale / prevScale);
    camera.offsetY = screenY - (screenY - camera.offsetY) * (newScale / prevScale);

    camera.scale = newScale;
}

export function resetZoom() {
    camera.scale = 1;
    camera.offsetX = 0;
    camera.offsetY = 0;
}

function onMouseDown(event) {
    if (!config.graphEnabled || drawPathBusy) return;

    if (event.button != 0) return; // only let left clicks through

    isDragging = true;
    hasMoved = false;

    dragStartX = event.clientX;
    dragStartY = event.clientY;

    cameraStartX = camera.offsetX;
    cameraStartY = camera.offsetY;

    canvas.style.cursor = "grab";
}

function onMouseMove(event) {
    if (!config.graphEnabled || drawPathBusy) return;

    if (isDragging) {
        lastHighlighted = null;
        
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;

        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            hasMoved = true;
        }

        if (hasMoved) {
            camera.offsetX = cameraStartX + dx;
            camera.offsetY = cameraStartY + dy;

            drawFullGraph(data[config.dataMode], false);
        }
    }

    updateCursor(event);
}

function onMouseUp(event) {
    if (!config.graphEnabled || drawPathBusy) return;

    if (!isDragging) return;

    isDragging = false;

    if (!hasMoved) handleGraphClick(event);

    hasMoved = false;
    updateCursor(event);
}

let lastHighlighted = null;
function handleGraphClick(event) {
    if (!config.graphEnabled || drawPathBusy) return;

    const dataLocal = data[config.dataMode];

    const closestNode = getClosestNodeToMouse(dataLocal, event);

    if (closestNode == null || dataLocal[closestNode] == null) return true;

    if (lastHighlighted == closestNode) {
        lastHighlighted = null;
        drawFullGraph(dataLocal, false);
        return false;
    }

    lastHighlighted = closestNode;

    highlistNodeFirstDegree(dataLocal, closestNode);
}

function updateCursor(event) {
    if (!config.graphEnabled || drawPathBusy) {
        canvas.style.cursor = "default";
        return;
    }

    if (isDragging && hasMoved) {
        canvas.style.cursor = "grabbing";
        return;
    }

    if (isDragging && !hasMoved) {
        canvas.style.cursor = "grab";
        return;
    }

    const node = getClosestNodeToMouse(data[config.dataMode], event);
    canvas.style.cursor = node ? "pointer" : "grab";
}

export function handleAlgoChange(graphAlgo) {
    VERTEX_RADIUS = graphAlgo;
}

export function drawFullGraph(data, redoVertexPositions = false) {
    if (screenTooSmall()) return;
    
    // resizeCanvas();
    clearCanvas();
    
    ctx.setTransform(
        camera.scale,
        0,
        0,
        camera.scale,
        camera.offsetX,
        camera.offsetY
    );

    const X_LOWER = VERTEX_RADIUS;
    const X_UPPER = ctx.canvas.width - VERTEX_RADIUS;
    const Y_LOWER = VERTEX_RADIUS;
    const Y_UPPER = ctx.canvas.height - VERTEX_RADIUS;
    
    // Determine vertex draw locations
    if (redoVertexPositions || drawPositions.length == 0) {
        drawPositions.length = 0;
        
        const sortedKeys = Object.keys(data).sort((a, b) => {
            return Object.keys(data[b].connections).length - Object.keys(data[a].connections).length;
        });
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY) - VERTEX_RADIUS;
        
        const degrees = Object.keys(data).map(k => Object.keys(data[k].connections).length);
        const maxDegree = Math.max(...degrees, 1);
        
        for (const k of sortedKeys) {
            let x, y;
            let attempts = 0;
            let valid = false;
            
            const degree = Object.keys(data[k].connections).length;
            const normDegree = degree / maxDegree;
            const bias = 1 - normDegree;
            
            const MAX_DRAW_ATTEMPTS = config.graphAlgo == GRAPH_ALGOS.CARTESIAN ? 100 : (50 + 150 * normDegree);

            data[k]["pos"] = { x: null, y: null };

            while (!valid && attempts < MAX_DRAW_ATTEMPTS) {
                const angle = Math.random() * 2 * Math.PI;
                const r = bias * maxRadius * (0.6 + 0.4 * Math.random());

                if (config.graphAlgo == GRAPH_ALGOS.CARTESIAN) {
                    x = Math.random() * (X_UPPER - X_LOWER) + X_LOWER;
                    y = Math.random() * (Y_UPPER - Y_LOWER) + Y_LOWER;
                } else if (config.graphAlgo == GRAPH_ALGOS.RADIAL) {
                    x = centerX + r * Math.cos(angle);
                    y = centerY + r * Math.sin(angle);
                }

                valid = true;

                for (const p of drawPositions) {
                    const dx = x - p.x;
                    const dy = y - p.y;
                    
                    if ((dx ** 2) + (dy ** 2) < (VERTEX_RADIUS * 2) ** 2) {
                        valid = false;
                        break;
                    }
                }

                attempts++;
            }

            if (!valid) continue;

            drawPositions.push({ x, y });
            data[k]["pos"] = { x, y };
            data[k]["colorH"] = Math.random() * 360;
        }
    }

    // Draw edges
    drawEdges(data, data);

    // Draw nodes
    drawNodes(data, false);
}

export function highlistNodeFirstDegree(data, k) {
    if (k == null || data[k] == null) return;
    
    clearCanvas();

    ctx.setTransform(
        camera.scale,
        0,
        0,
        camera.scale,
        camera.offsetX,
        camera.offsetY
    );
    
    drawEdges(data, { [k]: data[k] });

    const nodesToDraw = { k: data[k] };
    for (const c of Object.keys(data[k].connections)) {
        nodesToDraw[c] = data[c];
    }

    drawNodes(nodesToDraw, true);
}

function drawEdges(lookupData, drawData) {
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 2;

    const paintedEdges = [];
    for (const k of Object.keys(drawData)) {
        const v = drawData[k];

        for (const c of Object.keys(v.connections)) {
            const includes = paintedEdges.filter((item) => item.from == c && item.to == k);
            if (includes.length > 0) continue;

            ctx.beginPath();
            ctx.moveTo(v.pos.x, v.pos.y);
            ctx.lineTo(lookupData[c].pos.x, lookupData[c].pos.y);
            ctx.stroke();

            paintedEdges.push({ from: k, to: c });
        }
    }
}

function drawNodes(drawData, emphasizeFirst = false) {
    const keys = Object.keys(drawData);

    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = drawData[k];

        ctx.beginPath();
        ctx.fillStyle = `hsl(${v.colorH}, 60%, 48%)`;
        ctx.arc(v.pos.x, v.pos.y, VERTEX_RADIUS, 0, 2 * Math.PI, false);
        ctx.fill();

        if (i == 0 && emphasizeFirst) {
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }
    }
}

export let drawPathBusy = false;
export function drawPath(data, vertices, animateDelay = 0, onComplete = () => {}) {
    // if (drawPositions.length == 0) return;
    if (drawPathBusy) return;
    if (vertices == null || vertices.length == 0) {
        onComplete();
        return;
    }

    // Preliminary check
    for (const v of vertices) {
        if (data[v] == null || data[v]["pos"] == null || data[v].pos.x == null || data[v].pos.y == null) {
            // alert("Please draw the graph in this mode first");
            onComplete();
            return;
        }
    }

    drawPathBusy = true;

    clearCanvas();

    ctx.setTransform(
        camera.scale,
        0,
        0,
        camera.scale,
        camera.offsetX,
        camera.offsetY
    );

    drawEdges(data, data);
    drawNodes(data, false);

    function drawEdge(idx) {
        const prevPrev = idx >= 2 ? data[vertices[idx - 2]].pos : null;
        const prev = data[vertices[idx - 1]];
        const curr = data[vertices[idx]];

        if (prevPrev != null) {
            ctx.strokeStyle = "#ffff00";
            ctx.beginPath();
            ctx.moveTo(prevPrev.x, prevPrev.y);
            ctx.lineTo(prev.pos.x, prev.pos.y);
            ctx.stroke();
        }

        ctx.strokeStyle = "#ff0000";
        ctx.beginPath();
        ctx.moveTo(prev.pos.x, prev.pos.y);
        ctx.lineTo(curr.pos.x, curr.pos.y);
        ctx.stroke();

        if (animateDelay > 0) {
            const screenX = curr.pos.x * camera.scale + camera.offsetX;
            const screenY = (curr.pos.y - VERTEX_RADIUS) * camera.scale + camera.offsetY;
            updateTooltipPos(screenX, screenY, true, true);

            updateTooltipText(data[vertices[idx]].label || toTitleCase(vertices[idx]));
            updateTooltipBorderColor(curr.colorH);
        }

        if (idx == vertices.length - 1) {
            ctx.strokeStyle = "#ffff00";
            ctx.beginPath();
            ctx.moveTo(prev.pos.x, prev.pos.y);
            ctx.lineTo(curr.pos.x, curr.pos.y);
            ctx.stroke();

            onComplete();
            hideTooltip();
            drawPathBusy = false;
        }
    }

    ctx.lineWidth = 2;
    for (let i = 1; i < vertices.length; i++) {
        setTimeout(() => drawEdge(i), i > 1 ? (i - 1) * animateDelay : Math.min(animateDelay, 150));
    }
}

export function connectTwoNodes(data, start, target, onComplete = () => {}) {
    let fail = false;
    if (!config.graphEnabled) fail = true;
    if (data == null || start == null || target == null) fail = true;
    if (start == target) fail = true;

    const keys = Object.keys(data);
    if (keys.length == 0) fail = true;
    if (!keys.includes(start) || !keys.includes(target)) fail = true;

    if (fail) {
        onComplete();
        return;
    }

    const queue = [start];
    const visited = new Set([start]);
    const parent = {};

    while (queue.length > 0) {
        const curr = queue.shift();

        if (curr == target) break;

        for (const neighbor of Object.keys(data[curr].connections)) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            parent[neighbor] = curr;
            queue.push(neighbor);
        }
    }

    if (!visited.has(target)) {
        onComplete();
        return;
    }

    const path = [];
    let curr = target;

    while (curr != null) {
        path.unshift(curr);
        curr = parent[curr];
    }
    
    drawPath(data, path, 750, onComplete);
}

export function getClosestNodeToMouse(data, event) {
    if (!config.graphEnabled) return null;

    const rect = canvas.getBoundingClientRect();
    if (!(event.clientX > rect.x && event.clientX < rect.x + rect.width)) return null;
    if (!(event.clientY > rect.y && event.clientY < rect.y + rect.height)) return null;

    let found = null;
    for (const k of Object.keys(data)) {
        const v = data[k];

        const world = screenToWorld(event.clientX - rect.x, event.clientY - rect.y);

        const dx = v.pos.x - world.x;
        const dy = v.pos.y - world.y;

        if (dx * dx + dy * dy <= VERTEX_RADIUS * VERTEX_RADIUS) {
            found = k;
            break;
        }
    }

    return found;
}