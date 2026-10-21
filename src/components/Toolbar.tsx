import {S} from "../engine/core";
import {fit, zoomCentre} from "../engine/render";
import {newDoc, redo, undo} from "../engine/document";
import {openFile, save} from "../engine/visio-io";
import {useSyncExternalStore} from "react";
import {subscribe} from "../engine/store";
import {openExport, openImport} from "../engine/dialogs";
import {endTour, startTour} from "../engine/tutorial";
import {startPresent} from "../engine/present";

/* Starts a new drawing, asking first if there are unsaved changes */
function startNew() {
    if (S.dirty && !confirm('Discard unsaved changes and start a new drawing?')) return;
    newDoc();
}


export function Toolbar() {
    const canUndo = useSyncExternalStore(subscribe, () => S.undo.length > 0);
    const canRedo = useSyncExternalStore(subscribe, () => S.redo.length > 0);
    const zoom = useSyncExternalStore(subscribe, () => Math.round(S.zoom * 100));
    const name = useSyncExternalStore(subscribe, () => S.name);
    const dirty = useSyncExternalStore(subscribe, () => S.dirty);
    const steps = useSyncExternalStore(subscribe, () => S.ast?.animation?.steps.length ?? 0);
    return (
        <header className="bar">
            <span className="name">DesignRoutes</span>
            <button id="btnNew" title="New drawing" onClick={startNew}>New</button>
            <button id="btnOpen" onClick={openFile}
                    title="Open a .flow file, or a Mermaid, PlantUML, DOT or draw.io file as a new document (Ctrl+O)">Open
            </button>
            <button id="btnSave" title="Save as a .flow file (Ctrl+S)" onClick={() => save(false)}>Save</button>
            <button id="btnSaveAs" className="hide-sm" title="Save as (Ctrl+Shift+S)" onClick={() => save(true)}>Save
                as
            </button>
            <span className="sep"></span>
            <button id="btnImport"
                    title="Bring in a Visio drawing, or create shapes from Mermaid, PlantUML, Graphviz DOT or draw.io"
                    onClick={() => openImport()}>Import
            </button>
            <button id="btnExport"
                    title="Export this page as Mermaid, PlantUML, Graphviz DOT, draw.io, PNG or PDF"
                    onClick={openExport}>Export
            </button>
            <button id="btnPresent" onClick={startPresent} disabled={!steps}
                    title={steps ? `Present: play this drawing's ${steps} animation step${steps > 1 ? 's' : ''} full screen`
                        : 'Present: add an @animation block to the text to play this drawing step by step'}>Present
            </button>
            <span className="sep"></span>
            <button id="btnUndo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>Undo</button>
            <button id="btnRedo" title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo}>Redo</button>
            <span className="sep"></span>
            <button id="btnZoomOut" title="Zoom out" aria-label="Zoom out"
                    onClick={() => zoomCentre(0.8)}>&minus;</button>
            <span id="zoomLbl" className="zoom-label">{zoom}%</span>
            <button id="btnZoomIn" title="Zoom in" aria-label="Zoom in"
                    onClick={() => zoomCentre(1.25)}>+
            </button>
            <button id="btnFit" title="Fit page to window" onClick={fit}>Fit</button>
            <span className="sep"></span>
            <button id="btnTour" title="Replay the guided tour" onClick={() => {
                endTour();
                startTour();
            }}>Tour
            </button>
            <button id="btnCredits" title="Credits and licences for the code and map data in this editor"
                    onClick={() => document.querySelector<HTMLDialogElement>('#creditsDlg')?.showModal()}>Credits
            </button>
            <span className="grow"></span>
            <span id="fileName" className="file-name">{name}{dirty && ' (unsaved changes)'}</span>
            <input type="file" id="fileInput"
                   accept=".flow,.mmd,.mermaid,.puml,.plantuml,.pu,.dot,.gv,.drawio,.xml,.md,.txt" hidden/>
        </header>
    )
}