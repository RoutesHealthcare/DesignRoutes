import {useSyncExternalStore} from "react";
import {subscribe} from "../engine/store";
import {TP, setPane} from "../engine/text-pane";

/* Screen region 11 of docs/app-plan.md: brings the pane back when it's hidden. hidden mirrors TP.open directly
   (setPane() notify()s on every change, from here, Ctrl+E and the pane's own Pin/Close), so this stays in sync
   with whichever of those last opened or closed it. */
export function ShowDiagram() {
    useSyncExternalStore(subscribe, () => TP.open);
    return (
        <>
            <button id="textTab" className="texttab" title="Show the diagram text (Ctrl+E)" hidden={TP.open}
                    onClick={() => setPane(true, TP.pinned)}>Text</button>
        </>
    )
}