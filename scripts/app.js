import { data } from "./data.js";

import { attachCanvasEventListeners, drawFullGraph, resizeCanvas } from "./canvas.js";
import { attachUIEventListeners, config, handleMouseMove, handleScrollWheel } from "./uiControls.js";

attachUIEventListeners();
attachCanvasEventListeners();

window.addEventListener("resize", () => {
    resizeCanvas();
    if (config.graphEnabled) drawFullGraph(data[config.dataMode], true);
});

document.addEventListener("mousemove", (e) => handleMouseMove(data[config.dataMode], e));
document.addEventListener("wheel", (e) => handleScrollWheel(data[config.dataMode], e), { passive: false });