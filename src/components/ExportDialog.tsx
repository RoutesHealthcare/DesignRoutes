import {copyExport, downloadExport} from "../engine/dialogs";
import {useRef} from "react";

export function ExportDialog() {
    const dlg = useRef<HTMLDialogElement>(null);
    return (
        <>
            <dialog id="exportDlg" aria-labelledby="exportTitle" ref={dlg}>
                <h2 id="exportTitle">Export this page</h2>
                <div className="row2">
                    <label>Format<select id="exportFmt"></select></label>
                    <label>File name<input type="text" id="exportName" spellCheck="false" autoComplete="off"/></label>
                </div>
                <textarea id="exportText" readOnly spellCheck="false" aria-label="Exported text"></textarea>
                <p id="exportNotes" className="notes" role="status"></p>
                <div className="dlgBtns">
                    <button id="exportCopy" onClick={copyExport}>Copy</button>
                    <button id="exportDownload" onClick={downloadExport}>Download</button>
                    <button id="exportClose" className="primary" onClick={() => dlg.current?.close()}>Close</button>
                </div>
            </dialog>
        </>
    )
}