import {useSyncExternalStore} from "react";
import {subscribe, getVersion} from "../engine/store";
import {S} from "../engine/core";
import {PageProps} from "./PageProps";
import {MultiProps} from "./MultiProps";
import {ShapeProps} from "./ShapeProps";

/* Screen 1.5 of docs/app-plan.md: the page when nothing is selected, otherwise the selection. Dispatches to
   whichever of PageProps/MultiProps/ShapeProps owns that state; #propsEmpty/#propsShape's hidden toggle is
   the one thing every one of those states shares, so it stays here.

   Subscribes to the version counter, not S.sel/S.selection directly: a rebuild reassigns every shape's raw
   ID, so S.sel can read the same string before and after an edit to the very shape it names, even though
   S.elById[S.sel] now points at a different (freshly rebuilt) Element. Reading S.sel/S.elById off a narrower
   useSyncExternalStore snapshot would then bail out of rendering and hand ShapeProps/ConnectionProps a
   stale, detached element - whatever they commit against it would never reach S.text. */
export function Props() {
    useSyncExternalStore(subscribe, getVersion);
    const sel = S.sel, count = S.selection.size;
    const el = sel ? S.elById[sel] : null;

    return (
        <aside className="props" id="props" aria-label="Properties">
            <div id="propsEmpty" hidden={!!el}>
                {!el && <PageProps/>}
            </div>
            <div id="propsShape" hidden={!el}>
                {/* keyed by sel: resets the uncontrolled colour inputs (pFill, pLine, ...) when the
                    selection switches to a different shape, without remounting - and so losing
                    in-progress drafts in other fields - on an ordinary edit to the same one */}
                {el && (count > 1 ? <MultiProps key={sel}/> : <ShapeProps key={sel} el={el}/>)}
            </div>
        </aside>
    );
}
