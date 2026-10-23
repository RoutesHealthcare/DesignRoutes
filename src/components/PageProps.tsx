import {Fragment, useSyncExternalStore} from "react";
import {subscribe, getVersion} from "../engine/store";
import {S, toast} from "../engine/core";
import {hotKeysList} from "../engine/hot-keys";
import {getPageSizeNameFormat, pageSizeDictionary} from "../engine/page";
import {pageSizeMM, setPageSize, requestDeletePage, fitPageToContent, renamePage} from "../engine/visio-io";
import {pageView} from "../engine/properties";
import {setNewConnType, toggleKey, type ConnType} from "../engine/connection-props";
import {connTypeOptions} from "./ConnectionProps";
import {useCommittedField} from "./PropsFields";

/* A page Width or Height box. Shows the page's size from the engine, except while the user is typing in it;
   the typed value is only written to the page when they press Enter or leave the box. */
function PageSizeInput({id, label, axis}: { id: string, label: string, axis: 0 | 1 }) {
    const value = useSyncExternalStore(subscribe, () => pageSizeMM(S.pi)[axis]);
    const field = useCommittedField(S.pi, String(value), raw => {
        const n = +raw || 0;
        if (n >= 50) {
            // the other side comes from the page's stored size, not from what is on screen
            const [w, h] = pageSizeMM(S.pi);
            setPageSize(S.pi, axis === 0 ? n : w, axis === 1 ? n : h);
        }
    });
    return (
        <label>{label}<input type="number" id={id} min="50" max="5000" step="1"
                              value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                              onKeyDown={field.onKeyDown}/></label>
    );
}

/* Screen regions 1.5 (nothing selected) of docs/app-plan.md: the page, and the editor's getting-started and
   shortcuts notes. Reads pageView() fresh on every render and calls visio-io.ts/connection-props.ts's
   mutators directly, the same split Palette.tsx/palette.ts use. */
export function PageProps() {
    useSyncExternalStore(subscribe, getVersion);
    const pv = pageView();
    const nameField = useCommittedField(S.pi, pv?.name ?? '', raw => {
        const v = raw.trim();
        if (v) renamePage(S.pi, v);
    });

    return (
        <>
            <h2>Page</h2>
            <p id="pageInfo">{pv?.info}</p>
            <label>Name<input type="text" id="pPageName" spellCheck="false" autoComplete="off"
                               value={nameField.value} onChange={nameField.onChange}
                               onBlur={nameField.onBlur} onKeyDown={nameField.onKeyDown}/></label>
            <label>Page size<select id="pPagePreset" value={pv?.presetValue ?? 'custom'}
                                     onChange={e => {
                                         const v = e.target.value;
                                         if (!(v in pageSizeDictionary)) return;
                                         const [w, h] = pageSizeDictionary[v as keyof typeof pageSizeDictionary].size;
                                         setPageSize(S.pi, w, h);
                                     }}>
                <option value="custom">Custom</option>
                {Object.entries(pageSizeDictionary).map(([key, object]) => (
                    <option key={key} value={key}>{getPageSizeNameFormat(object)}</option>
                ))}
            </select></label>
            <div className="row">
                <PageSizeInput id="pPageW" label="Width (mm)" axis={0}/>
                <PageSizeInput id="pPageH" label="Height (mm)" axis={1}/>
            </div>
            <div className="btns one">
                <button id="pFitPage" onClick={() => {
                    if (!fitPageToContent()) toast('There is nothing on this page yet.');
                }}>Fit page to content</button>
            </div>
            <p className="notes">The page always grows to fit whatever is on it; set a size here (or pick a
                preset above) for a floor to export or print to, or use Fit page to content to shrink it to
                whatever is already there.</p>
            <div className="btns one">
                <button id="pDeletePage" className="danger" disabled={pv?.deleteDisabled}
                        onClick={() => requestDeletePage(S.pi)}>Delete this page</button>
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
            <label>New connections<select id="pNewConn" value={pv?.newConnValue ?? ''}
                                           onChange={e => setNewConnType(e.target.value as ConnType)}>
                {connTypeOptions}
            </select></label>
            <div className="btns one">
                <button id="pAddKey" onClick={toggleKey}>{pv?.addKeyLabel ?? 'Add a key to this page'}</button>
            </div>
            <h2>Shortcuts</h2>
            <dl className="keys">
                {hotKeysList.map(key => (
                    <Fragment key={key.key}>
                        <dt>{key.key}</dt>
                        <dd>{key.action}</dd>
                    </Fragment>
                ))}
            </dl>
        </>
    );
}
