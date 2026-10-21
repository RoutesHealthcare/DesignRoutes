/* ---------- toolbar and keys ---------- */
import {MM, S} from './core.js';
import {applyView} from './render';
import {
    copySelection,
    deleteShapes,
    duplicate,
    moveMany,
    pasteClipboard,
    selIds,
    select,
    selectAll
} from './selection';
import {editText} from './text-editor';
import {setSpaceHeld} from './pointer';
import {setTool} from './palette'
import {commit, redo, undo} from './document';
import {openFile, save} from './visio-io';
import {TP, setPane} from './text-pane';

export const hotKeysList = [
    {key: 'Click again / Enter', action: 'Edit the selected shape\'s text'},
    {key: 'Ctrl+S', action: 'Save'},
    {key: 'Ctrl+Shift+S', action: 'Save as'},
    {key: 'Ctrl+O', action: 'Open'},
    {key: 'Ctrl+E', action: 'Show or hide the text'},
    {key: 'Ctrl+Z / Y', action: 'Undo / redo'},
    {key: 'Ctrl+D', action: 'Duplicate'},
    {key: 'Ctrl+C / Ctrl+V', action: 'Copy / paste (paste again for more copies)'},
    {key: 'Delete', action: 'Remove the selection'},
    {key: 'Ctrl+A', action: 'Select everything on the page'},
    {key: 'Shift+click', action: 'Add to or remove from the selection'},
    {key: 'Drag on the page', action: 'Select everything inside the box'},
    {key: 'Alt+click', action: 'Select the object underneath'},
    {key: 'Space+drag', action: 'Pan (or middle-drag, or scroll)'},
    {key: 'Arrow keys', action: 'Nudge 1 mm (Shift for 10 mm)'},
    {key: 'Ctrl+scroll', action: 'Zoom'},
    {key: 'Alt+drag', action: 'Move without grid snap'},
]


/* Wires this module to the page. main.ts calls every init() once, in the order the original script ran. */
export function init() {

    document.addEventListener('keydown', e => {
        if (document.querySelector('dialog[open]')) return;   // keys belong to the open dialog
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');
        const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), one = S.selection.size === 1;
        if (mod && k === 's') {
            e.preventDefault();
            save(e.shiftKey);
            return;
        }
        if (mod && k === 'o') {
            e.preventDefault();
            openFile();
            return;
        }
        if (mod && k === 'e') {
            e.preventDefault();
            setPane(!TP.open, TP.pinned);
            return;
        }
        if (typing) return;
        if (e.key === ' ' && !mod && document.activeElement?.tagName !== 'BUTTON') {
            e.preventDefault();
            if (!e.repeat) setSpaceHeld(true);
            return;
        }
        if (mod && k === 'z') {
            e.preventDefault();
            e.shiftKey ? redo() : undo();
            return;
        }
        if (mod && k === 'y') {
            e.preventDefault();
            redo();
            return;
        }
        if (mod && k === 'a') {
            e.preventDefault();
            selectAll();
            return;
        }
        if (mod && k === 'd') {
            e.preventDefault();
            duplicate();
            return;
        }
        if (mod && k === 'c') {
            e.preventDefault();
            copySelection();
            return;
        }
        if (mod && k === 'v') {
            e.preventDefault();
            pasteClipboard();
            return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && S.selection.size) {
            e.preventDefault();
            deleteShapes(selIds());
            return;
        }
        if (e.key === 'Escape') {
            setTool('select');
            select(null);
            return;
        }
        if (e.key.startsWith('Arrow') && S.selection.size) {
            e.preventDefault();
            const st = (e.shiftKey ? 10 : 1) * MM, ids = selIds();
            const moves: Record<string, [number, number]> = {
                ArrowLeft: [-st, 0],
                ArrowRight: [st, 0],
                ArrowUp: [0, st],
                ArrowDown: [0, -st],
            };
            const d = moves[e.key];
            commit(() => moveMany(ids, d[0], d[1]));
            return;
        }
        if ((e.key === 'F2' || e.key === 'Enter') && one) {
            e.preventDefault();
            editText(S.sel);
            return;
        }
        if (!mod && !e.altKey && e.key.length === 1 && one) {
            e.preventDefault();
            editText(S.sel, e.key);
        }
    });
    document.addEventListener('keyup', e => {
        if (e.key === ' ') setSpaceHeld(false);
    });
    window.addEventListener('blur', () => setSpaceHeld(false));
    window.addEventListener('beforeunload', e => {
        if (S.dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    window.addEventListener('resize', () => applyView());
}
