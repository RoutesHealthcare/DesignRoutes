import {useSyncExternalStore} from "react";
import {S} from "../engine/core";
import {subscribe} from "../engine/store";
import {backStep, exitPresent, goTo, nextStep} from "../engine/present";

const NONE: string[] = [];

/* The controls along the bottom while presenting: back, the step shown (pick one to jump to it), next and exit.
   Faint until the pointer is over them, so they stay out of the way of the drawing. */
export function PresentBar() {
    const at = useSyncExternalStore(subscribe, () => S.present ? S.present.at : -1);
    const labels = useSyncExternalStore(subscribe, () => S.present ? S.present.labels : NONE);
    if (at < 0) return null;
    return (
        <div className="present-bar" id="presentBar" role="toolbar" aria-label="Presenting">
            <button id="presentBack" onClick={backStep} disabled={at === 0} title="Back (←)">‹ Back</button>
            <select id="presentStep" value={at} aria-label="Step" onChange={e => goTo(+e.target.value)}>
                {labels.map((l, i) => <option key={i} value={i}>{l}</option>)}
            </select>
            <span className="present-count" id="presentCount">{at} / {labels.length - 1}</span>
            <button id="presentNext" onClick={nextStep} disabled={at === labels.length - 1}
                    title="Next (→, space or a click)">Next ›
            </button>
            <button id="presentExit" onClick={exitPresent} title="Stop presenting (Esc)">Exit</button>
        </div>
    );
}
