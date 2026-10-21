import type {DragEvent} from "react";
import {S} from "../engine/core.js";
import {toPage} from "../engine/pointer";
import {openAny} from "../engine/visio-io";
import {addPicture, isPicture} from "../engine/images";
import {
    PATTERN_DRAG,
    SHAPE_DRAG,
    getDraggedPattern,
    getDraggedShape,
    placePattern,
    placeShape,
    setTool
} from "../engine/palette";
import {isShapeKind} from "../shapes";

/* Four things can be dropped on the page: a shape or a pattern dragged from the palette, a picture file, which
   becomes an image shape showing it, or any other file, which is opened (a Visio drawing is imported, so nothing is
   lost) */
async function drop(e: DragEvent) {
    e.preventDefault();
    if (S.present) return;   // a step of the animation is on the page: nothing edits it
    const kind = getDraggedShape() ?? e.dataTransfer.getData(SHAPE_DRAG), file = e.dataTransfer.files[0], p = toPage(e);
    if (isShapeKind(kind)) { placeShape(kind, p.x, p.y); return; }
    const pattern = getDraggedPattern() ?? e.dataTransfer.getData(PATTERN_DRAG);
    if (pattern) {
        placePattern(pattern, p.x, p.y);
        return;
    }
    if (isPicture(file)) { setTool("select"); await addPicture(file, p.x, p.y); return; }
    if (!file) return;
    if (S.dirty && !/\.vsd[xm]$/i.test(file.name) && !confirm("Discard unsaved changes and open " + file.name + "?")) return;
    await openAny(file, null);
}

/* The page and everything drawn on it. The canvas inside is drawn by render.ts, and pointer.ts handles the mouse
   on it and toggles classes on the stage (over-shape, panning, ...), so React draws this once and leaves it be. */
export function Stage() {
    return (
        <section className="stage" id="stage"
                 onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                 onDrop={drop}>
            <svg id="canvas" className="canvas">
                <defs>
                    <pattern id="grid" width="37.795" height="37.795" patternUnits="userSpaceOnUse">
                        <path className="grid-line" d="M37.795 0H0V37.795"/>
                    </pattern>
                </defs>
                <g id="view">
                    <rect id="pageBg" className="page-bg"/>
                    <rect id="paper" className="paper"/>
                    <rect id="gridRect" fill="url(#grid)" pointerEvents="none"/>
                    <g id="layer"></g>
                    <g id="overlay" className="overlay"></g>
                </g>
            </svg>
            <textarea id="textEditor" className="text-editor" hidden aria-label="Shape text"></textarea>
        </section>
    );
}
