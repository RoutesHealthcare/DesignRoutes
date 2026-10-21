/* =====================================================================
   Dialogs
   ===================================================================== */
import {$, S, kid, kids, safeFileName, toast} from './core';
import {pageCtx} from './render';
import {commitText} from './text-editor';
import {downloadBlob} from './properties';
import {EXPORTERS, FMT, MAX_IMPORT_CHARS, pageGraph, plural, type Format} from './formats/export';
import {IMPORTERS, detectFormat, isActivityText, unfence} from './formats/import';
import {buildPdf, buildPngExport} from './formats/raster';
import {importGraph, importVisio, isFlowText} from './visio-io';

const FORMATS: Record<string, Format> = FMT;

/* The name typed in File name, or the open document's own name, as a fallback with no extension on it */
const baseName = (): string => safeFileName($<HTMLInputElement>('exportName').value) || safeFileName(S.name.replace(/\.[^.]+$/, '')) || 'diagram';

function setNote(id: string, msg: string | undefined, isError?: boolean): void {
    const n = $(id);
    n.textContent = msg ?? '';
    n.classList.toggle('error', !!isError);
}

function refreshExport(): void {
    const fmt = $<HTMLSelectElement>('exportFmt').value, f = FORMATS[fmt];
    $<HTMLButtonElement>('exportCopy').disabled = !!f.binary;
    const $exportText = $<HTMLTextAreaElement>('exportText');
    $exportText.hidden = !!f.binary;
    if (f.binary) {
        $exportText.value = '';
        setNote('exportNotes', f.note);
        return;
    }
    try {
        const g = pageGraph();
        $exportText.value = EXPORTERS[fmt](g);
        const notes = fmt === 'drawio' ? [] : ['Shapes, labels and arrows are kept. Positions, sizes and colours are not.'];
        setNote('exportNotes', [...notes, ...g.warnings].join('\n'));
    } catch (e) {
        console.error('Export failed', e);
        $exportText.value = '';
        setNote('exportNotes', 'Could not export: ' + (e as Error).message, true);
    }
}

export function openExport(): void {
    if (S.editing) commitText();
    $<HTMLInputElement>('exportName').value = S.name.replace(/\.[^.]+$/, '') || 'diagram';
    $<HTMLDialogElement>('exportDlg').showModal();
    refreshExport();
}

export async function copyExport(): Promise<void> {
    const $exportText = $<HTMLTextAreaElement>('exportText');
    const t = $exportText.value;
    if (!t) return;
    try {
        await navigator.clipboard.writeText(t);
        toast('Copied to the clipboard.');
    } catch (e) {
        console.warn('Clipboard write was refused', e);
        $exportText.select();
        toast('Copying was blocked here. The text is selected: press Ctrl+C to copy it.', 6000);
    }
}

/* Each builder resolves to {blob, ext}: pdf always has a fixed extension, but a PNG export has more than one
   page, so its extension depends on what came back (a single PNG, or a zip holding one per page). */
const BINARY_BUILDERS: Record<string, () => Promise<{ blob: Blob, ext: string }>> = {
    png: buildPngExport,
    pdf: async () => ({blob: await buildPdf(), ext: 'pdf'}),
};

export async function downloadExport(): Promise<void> {
    const fmt = $<HTMLSelectElement>('exportFmt').value, f = FORMATS[fmt],
        t = $<HTMLTextAreaElement>('exportText').value;
    if (f.binary) {
        try {
            const {blob, ext} = await BINARY_BUILDERS[fmt]();
            downloadBlob(blob, baseName() + '.' + ext);
        } catch (e) {
            console.error(f.name + ' export failed', e);
            setNote('exportNotes', `Could not make the ${f.name}: ` + (e as Error).message, true);
        }
        return;
    }
    if (!t) return;
    downloadBlob(new Blob([t], {type: f.mime}), baseName() + (f.suffix || '') + '.' + f.ext);
}

const MAX_VISIO_BYTES = 50e6;
const isVisioName = (n: string): boolean => /\.vsd[xm]$/i.test(n);
let visioFile: File | null = null;   // a .vsdx waiting to be imported; it replaces the text box until the dialog closes
export function setVisio(f: File | null): void {
    visioFile = f;
    const $importText = $<HTMLTextAreaElement>('importText');
    $importText.disabled = $<HTMLSelectElement>('importFmt').disabled = !!f;
    if (f) {
        $importText.value = '';
        setNote('importNotes', `Visio drawing ${f.name} is ready. Choose where to put it, then press Import.`);
    }
}

/* file: optional .vsdx to import, for a Visio drawing that was opened or dropped on the page */
export function openImport(file?: File | null): void {
    if (S.editing) commitText();
    setNote('importNotes', '');
    setVisio(null);
    if (file && file.name) {
        if (file.size > MAX_VISIO_BYTES) {
            toast('That Visio file is too large to import.');
            return;
        }
        setVisio(file);
    }
    $<HTMLDialogElement>('importDlg').showModal();
    (file ? $('importGo') : $('importText')).focus();
}

async function runVisioImport(file: File): Promise<void> {
    const dest = $<HTMLSelectElement>('importDest').value, btn = $<HTMLButtonElement>('importGo');
    if (dest === 'replace' && kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape').length && !confirm('Replace everything on this page? Undo will bring it back.')) return;
    btn.disabled = true;
    try {
        await importVisio(await file.arrayBuffer(), file.name, dest);
        $<HTMLDialogElement>('importDlg').close();
    } catch (e) {
        console.error('Visio import failed', e);
        setNote('importNotes', 'Could not import: ' + (e as Error).message, true);
    } finally {
        btn.disabled = false;
    }
}

export async function runImport(): Promise<void> {
    if (visioFile) return runVisioImport(visioFile);
    let text = $<HTMLTextAreaElement>('importText').value;
    if (!text.trim()) {
        setNote('importNotes', 'Paste some text or choose a file first.', true);
        return;
    }
    if (text.length > MAX_IMPORT_CHARS) {
        setNote('importNotes', 'That text is too large to import.', true);
        return;
    }
    const btn = $<HTMLButtonElement>('importGo');
    btn.disabled = true;
    try {
        text = unfence(text);
        if (isFlowText(text)) throw new Error('this is a flow document. Open it with Open instead.');
        const $importFmt = $<HTMLSelectElement>('importFmt');
        const fmt = $importFmt.value === 'auto' ? detectFormat(text) : $importFmt.value;
        if (!fmt) throw new Error('the format was not recognised. Choose it from the Format list.');
        const g = await IMPORTERS[fmt](text), dest = $<HTMLSelectElement>('importDest').value;
        if (dest === 'replace' && kids(kid(pageCtx().doc.documentElement, 'Shapes'), 'Shape').length && !confirm('Replace everything on this page? Undo will bring it back.')) return;
        await importGraph(g, dest);
        $<HTMLDialogElement>('importDlg').close();
        const used = fmt === 'plantuml' ? (isActivityText(text) ? FMT.activity.name : FMT.plantuml.name) : FORMATS[fmt].name;
        toast(`Imported ${plural(g.nodes.length, 'shape')} and ${plural(g.edges.length, 'connection')} from ${used}.` + (g.warnings.length ? ' ' + g.warnings.join(' ') : ''), g.warnings.length ? 10000 : 4500);
    } catch (e) {
        console.error('Import failed', e);
        setNote('importNotes', 'Could not import: ' + (e as Error).message, true);
    } finally {
        btn.disabled = false;
    }
}

/* Wires this module to the page. main.ts calls every init() once, in the order the original script ran. */
export function init(): void {
    const $exportFmt = $<HTMLSelectElement>('exportFmt');
    for (const [k, f] of Object.entries(FORMATS)) $exportFmt.appendChild(new Option(f.name, k));
    for (const [k, f] of Object.entries(FORMATS)) if (!f.binary) $('importFmt').appendChild(new Option(k === 'plantuml' ? 'PlantUML (either style)' : f.name, k));
    $exportFmt.onchange = refreshExport;
    const $importInput = $<HTMLInputElement>('importInput');
    $('importFile').onclick = () => $importInput.click();
    $importInput.addEventListener('change', async () => {
        const f = $importInput.files?.[0];
        $importInput.value = '';
        if (!f) return;
        if (/\.vsd$/i.test(f.name)) {
            setNote('importNotes', 'Older .vsd files need to be opened in Visio and saved as .vsdx first.', true);
            return;
        }
        if (isVisioName(f.name)) {
            if (f.size > MAX_VISIO_BYTES) setNote('importNotes', 'That Visio file is too large to import.', true); else setVisio(f);
            return;
        }
        setVisio(null);
        if (f.size > MAX_IMPORT_CHARS) {
            setNote('importNotes', 'That file is too large to import.', true);
            return;
        }
        try {
            $<HTMLTextAreaElement>('importText').value = await f.text();
            setNote('importNotes', `Loaded ${f.name}.`);
        } catch (err) {
            console.error('Could not read file', err);
            setNote('importNotes', 'Could not read that file: ' + (err as Error).message, true);
        }
    });

}
