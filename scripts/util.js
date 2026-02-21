export function toTitleCase(str) {
    if (str == null || str.trim() == "") return str;

    const arr = str.split(" ");
    let ret = "";

    for (const s of arr) {
        ret += s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase() + " ";
    }

    return ret;
}

export function clamp(min, x, max) {
    return Math.min(max, Math.max(x, min));
}