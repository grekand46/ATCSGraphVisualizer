import { config, updateTooltipText, updateTooltipPos, updateTooltipBorderColor, hideTooltip, getTooltipRect } from "./uiControls.js";
import { toTitleString } from "./util.js";

const canvasWrapper = document.querySelector(".canvas-wrapper");
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");

const drawPositions = [];
const VERTEX_RADIUS = 20;

export function resizeCanvas() {
    const rect = canvasWrapper.getBoundingClientRect();
    // canvas.width = window.innerWidth;
    // canvas.height = (window.innerHeight - 210);
    canvas.width = rect.width - 10;
    canvas.height = rect.height - 10;
}

export function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hideTooltip();
}

export function drawGraph(data, redoVertexPositions) {
    if (window.innerWidth < 900) return;
    
    if (redoVertexPositions == null) redoVertexPositions = false;
    
    resizeCanvas();
    clearCanvas();

    const MAX_DRAW_ATTEMPTS = 100;

    const X_LOWER = VERTEX_RADIUS;
    const X_UPPER = ctx.canvas.width - VERTEX_RADIUS;
    const Y_LOWER = VERTEX_RADIUS;
    const Y_UPPER = ctx.canvas.height - VERTEX_RADIUS;

    // Determine vertex draw locations
    if (redoVertexPositions || drawPositions.length < 1) {
        drawPositions.length = 0;

        for (const k of Object.keys(data)) {
            let x, y;
            let attempts = 0;
            let valid = false;

            while (!valid && attempts < MAX_DRAW_ATTEMPTS) {
                x = Math.random() * (X_UPPER - X_LOWER) + X_LOWER;
                y = Math.random() * (Y_UPPER - Y_LOWER) + Y_LOWER;

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
            data[k].pos = { x, y };
            data[k]["colorH"] = Math.random() * 360;
        }
    }
    
    // Draw edges
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 2;

    const paintedEdges = [];
    for (const k of Object.keys(data)) {
        const v = data[k];

        for (const c of Object.keys(v.connections)) {
            const includes = paintedEdges.filter((item) => item.from == c && item.to == k);
            if (includes.length > 0) continue;

            ctx.beginPath();
            ctx.moveTo(v.pos.x, v.pos.y);
            ctx.lineTo(data[c].pos.x, data[c].pos.y);
            ctx.stroke();

            paintedEdges.push({ from: k, to: c });
        }
    }

    // Draw nodes
    for (const k of Object.keys(data)) {
        const v = data[k];

        ctx.beginPath();
        ctx.fillStyle = `hsl(${v.colorH}, 60%, 48%)`;
        ctx.arc(v.pos.x, v.pos.y, VERTEX_RADIUS, 0, 2 * Math.PI, false);
        ctx.fill();
    }
}

let drawPathBusy = false;
export function drawPath(data, vertices, animateDelay, onComplete) {
    // if (drawPositions.length == 0) return;
    if (drawPathBusy) return;
    if (vertices == null || vertices.length == 0) {
        if (onComplete != null && typeof onComplete == "function") onComplete();
        return;
    }

    // Preliminary check
    for (const v of vertices) {
        if (data[v] == null || data[v].pos.x == null || data[v].pos.y == null) {
            alert("Please draw the graph in this mode first");
            if (onComplete != null && typeof onComplete == "function") onComplete();
            return;
        }
    }

    drawPathBusy = true;
    if (animateDelay == null) animateDelay = 0;

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
            updateTooltipText(vertices[idx]);
            updateTooltipPos(curr.pos.x, curr.pos.y - VERTEX_RADIUS, true, true);
            updateTooltipBorderColor(curr.colorH);
        }

        if (idx == vertices.length - 1) {
            ctx.strokeStyle = "#ffff00";
            ctx.beginPath();
            ctx.moveTo(prev.pos.x, prev.pos.y);
            ctx.lineTo(curr.pos.x, curr.pos.y);
            ctx.stroke();

            if (onComplete != null && typeof onComplete == "function") onComplete();
            hideTooltip();
            drawPathBusy = false;
        }
    }

    ctx.lineWidth = 2;
    for (let i = 1; i < vertices.length; i++) {
        setTimeout(() => { drawEdge(i) }, i * animateDelay);
    }
}

export function connectTwoNodes(data, start, target, onComplete) {
    let fail = false;
    if (!config.graphEnabled) fail = true;
    if (data == null || start == null || target == null) fail = true;

    const keys = Object.keys(data);
    if (keys.length == 0) fail = true;
    if (!keys.includes(start) || !keys.includes(target)) fail = true;

    if (fail) {
        if (onComplete != null && typeof onComplete == "function") onComplete();
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
        if (onComplete != null && typeof onComplete == "function") onComplete();
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

export function updateTooltip(data, event) {
    if (!config.tooltipsEnabled) return true;

    if (!config.graphEnabled) return true;

    const rect = canvas.getBoundingClientRect();

    if (!(event.clientX > rect.x && event.clientX < rect.x + rect.width)) return true;
    if (!(event.clientY > rect.y && event.clientY < rect.y + rect.height)) return true;

    let found = false;
    for (const k of Object.keys(data)) {
        const v = data[k];

        if (Math.abs(v.pos.x - event.clientX) <= VERTEX_RADIUS && Math.abs(v.pos.y - event.clientY) <= VERTEX_RADIUS) {
            updateTooltipText(toTitleString(k));
            updateTooltipPos(event.clientX + 7, event.clientY + 5);
            updateTooltipBorderColor(v.colorH);

            found = true;
            break;
        }
    }

    if (!found) hideTooltip();
}