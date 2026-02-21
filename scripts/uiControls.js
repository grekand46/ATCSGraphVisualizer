import { data, hamPaths } from "./data.js";
import { drawGraph, drawPath, clearCanvas, connectTwoNodes } from "./canvas.js";
import { clamp, toTitleCase } from "./util.js";

export const DATA_MODES = Object.freeze({
    STUDENTS: 0,
    GROUPS: 1
});

export function dataModeToString(dataMode) {
    const modeStrs = ["Students", "Groups"];
    return modeStrs[dataMode];
}

export const config = {
    dataMode: DATA_MODES.GROUPS,
    graphEnabled: false,
    pathEnabled: false,
    tooltipsEnabled: false,
}

const IdataMode = document.querySelector("#dataMode");

const IdrawGraph = document.querySelector("#drawGraph");

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
        config.dataMode = config.dataMode == DATA_MODES.STUDENTS ? DATA_MODES.GROUPS : DATA_MODES.STUDENTS;

        // if (config.graphEnabled) IdrawGraph.innerText = "Redraw";
        clearCanvas();
        config.graphEnabled = false;
        IconnectFrom.innerHTML = "<option value=\"Draw First\">Draw First</option>";
        IconnectTo.innerHTML = "<option value=\"Draw First\">Draw First</option>";

        updateTextDependencies();
    });

    IdrawGraph.addEventListener("click", () => {
        config.graphEnabled = true;
        IdrawGraph.innerText = "Redraw";
        drawGraph(data[config.dataMode], true);
        updateConnectDropdowns(data[config.dataMode]);
    });

    IconnectNodes.addEventListener("click", () => {
        const tempTooltip = config.tooltipsEnabled;
        if (tempTooltip) ItoggleTooltips.click();
        disableAllElems("DEPconnect");

        if (config.pathEnabled) {
            clearCanvas();
            if (config.graphEnabled) drawGraph(data[config.dataMode], false);
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
            if (config.graphEnabled) drawGraph(data[config.dataMode], false);
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
            if (config.graphEnabled) drawGraph(data[config.dataMode], false);
        }
        config.pathEnabled = true;
        
        drawPath(data[config.dataMode], hamPaths[config.dataMode], parseInt(IanimateHamPathDelay.value) || 250, () => {
            enableAllElems("DEPanimateHamPath");
            if (tempTooltip) ItoggleTooltips.click();
        });
    });

    IclearHamPath.addEventListener("click", () => {
        clearCanvas();
        if (config.graphEnabled) drawGraph(data[config.dataMode], false);
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
        const option = document.createElement("option");
        option.value = keys[i];
        option.innerText = data[keys[i]].label || toTitleCase(keys[i]);

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

function disableAllElems(className) {
    document.querySelectorAll("." + className).forEach((elem) => elem.setAttribute("disabled", "true"));
}

function enableAllElems(className) {
    document.querySelectorAll("." + className).forEach((elem) => elem.removeAttribute("disabled"));
}

export function hideTooltip() {
    tooltip.style.display = "none";
}

export function getTooltipRect() {
    return tooltip.getBoundingClientRect();
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
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";

    const rect = tooltip.getBoundingClientRect();
    if (centerX) tooltip.style.left = (x - (rect.width / 2)) + "px";
    if (lowerY) tooltip.style.top = (y + rect.height) + "px";
    if (rect.x + rect.width > window.innerWidth) tooltip.style.left = (x - rect.width) + "px";
}