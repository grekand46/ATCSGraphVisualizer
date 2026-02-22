import { data, hamPaths } from "./data.js";
import { drawFullGraph, drawPath, clearCanvas, connectTwoNodes, handleAlgoChange, getClosestNodeToMouse, resetZoom, zoomAt, canvas, drawPathBusy, handleDataModeChange } from "./canvas.js";
import { clamp, toTitleCase } from "./util.js";

export const DATA_MODES = Object.freeze({
    STUDENTS: 0,
    GROUPS: 1
});

export const GRAPH_ALGOS = Object.freeze({
    CARTESIAN: 15,
    RADIAL: 11
});

export function dataModeToString(dataMode) {
    const modeStrs = ["Students", "Groups"];
    return modeStrs[dataMode];
}

export const config = {
    dataMode: DATA_MODES.GROUPS,
    graphAlgo: GRAPH_ALGOS.CARTESIAN,
    graphEnabled: false,
    pathEnabled: false,
    tooltipsEnabled: false,
}

export const renderLoop = {
    active: false,
    enabled: true,
    animationId: null,

    frame(data) {
        if (!this.enabled) return;

        this.active = true;
        drawFullGraph(data, false);
        
        if (this.enabled) this.animationId = window.requestAnimationFrame(() => this.frame(data));
    },

    cancel() {
        if (this.animationId == null) return;
        this.active = false;
        this.enabled = false;
        window.cancelAnimationFrame(this.animationId);
    },

    start(data) {
        if (!this.active) {
            this.enabled = true;
            this.frame(data);
        }
    },
};

const IdataMode = document.querySelector("#dataMode");
const IgraphAlgo = document.querySelector("#graphAlgo");
const IdrawGraph = document.querySelector("#drawGraph");

const IresetGraphZoom = document.querySelector("#graphZoomReset");
const IzoomGraphIn = document.querySelector("#graphZoomIn");
const IzoomGraphOut = document.querySelector("#graphZoomOut");

const IconnectFrom = document.querySelector("#connectFrom");
const IconnectTo = document.querySelector("#connectTo");
const IconnectNodes = document.querySelector("#runConnect");

const IdrawHamPath = document.querySelector("#drawHamPath");
const IanimateHamPath = document.querySelector("#animateHamPath");
const IclearHamPath = document.querySelector("#clearHamPath");
const IanimateHamPathDelay = document.querySelector("#animateHamPathDelay");

const ItoggleTooltips = document.querySelector("#toggleTooltips");
const tooltip = document.querySelector(".tooltip");

updateTextDependencies();

export function attachUIEventListeners() {
    IdataMode.addEventListener("change", () => {
        config.dataMode = IdataMode.value == "0" ? DATA_MODES.STUDENTS : DATA_MODES.GROUPS;
        handleDataModeChange();

        clearCanvas();
        config.graphEnabled = false;
        
        IconnectFrom.innerHTML = "<option value=\"Draw First\">Draw First</option>";
        IconnectTo.innerHTML = "<option value=\"Draw First\">Draw First</option>";

        updateTextDependencies();
    });

    IgraphAlgo.addEventListener("change", () => {
        config.graphAlgo = IgraphAlgo.value == "0" ? GRAPH_ALGOS.CARTESIAN : GRAPH_ALGOS.RADIAL;
        handleAlgoChange(config.graphAlgo);

        clearCanvas();
        config.graphEnabled = false;
        
        IconnectFrom.innerHTML = "<option value=\"Draw First\">Draw First</option>";
        IconnectTo.innerHTML = "<option value=\"Draw First\">Draw First</option>";

        updateTextDependencies();
    });

    IdrawGraph.addEventListener("click", () => {
        config.graphEnabled = true;
        IdrawGraph.innerText = "Redraw";
        // drawFullGraph(data[config.dataMode], true);
        updateConnectDropdowns(data[config.dataMode]);
        renderLoop.start(data[config.dataMode]);
    });

    IresetGraphZoom.addEventListener("click", () => {
        if (!config.graphEnabled) return;

        resetZoom();
        drawFullGraph(data[config.dataMode], false);
    });

    IzoomGraphIn.addEventListener("click", () => {
        if (!config.graphEnabled) return;
        
        zoomAt(canvas.width / 2, canvas.height / 2, 1.2)
        drawFullGraph(data[config.dataMode], false);
    });

    IzoomGraphOut.addEventListener("click", () => {
        if (!config.graphEnabled) return;
        
        zoomAt(canvas.width / 2, canvas.height / 2, 1 / 1.2);
        drawFullGraph(data[config.dataMode], false);
    });

    IconnectNodes.addEventListener("click", () => {
        const tempTooltip = config.tooltipsEnabled;
        if (tempTooltip) ItoggleTooltips.click();
        disableAllElems("DEPconnect");

        if (config.pathEnabled) {
            clearCanvas();
            if (config.graphEnabled) drawFullGraph(data[config.dataMode], false);
        }
        config.pathEnabled = true;
        
        connectTwoNodes(data[config.dataMode], IconnectFrom.value, IconnectTo.value, () => {
            enableAllElems("DEPconnect");
            if (tempTooltip) ItoggleTooltips.click();
        });
    });

    IdrawHamPath.addEventListener("click", () => {
        if (config.pathEnabled) {
            clearCanvas();
            if (config.graphEnabled) drawFullGraph(data[config.dataMode], false);
        }
        config.pathEnabled = true;
        drawPath(data[config.dataMode], hamPaths[config.dataMode]);
    });

    IanimateHamPath.addEventListener("click", () => {
        const tempTooltip = config.tooltipsEnabled;
        if (tempTooltip) ItoggleTooltips.click();
        disableAllElems("DEPanimateHamPath");

        if (config.pathEnabled) {
            clearCanvas();
            if (config.graphEnabled) drawFullGraph(data[config.dataMode], false);
        }
        config.pathEnabled = true;
        
        drawPath(data[config.dataMode], hamPaths[config.dataMode], parseInt(IanimateHamPathDelay.value) || 250, () => {
            enableAllElems("DEPanimateHamPath");
            if (tempTooltip) ItoggleTooltips.click();
        });
    });

    IclearHamPath.addEventListener("click", () => {
        clearCanvas();
        if (config.graphEnabled) drawFullGraph(data[config.dataMode], false);
        config.pathEnabled = false;
    });

    IanimateHamPathDelay.addEventListener("change", () => {
        IanimateHamPathDelay.value = clamp(100, parseInt(IanimateHamPathDelay.value) || 250, 2000);
    });

    ItoggleTooltips.addEventListener("click", () => {
        hideTooltip();
        config.tooltipsEnabled = !config.tooltipsEnabled;
        
        const map = { "Enable": "Disable", "Disable": "Enable" };
        ItoggleTooltips.innerText = map[ItoggleTooltips.innerText || "Error"];
    });
}

function updateConnectDropdowns(data) {
    IconnectFrom.innerHTML = "";
    IconnectTo.innerHTML = "";

    const keys = Object.keys(data).sort();

    for (let i = 0; i < keys.length; i++) {
        const text = data[keys[i]].label || toTitleCase(keys[i]);
        const truncText = text.length > 19 ? text.substring(0, 19) + "..." : text;

        const option = document.createElement("option");
        option.value = keys[i];
        option.title = text;
        option.innerText = truncText;

        IconnectFrom.appendChild(option.cloneNode(true));

        if (i == 1) option.setAttribute("selected", "true");
        IconnectTo.appendChild(option.cloneNode(true));
    }
}

function updateTextDependencies() {
    document.querySelectorAll(".DEPdataMode").forEach((elem) => {
        elem.innerText = "Data Mode: " + dataModeToString(config.dataMode);
    });
}

export function handleMouseMove(data, event) {
    if (!config.tooltipsEnabled) return;

    const closestNode = getClosestNodeToMouse(data, event);

    if (closestNode == null || data[closestNode] == null) {
        hideTooltip();
        return true;
    }
    
    const v = data[closestNode];

    tooltip.style.display = "block";
    updateTooltipText(v.label || toTitleCase(closestNode));
    updateTooltipBorderColor(v.colorH);
    updateTooltipPos(event.clientX + 7, event.clientY + 5);
}

export function handleScrollWheel(data, event) {
    event.preventDefault();

    if (!config.graphEnabled || drawPathBusy) return;

    const rect = canvas.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const zoomIntensity = 0.0015;
    const factor = 1 - event.deltaY * zoomIntensity;

    zoomAt(mouseX, mouseY, factor);

    renderLoop.start(data);
}

function disableAllElems(className) {
    document.querySelectorAll("." + className).forEach((elem) => elem.setAttribute("disabled", "true"));
}

function enableAllElems(className) {
    document.querySelectorAll("." + className).forEach((elem) => elem.removeAttribute("disabled"));
}

export function hideTooltip() {
    tooltip.style.display = "none";
}

export function updateTooltipBorderColor(h) {
    tooltip.style.borderColor = `hsl(${h}, 60%, 68%)`;
}

export function updateTooltipText(str) {
    tooltip.style.display = "block";
    tooltip.children[0].innerText = str;
}

export function updateTooltipPos(x, y, centerX = false, lowerY = false) {
    tooltip.style.display = "block";
    // tooltip.style.left = "0px";
    // tooltip.style.top = "0px";

    tooltip.style.transform = "translate(0, 0)";

    const rect = tooltip.getBoundingClientRect();
    const SPACING = 8;

    let finalX = x;
    let finalY;

    // Horizontal centering
    if (centerX) finalX = x - (rect.width / 2);

    // Clamp horizontal
    if (finalX + rect.width > window.innerWidth) finalX = window.innerWidth - rect.width - SPACING;
    if (finalX < SPACING) finalX = SPACING;

    // Vertical placing
    if (lowerY) finalY = y + SPACING; // small spacing below anchor
    else finalY = y - rect.height - SPACING; // above anchor

    // Clamp vertical
    if (finalY + rect.height > window.innerHeight) finalY = window.innerHeight - rect.height - SPACING;
    if (finalY < SPACING) finalY = SPACING;

    // tooltip.style.left = `${finalX}px`;
    // tooltip.style.top = `${finalY}px`;
    tooltip.style.transform = `translate(${finalX}px, ${finalY}px)`;
}
