import fs from "fs";
import ejs from "ejs";

export function render (template, data) {
    const file = fs.readFileSync(`views/${template}`, "utf8");
    const compiled = ejs.compile(file);
    return compiled(data);
}
