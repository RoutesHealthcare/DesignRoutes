import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {subscribe, getVersion} from "../engine/store";
import {S} from "../engine/core";
import {switchPage} from "../engine/document";
import {addPage, renamePage, requestDeletePage} from "../engine/visio-io";

/* Screen region 6 of docs/app-plan.md: one tab per page, each with its own close button, and + to add one.
   The last page can't be deleted (also enforced, with the same message, by the Page panel's own Delete button -
   see requestDeletePage), so its close button is disabled rather than hidden, matching #pDeletePage there.
   Overspill (more tabs than fit) just scrolls: .tabs has overflow-x: auto in flow-editor.css.

   Double-clicking a tab's name renames it in place - the same renamePage() the Page panel's Name field uses, so
   a mid-type draft here and there can't clobber each other. Plain local state, not useDraft/useCommittedField
   (PropsFields.tsx): those model an always-mounted field showing a live value, but this one only exists for the
   tab being renamed and is gone (committed or cancelled) by the time anything else could read it. */
export function PageTabs() {
    useSyncExternalStore(subscribe, getVersion);
    const [editing, setEditing] = useState<{ i: number, v: string } | null>(null);
    const editRef = useRef<HTMLInputElement | null>(null);

    // Only on entering edit mode (or switching which tab is being renamed) - not on every keystroke, which an
    // inline ref callback here would do (a new closure each render, so React re-fires it after every change and
    // re-selects the text, clobbering everything but the one character just typed).
    useEffect(() => {
        if (editing == null) return;
        editRef.current?.focus();
        editRef.current?.select();
    }, [editing?.i]);

    function commitRename() {
        if (!editing) return;
        const v = editing.v.trim();
        if (v) renamePage(editing.i, v);
        setEditing(null);
    }

    return (
        <nav className="tabs" id="tabs" aria-label="Pages">
            {S.pages.map((p, i) => {
                const name = p.name + (p.bg ? ' (background)' : '');
                return (
                    <span className="tab" key={i}>
                        {editing?.i === i ? (
                            <input className="tab-name-edit" aria-label="Page name" value={editing.v}
                                   ref={editRef}
                                   onChange={e => setEditing({i, v: e.target.value})}
                                   onBlur={commitRename}
                                   onClick={e => e.stopPropagation()}
                                   onKeyDown={e => {
                                       if (e.key === 'Enter') {
                                           e.preventDefault();
                                           commitRename();
                                       } else if (e.key === 'Escape') {
                                           e.preventDefault();
                                           setEditing(null);
                                       }
                                   }}/>
                        ) : (
                            <button aria-selected={i === S.pi} title={name} onClick={() => switchPage(i)}
                                    onDoubleClick={() => setEditing({i, v: p.name})}>
                                {name}
                            </button>
                        )}
                        <button className="tab-close" aria-label={`Delete page "${p.name}"`}
                                title={`Delete "${p.name}"`} disabled={S.pages.length <= 1}
                                onClick={e => {
                                    e.stopPropagation();
                                    requestDeletePage(i);
                                }}>&times;</button>
                    </span>
                );
            })}
            <button aria-label="Add a page" title="Add a page" onClick={addPage}>+</button>
        </nav>
    )
}