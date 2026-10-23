import {useSyncExternalStore} from "react";
import {subscribeToast, getToastMsg, getToastVisible} from "../engine/core";

/* Screen region 7 of docs/app-plan.md. Always mounted, message and all, even while hidden: the fade is a CSS
   transition on "show" (flow-editor.css), not a mount/unmount, so the old text must stay under it while it
   fades, the same as when toast() wrote the DOM directly. */
export function Notify() {
    const msg = useSyncExternalStore(subscribeToast, getToastMsg);
    const visible = useSyncExternalStore(subscribeToast, getToastVisible);
    return (
        <>
            <div id="toast" className={"toast" + (visible ? ' show' : '')} role="status" aria-live="polite">{msg}</div>
        </>
    )
}