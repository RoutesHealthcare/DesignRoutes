import {useRef} from "react";
import {runImport, setVisio} from "../engine/dialogs";

export function ImportDialog() {
    const dlg = useRef<HTMLDialogElement>(null);
    return (
        <>
            <dialog id="importDlg" aria-labelledby="importTitle" ref={dlg} onClose={() => setVisio(null)}>
                <h2 id="importTitle">Import a diagram</h2>
                <div className="row2">
                    <label>Format<select id="importFmt">
                        <option value="auto">Detect automatically</option>
                    </select></label>
                    <label>Put it on<select id="importDest">
                        <option value="new">A new page</option>
                        <option value="replace">This page, replacing what is there</option>
                        <option value="add">This page, beside what is there</option>
                    </select></label>
                </div>
                <textarea id="importText" spellCheck="false" aria-label="Diagram text"
                          placeholder="Paste Mermaid, PlantUML, Graphviz DOT or draw.io XML here, or choose a file (including a Visio .vsdx drawing)."></textarea>
                <p id="importNotes" className="notes" role="status"></p>
                <div className="dlgBtns">
                    <button id="importFile">Choose file…</button>
                    <input type="file" id="importInput" hidden
                           accept=".vsdx,.vsdm,.mmd,.mermaid,.md,.puml,.plantuml,.pu,.iuml,.dot,.gv,.drawio,.xml,.txt"/>
                    <span className="grow"></span>
                    <button id="importCancel" onClick={() => {
                        dlg.current?.close()
                    }}>Cancel
                    </button>
                    <button id="importGo" className="primary" onClick={runImport}>Import</button>
                </div>
            </dialog>
        </>
    )
}