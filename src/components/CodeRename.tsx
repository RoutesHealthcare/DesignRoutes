import {type RefObject, useEffect, useRef, useState} from "react";
import {flowUpToDate, idAt, renamedOffset, spotOf, type IdAt} from "../engine/text-rename";
import {renameShape} from "../engine/rename";
import {S} from "../engine/core";

/* Rename in the text pane. Right-click a shape's id (where it's declared, either end of a connection or an [in=])
   for a menu with Rename, or put the caret on it and press F2. A box over the id takes the new one: Enter renames
   the shape throughout its page, Escape or clicking away leaves it as it was. Right-click anywhere else is the
   browser's own menu, so copy and paste are where they always are. */
export function CodeRename({code}: { code: RefObject<HTMLTextAreaElement | null> }) {
    const [menu, setMenu] = useState<{ t: IdAt, top: number, left: number } | null>(null);
    const [renaming, setRenaming] = useState<IdAt | null>(null);

    useEffect(() => {
        const ta = code.current;
        if (!ta) return;
        const here = () => flowUpToDate(ta) ? idAt(ta.value, ta.selectionStart) : null;
        const onMenu = (e: MouseEvent) => {
            setRenaming(null);
            const t = here();
            if (!t) return;   // not an id: the browser's own menu
            e.preventDefault();
            const r = ta.getBoundingClientRect();
            setMenu({t, top: e.clientY - r.top, left: Math.min(e.clientX - r.left, r.width - 230)});
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenu(null);
            if (e.key !== 'F2' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
            e.preventDefault();
            const t = here();
            if (t) setRenaming(t);
        };
        const close = () => setMenu(null);
        const scrolled = () => {
            setMenu(null);
            setRenaming(null);
        };
        ta.addEventListener('contextmenu', onMenu);
        ta.addEventListener('keydown', onKey);
        ta.addEventListener('mousedown', close);
        ta.addEventListener('blur', close);
        ta.addEventListener('scroll', scrolled);
        return () => {
            ta.removeEventListener('contextmenu', onMenu);
            ta.removeEventListener('keydown', onKey);
            ta.removeEventListener('mousedown', close);
            ta.removeEventListener('blur', close);
            ta.removeEventListener('scroll', scrolled);
        };
    }, [code]);

    /* Back to the text with the caret at the id, after renaming it or not. A rename can change the text's length
       before the id (an earlier occurrence of the same id, now a different length), so t.start no longer points at
       it; renamedOffset finds where it ended up instead. */
    const done = (t: IdAt, before?: string, to?: string) => {
        setRenaming(null);
        const ta = code.current;
        if (!ta) return;
        ta.focus();
        const at = before != null && to != null ? renamedOffset(before, ta.value, t.start, to) : t.start;
        ta.setSelectionRange(at, at);
    };

    return (
        <>
            {menu && (
                <ul id="codeMenu" className="suggest code-menu" role="menu" aria-label="Text actions"
                    style={{top: menu.top, left: menu.left}}>
                    <li role="menuitem" aria-selected="true" onMouseDown={e => {
                        e.preventDefault();   // the box takes the focus, not the menu
                        setMenu(null);
                        setRenaming(menu.t);
                    }}>
                        <span className="sg-label">Rename "{menu.t.id}"…</span><span className="sg-detail">F2</span>
                    </li>
                </ul>
            )}
            {renaming && code.current &&
                <RenameBox key={renaming.start} t={renaming} at={spotOf(code.current, renaming.start)}
                           onDone={(before, to) => done(renaming, before, to)} onCancel={() => setRenaming(null)}/>}
        </>
    );
}

function RenameBox({t, at, onDone, onCancel}: {
    t: IdAt, at: { top: number, left: number }, onDone: (before?: string, to?: string) => void, onCancel: () => void
}) {
    const [value, setValue] = useState(t.id);
    const [problem, setProblem] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        input.current?.focus();
        input.current?.select();
    }, []);

    const apply = () => {
        const before = S.text, bad = renameShape(t.pi, t.id, value);
        if (bad) {
            setProblem(bad);
            input.current?.select();
        } else onDone(before, value);
    };

    return (
        <div id="renameBox" className="rename-box"
             style={{top: Math.max(0, at.top - 3), left: Math.max(0, at.left - 4)}}>
            <input ref={input} type="text" id="renameInput" aria-label={`New id for ${t.id}`} spellCheck="false"
                   autoComplete="off" value={value}
                   onChange={e => {
                       setValue(e.target.value);
                       setProblem(null);
                   }}
                   onBlur={onCancel}
                   onKeyDown={e => {
                       if (e.key !== 'Enter' && e.key !== 'Escape') return;
                       e.preventDefault();
                       e.stopPropagation();   // the keys are the box's, not the editor's shortcuts
                       if (e.key === 'Enter') apply(); else onDone();
                   }}/>
            {problem && <p id="renameProblem" className="notes error" role="alert">{problem}</p>}
        </div>
    );
}
