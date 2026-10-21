import {Fragment, useState, useSyncExternalStore} from "react";
import {hotKeysList} from "../engine/hot-keys";
import {getPageSizeNameFormat, pageSizeDictionary} from "../engine/page";
import {LineWeight} from "../shapes/line-weight";
import {subscribe} from "../engine/store";
import {S} from "../engine/core";
import {pageSizeMM, setPageSize} from "../engine/visio-io";
import {renameShape, selectedShapeId} from "../engine/rename";

export function Props() {
    return (
        <>
            <aside className="props" id="props" aria-label="Properties">
                <div id="propsEmpty">
                    <h2>Page</h2>
                    <p id="pageInfo"></p>
                    <label>Name<input type="text" id="pPageName" spellCheck="false" autoComplete="off"/></label>
                    <label>Page size<select id="pPagePreset">
                        <option value="custom">Custom</option>
                        {Object.entries(pageSizeDictionary).map(([key, object]) => {
                            return <option key={key} value={key}>{getPageSizeNameFormat(object)}</option>
                        })}
                    </select></label>
                    <div className="row">
                        <PageSizeInput id="pPageW" label="Width (mm)" axis={0}/>
                        <PageSizeInput id="pPageH" label="Height (mm)" axis={1}/>
                    </div>
                    <div className="btns one">
                        <button id="pFitPage">Fit page to content</button>
                    </div>
                    <p className="notes">The page always grows to fit whatever is on it; set a size here (or pick a
                        preset above) for a floor to export or print to, or use Fit page to content to shrink it to
                        whatever is already there.</p>
                    <div className="btns one">
                        <button id="pDeletePage" className="danger">Delete this page</button>
                    </div>
                    <h2>Getting started</h2>
                    <p>Drag a shape onto the page, or click one to drop it in the middle. To edit a shape's text, click
                        it once to select it, then click it again, press Enter or just start typing (double-click works
                        too). To select several shapes, drag a box around them on an empty part of the page, or
                        Shift+click each one. Use Connect to draw lines between shapes; they stay attached when you move
                        things.</p>
                    <p>The Text tab shows the diagram as text. Edit either side and the other follows. Save keeps the
                        text as a .flow file. Import brings in Visio drawings and Mermaid, PlantUML, DOT or draw.io;
                        Export makes any of them.</p>
                    <h2>Connections</h2>
                    <label>New connections<select id="pNewConn"></select></label>
                    <div className="btns one">
                        <button id="pAddKey">Add a key to this page</button>
                    </div>
                    <h2>Shortcuts</h2>
                    <dl className="keys">
                        {hotKeysList.map(key => {
                            return <Fragment key={key.key}>
                                <dt>{key.key}</dt>
                                <dd>{key.action}</dd>
                            </Fragment>
                        })}
                    </dl>
                </div>
                <div id="propsShape" hidden>
                    <h2 id="selTitle">Shape</h2>
                    <IdField/>
                    <label id="textWrap">Text<textarea id="pText" rows={3}></textarea></label>
                    <label id="stateWrap" className="check" hidden><input type="checkbox" id="pState"/> On</label>
                    <label id="bgWrap" className="check" hidden><input type="checkbox" id="pBg"/> Background</label>
                    <label id="bgFillWrap" hidden>Background colour<input type="color" id="pBgFill"/></label>
                    <label id="mapWrap" hidden>Map<select id="pMap"></select></label>
                    <label id="langWrap" hidden>Language<select id="pLang"></select></label>
                    <label id="faceWrap" hidden>Face<select id="pFace"></select></label>
                    <label id="scrollWrap" hidden>Scrolled (mm)<input type="number" id="pScroll" min="0"
                                                                      step="5"/></label>
                    <label id="valuesWrap" hidden>Values<input type="text" id="pValues" spellCheck="false"
                                                               autoComplete="off" placeholder="3, 5, 2, 7"/></label>
                    <label id="sizeWrap">Text size<select id="pSize"></select></label>
                    <p className="notes" id="editHint">Or edit it on the page: click the shape again, press Enter or
                        start typing.</p>
                    <div className="row">
                        <label id="fillWrap">Fill<input type="color" id="pFill"/></label>
                        <label id="lineWrap">Line<input type="color" id="pLine"/></label>
                        <label id="textColWrap">Text<input type="color" id="pTextCol"/></label>
                    </div>
                    <div id="coloursWrap" className="series" hidden>
                        Series colours
                        <div id="pColours" className="swatches"></div>
                        <div className="btns one">
                            <button id="pColoursReset" type="button">Default colours</button>
                        </div>
                    </div>
                    <label id="weightWrap">Line weight
                        <select id="pWeight">
                            {LineWeight.map((n: number) => {
                                return <option key={n} value={n}>{n} pt</option>
                            })}
                        </select>
                    </label>
                    <div className="row" id="sizeRow">
                        <label>Width (mm)<input type="number" id="pW" min="3" step="1"/></label>
                        <label>Height (mm)<input type="number" id="pH" min="3" step="1"/></label>
                    </div>
                    <div id="connBox" hidden>
                        <label>Connection type<select id="pConn"></select></label>
                        <label>Route<select id="pRoute">
                            <option value="straight">Straight</option>
                            <option value="elbow">Right-angled</option>
                        </select></label>
                        <p id="pConnMeans" className="means"></p>
                        <div className="row" id="pErRow" hidden><label>At the start<select
                            id="pCardStart"></select></label><label>At the end<select id="pCardEnd"></select></label>
                        </div>
                        <div id="pCustom" hidden>
                            <label>Line<select id="pStyle"></select></label>
                            <div className="row"><label>Start<select id="pStart"></select></label><label>End<select
                                id="pEnd"></select></label></div>
                        </div>
                        <label>Meaning shown in the key<input type="text" id="pMeans"/></label>
                        <div className="btns one">
                            <button id="pReverse">Reverse direction</button>
                        </div>
                    </div>
                    <p id="tableHint" hidden>Click a cell again (or double-click it) to edit its text.</p>
                    <div className="btns one" id="imageBtns" hidden>
                        <button id="pImage">Choose picture…</button>
                    </div>
                    <div className="btns one" id="topicBtns" hidden>
                        <button id="pAddTopic">Add topic</button>
                    </div>
                    <input type="file" id="imageInput" hidden/>
                    <div className="btns" id="tableBtns" hidden>
                        <button id="pAddRow">Add row</button>
                        <button id="pDelRow">Remove row</button>
                    </div>
                    <div className="btns" id="gridBtns" hidden>
                        <button id="pAddCol">Add column</button>
                        <button id="pDelCol">Remove column</button>
                    </div>
                    <div className="btns" id="orderBtns">
                        <button id="pFront">Bring to front</button>
                        <button id="pBack">Send to back</button>
                    </div>
                    <button id="pDelete" className="danger">Delete shape</button>
                </div>
            </aside>
        </>
    )
}

/* The selected shape's id. Changing it renames the shape everywhere on its page (engine/rename.ts) when the user
   presses Enter or leaves the box; Escape puts it back. What's typed and any problem belong to the shape they were
   typed for, so another selection starts afresh while the box itself, and its focus, stay put. */
function IdField() {
    const fid = useSyncExternalStore(subscribe, selectedShapeId);
    const [draft, setDraft] = useState<{ fid: string, v: string } | null>(null);
    const [problem, setProblem] = useState<{ fid: string, msg: string } | null>(null);
    if (!fid) return null;

    const commit = () => {
        if (draft?.fid !== fid) return;
        const bad = renameShape(S.pi, fid, draft.v);
        // a rejected id isn't kept: the box goes back to the shape's real id, with the problem under it
        setProblem(bad ? {fid, msg: bad} : null);
        setDraft(null);
    };

    return (
        <>
            <label>Id<input type="text" id="pId" spellCheck="false" autoComplete="off"
                            value={draft?.fid === fid ? draft.v : fid}
                            onChange={e => setDraft({fid, v: e.target.value})}
                            onBlur={commit}
                            onKeyDown={e => {
                                if (e.key !== 'Enter' && e.key !== 'Escape') return;
                                e.stopPropagation();   // Enter would also start editing the shape's text
                                if (e.key === 'Enter') commit();
                                else {
                                    setDraft(null);
                                    setProblem(null);
                                }
                            }}/></label>
            {problem?.fid === fid && <p className="notes error" id="pIdProblem" role="alert">{problem.msg}</p>}
        </>
    );
}

/* A page Width or Height box. Shows the page's size from the engine, except while the user is typing in it;
   the typed value is only written to the page when they press Enter or leave the box. */
function PageSizeInput({id, label, axis}: { id: string, label: string, axis: 0 | 1 }) {
    const value = useSyncExternalStore(subscribe, () => pageSizeMM(S.pi)[axis]);
    const [draft, setDraft] = useState<string | null>(null);

    const commit = () => {
        if (draft === null) return;
        const n = +draft || 0;
        if (n >= 50) {
            // the other side comes from the page's stored size, not from what is on screen
            const [w, h] = pageSizeMM(S.pi);
            setPageSize(S.pi, axis === 0 ? n : w, axis === 1 ? n : h);
        }
        setDraft(null);
    };

    return (
        <label>{label}<input type="number" id={id} min="50" max="5000" step="1"
                             value={draft ?? String(value)}
                             onChange={e => setDraft(e.target.value)}
                             onBlur={commit}
                             onKeyDown={e => {
                                 if (e.key === 'Enter') commit();
                             }}/></label>
    );
}