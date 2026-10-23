import {useState, useSyncExternalStore} from "react";
import {subscribe, getVersion} from "../engine/store";
import {S, toast} from "../engine/core";
import {commit} from "../engine/document";
import {setText, shapeCtx, shapeText} from "../engine/visio-package";
import {setUser, delUser, userV} from "../engine/flow/model";
import {renameShape, selectedShapeId} from "../engine/rename";
import {deleteShapes, selIds} from "../engine/selection";
import {moveStatement} from "../engine/connection-props";
import {addTopic} from "../engine/mindmap";
import {PICTURE_TYPES, setPicture} from "../engine/images";
import {resizeGrid, resizeTable, coloursOf, parseValues, valuesProblem, valuesCell, PLAIN_VALUES_PROBLEM} from "../shapes";
import {LineWeight} from "../shapes/line-weight";
import {
    shapeView,
    applyFill,
    applyLine,
    applyTextColour,
    applyWeight,
    applyTextSize,
    setShapeSizeMM,
    nearestWeight,
    TEXT_SIZES,
} from "../engine/properties";
import {useCommittedField, useDraft, useNativeChange} from "./PropsFields";
import {ConnectionProps} from "./ConnectionProps";

/* The selected shape's id. Changing it renames the shape everywhere on its page (engine/rename.ts) when the user
   presses Enter or leaves the box; Escape puts it back. What's typed and any problem belong to the shape they were
   typed for, so another selection starts afresh while the box itself, and its focus, stay put. */
function IdField() {
    const fid = useSyncExternalStore(subscribe, selectedShapeId);
    const d = useDraft(fid, fid ?? '');
    const [problem, setProblem] = useState<{ fid: string, msg: string } | null>(null);
    if (!fid) return null;

    const commitId = () => {
        const v = d.take();
        if (v === null) return;
        const bad = renameShape(S.pi, fid, v);
        setProblem(bad ? {fid, msg: bad} : null);
    };

    return (
        <>
            <label>Id<input type="text" id="pId" spellCheck="false" autoComplete="off"
                            value={d.value}
                            onChange={e => d.set(e.target.value)}
                            onBlur={commitId}
                            onKeyDown={e => {
                                if (e.key !== 'Enter' && e.key !== 'Escape') return;
                                e.stopPropagation();   // Enter would also start editing the shape's text
                                if (e.key === 'Enter') commitId();
                                else {
                                    d.clear();
                                    setProblem(null);
                                }
                            }}/></label>
            {problem?.fid === fid && <p className="notes error" id="pIdProblem" role="alert">{problem.msg}</p>}
        </>
    );
}

/* One series' colour picker, named underneath: a legend's names, or Series 1, 2, ... on a chart. Uncontrolled
   (defaultValue): a controlled value fights the parent's delegated native "change" commit - React resets a
   controlled colour input back to its old value as soon as the browser's own "input" event fires, which
   would otherwise undo the pick before the "change" listener ever reads it. ShapeProps/MultiProps are keyed
   by shape id, so this still shows the right colour fresh whenever the selection changes. */
function ColourSwatch({i, value, name}: { i: number, value: string, name: string }) {
    return (
        <label title={name}>
            <input type="color" data-series={i} defaultValue={value}/>
            {name}
        </label>
    );
}

/* Screen regions 1.5/3.12/3.13 of docs/app-plan.md: the single selected shape or connection. Reads shapeView(el)
   fresh on every render and calls the engine's mutators directly, the same split Palette.tsx/palette.ts use. */
export function ShapeProps({el}: { el: Element }) {
    useSyncExternalStore(subscribe, getVersion);
    const v = shapeView(el);
    const id = el.getAttribute('ID')!;

    const textField = useCommittedField(id, v.text, raw => commit(() => setText(el, raw)), false);
    const scrollField = useCommittedField(id, v.scrollValue, raw => {
        const by = Math.round(+raw);
        if (!(by >= 0 && by <= 10000)) return;
        commit(() => {
            if (by) setUser(el, 'FlowScroll', by); else delUser(el, 'FlowScroll');
        });
    });
    const valuesField = useCommittedField(id, v.chartValue, raw => {
        const vals = parseValues(v.role, raw), bad = valuesProblem(v.role, vals);
        if (bad) {
            toast(bad === PLAIN_VALUES_PROBLEM ? 'Values are numbers of 0 or more, separated by commas, like 3, 5, 2, 7.' : bad);
            return;
        }
        commit(() => setUser(el, 'FlowValues', valuesCell(vals)));
    });
    const wField = useCommittedField(id, String(v.widthMM), raw => setShapeSizeMM(id, el, +raw || 0, +hField.value || 0));
    const hField = useCommittedField(id, String(v.heightMM), raw => setShapeSizeMM(id, el, +wField.value || 0, +raw || 0));

    const fillRef = useNativeChange<HTMLInputElement>(e => applyFill((e.target as HTMLInputElement).value));
    const lineRef = useNativeChange<HTMLInputElement>(e => applyLine((e.target as HTMLInputElement).value));
    const textColRef = useNativeChange<HTMLInputElement>(e => applyTextColour((e.target as HTMLInputElement).value));
    const bgFillRef = useNativeChange<HTMLInputElement>(e => {
        const hex = (e.target as HTMLInputElement).value.toUpperCase();
        commit(() => {
            if (hex === '#FFFFFF') delUser(el, 'FlowBgFill'); else setUser(el, 'FlowBgFill', hex);
        });
    });
    /* One delegated listener for every swatch inside, same as the colours were edited before this was a component */
    const coloursRef = useNativeChange<HTMLDivElement>(e => {
        const pick = e.target as HTMLInputElement;
        if (pick.dataset.series == null) return;
        const i = +pick.dataset.series, shown = v.seriesColours, own = coloursOf(userV(el, 'FlowColours'));
        const next = Array.from({length: Math.max(own.length, i + 1)}, (_, k) => k === i ? pick.value : own[k] ?? shown[k]);
        commit(() => setUser(el, 'FlowColours', next.map(c => c.toUpperCase()).join(',')));
    });

    const elId = id;
    const imageInputRef = useNativeChange<HTMLInputElement>(async e => {
        const input = e.target as HTMLInputElement, f = input.files?.[0];
        input.value = '';
        if (f) await setPicture(el, f);
    });

    return (
        <>
            <h2 id="selTitle">{v.title}</h2>
            <IdField/>
            {v.textFieldsVisible && <label id="textWrap">Text<textarea id="pText" rows={3}
                                                                        value={textField.value}
                                                                        onChange={textField.onChange}
                                                                        onBlur={textField.onBlur}/></label>}
            {v.stateful && <label id="stateWrap" className="check"><input type="checkbox" id="pState"
                                                                           checked={v.state}
                                                                           onChange={e => commit(() => {
                                                                               if (e.target.checked) setUser(el, 'FlowState', 'on'); else delUser(el, 'FlowState');
                                                                           })}/> On</label>}
            {v.hasBg && <label id="bgWrap" className="check"><input type="checkbox" id="pBg" checked={v.bg}
                                                                      onChange={e => commit(() => {
                                                                          if (e.target.checked) delUser(el, 'FlowBg'); else setUser(el, 'FlowBg', 'off');
                                                                      })}/> Background</label>}
            {v.hasBg && <label id="bgFillWrap">Background colour
                <input type="color" id="pBgFill" ref={bgFillRef} defaultValue={v.bgFill}/>
            </label>}
            {v.maps && <label id="mapWrap">Map<select id="pMap" value={v.mapValue}
                                                        onChange={e => {
                                                            const next = e.target.value, was = v.maps![v.mapValue];
                                                            commit(() => {
                                                                if (next === Object.keys(v.maps!)[0]) delUser(el, 'FlowMap'); else setUser(el, 'FlowMap', next);
                                                                if (was && shapeText(shapeCtx(el, null)) === was.sample) setText(el, v.maps![next].sample);
                                                            });
                                                        }}>
                {Object.entries(v.maps).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
            </select></label>}
            {v.langs && <label id="langWrap">Language<select id="pLang" value={v.langValue}
                                                               onChange={e => {
                                                                   const next = e.target.value;
                                                                   commit(() => {
                                                                       if (next === Object.keys(v.langs!)[0]) delUser(el, 'FlowLang'); else setUser(el, 'FlowLang', next);
                                                                   });
                                                               }}>
                {Object.entries(v.langs).map(([k, l]) => <option key={k} value={k}>{l.name}</option>)}
            </select></label>}
            {v.faces && <label id="faceWrap">Face<select id="pFace" value={v.faceValue}
                                                           onChange={e => {
                                                               const next = e.target.value;
                                                               commit(() => {
                                                                   if (next === Object.keys(v.faces!)[0]) delUser(el, 'FlowFace'); else setUser(el, 'FlowFace', next);
                                                               });
                                                           }}>
                {Object.entries(v.faces).map(([k, f]) => <option key={k} value={k}>{f.name}</option>)}
            </select></label>}
            {v.scroll && <label id="scrollWrap">Scrolled (mm)<input type="number" id="pScroll" min="0" step="5"
                                                                     value={scrollField.value}
                                                                     onChange={scrollField.onChange}
                                                                     onBlur={scrollField.onBlur}
                                                                     onKeyDown={scrollField.onKeyDown}/></label>}
            {v.chart && <label id="valuesWrap">Values<input type="text" id="pValues" spellCheck="false"
                                                              autoComplete="off" placeholder="3, 5, 2, 7"
                                                              value={valuesField.value}
                                                              onChange={valuesField.onChange}
                                                              onBlur={valuesField.onBlur}
                                                              onKeyDown={valuesField.onKeyDown}/></label>}
            {v.textFieldsVisible && <label id="sizeWrap">Text size<select id="pSize" value={v.size.value}
                                                                          onChange={e => applyTextSize(+e.target.value)}>
                {TEXT_SIZES.map(pt => <option key={pt} value={pt}>{pt} pt</option>)}
                {v.size.extra != null && <option value={v.size.extra}>{v.size.extra} pt</option>}
            </select></label>}
            {v.textFieldsVisible && <p className="notes" id="editHint">Or edit it on the page: click the shape
                again, press Enter or start typing.</p>}
            <div className="row">
                {v.fillVisible && <label id="fillWrap">Fill<input type="color" id="pFill" ref={fillRef}
                                                                    defaultValue={v.fill}/></label>}
                {v.textFieldsVisible && <label id="lineWrap">Line<input type="color" id="pLine" ref={lineRef}
                                                                         defaultValue={v.line}/></label>}
                {v.textFieldsVisible && <label id="textColWrap">Text<input type="color" id="pTextCol"
                                                                            ref={textColRef}
                                                                            defaultValue={v.textCol}/></label>}
            </div>
            {v.seriesShape && <div id="coloursWrap" className="series">
                Series colours
                <div id="pColours" className="swatches" ref={coloursRef}>
                    {v.seriesColours.map((c, i) => <ColourSwatch key={i} i={i} value={c}
                                                                  name={v.seriesNames[i] || `Series ${i + 1}`}/>)}
                </div>
                <div className="btns one">
                    {v.coloursResetVisible && <button id="pColoursReset" type="button"
                                                       onClick={() => commit(() => delUser(el, 'FlowColours'))}>Default
                        colours</button>}
                </div>
            </div>}
            {v.textFieldsVisible && <label id="weightWrap">Line weight
                <select id="pWeight" value={nearestWeight(v.weightPt)} onChange={e => applyWeight(+e.target.value)}>
                    {LineWeight.map((n: number) => <option key={n} value={n}>{n} pt</option>)}
                </select>
            </label>}
            {v.sizeRowVisible && <div className="row" id="sizeRow">
                <label>Width (mm)<input type="number" id="pW" min="3" step="1" value={wField.value}
                                         onChange={wField.onChange} onBlur={wField.onBlur}
                                         onKeyDown={wField.onKeyDown}/></label>
                <label>Height (mm)<input type="number" id="pH" min="3" step="1" value={hField.value}
                                          onChange={hField.onChange} onBlur={hField.onBlur}
                                          onKeyDown={hField.onKeyDown}/></label>
            </div>}
            <div id="connBox" hidden={!v.oneD}>{v.oneD && <ConnectionProps el={el}/>}</div>
            {v.table && <p id="tableHint">Click a cell again (or double-click it) to edit its text.</p>}
            {v.imageVisible && <div className="btns one" id="imageBtns">
                <button id="pImage" onClick={() => imageInputRef.current?.click()}>{v.imageLabel}</button>
            </div>}
            {v.topicVisible && <div className="btns one" id="topicBtns">
                <button id="pAddTopic" onClick={() => {
                    const fid = userV(el, 'FlowId');
                    if (fid) addTopic(fid);
                }}>Add topic</button>
            </div>}
            <input type="file" id="imageInput" hidden ref={imageInputRef} accept={PICTURE_TYPES}/>
            {v.table && <div className="btns" id="tableBtns">
                <button id="pAddRow"
                        onClick={() => v.grid ? resizeGrid(elId, 'row', true) : resizeTable(elId, true)}>Add
                    row
                </button>
                <button id="pDelRow"
                        onClick={() => v.grid ? resizeGrid(elId, 'row', false) : resizeTable(elId, false)}>Remove
                    row
                </button>
            </div>}
            {v.grid && <div className="btns" id="gridBtns">
                <button id="pAddCol" onClick={() => resizeGrid(elId, 'col', true)}>Add column</button>
                <button id="pDelCol" onClick={() => resizeGrid(elId, 'col', false)}>Remove column</button>
            </div>}
            {v.orderBtnsVisible && <div className="btns" id="orderBtns">
                <button id="pFront" onClick={() => moveStatement(el, true)}>Bring to front</button>
                <button id="pBack" onClick={() => moveStatement(el, false)}>Send to back</button>
            </div>}
            <button id="pDelete" className="danger" onClick={() => deleteShapes(selIds())}>{v.deleteLabel}</button>
        </>
    );
}
