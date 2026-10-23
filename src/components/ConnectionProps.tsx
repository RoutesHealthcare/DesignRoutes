import {useSyncExternalStore} from "react";
import {subscribe, getVersion} from "../engine/store";
import {CARDS, CONN, CONN_SETS, LINE_STYLES, MARKERS, cap, type ConnType, type Marker} from "../engine/flow/model";
import {connectionView, restyleConn, reverseConnection, typeStyle} from "../engine/connection-props";
import {useCommittedField} from "./PropsFields";

const cardOptions = CARDS.map(k => <option key={k} value={k}>{MARKERS[k as Marker] || k}</option>);
const markerOptions = (Object.keys(MARKERS) as Marker[]).map(k => <option key={k} value={k}>{MARKERS[k]}</option>);
const styleOptions = Object.keys(LINE_STYLES).map(k => <option key={k} value={k}>{cap(k)}</option>);

/* Every connection type, grouped the same way for pConn (a selected connection's type) and pNewConn
   (PageProps.tsx's default for new connections) */
export const connTypeOptions = CONN_SETS.map(set => (
    <optgroup key={set} label={set}>
        {(Object.entries(CONN) as [ConnType, (typeof CONN)[ConnType]][])
            .filter(([, c]) => c.set === set)
            .map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
    </optgroup>
));

/* The connection-only section of the properties panel (screen 3.13 in docs/app-plan.md), shown by ShapeProps
   when the single selected shape is a connector. Reads el fresh on every render (connection-props.ts has no
   state of its own) and calls its mutators directly, the same split Palette.tsx/palette.ts use. */
export function ConnectionProps({el}: { el: Element }) {
    useSyncExternalStore(subscribe, getVersion);
    const v = connectionView(el);
    const means = useCommittedField(el, v.rawMeans, val => restyleConn(el, {means: val.trim()}));
    return (
        <>
            <label>Connection type<select id="pConn" value={v.type}
                                           onChange={e => {
                                               const t = e.target.value as ConnType;
                                               restyleConn(el, t === 'custom' ? {} : t === 'er'
                                                   ? {style: 'solid', start: 'one', end: 'zeroMany'} : typeStyle(t));
                                           }}>
                {connTypeOptions}
            </select></label>
            <label>Route<select id="pRoute" value={v.route}
                                 onChange={e => restyleConn(el, {
                                     route: e.target.value === 'elbow' ? 'elbow' : null,
                                     via: null
                                 })}>
                <option value="straight">Straight</option>
                <option value="elbow">Right-angled</option>
            </select></label>
            <p id="pConnMeans" className="means">{v.description}</p>
            <div className="row" id="pErRow" hidden={!v.isEr}>
                <label>At the start<select id="pCardStart" value={v.cardStart}
                                            onChange={e => restyleConn(el, {start: e.target.value, end: v.cardEnd})}>
                    {cardOptions}
                </select></label>
                <label>At the end<select id="pCardEnd" value={v.cardEnd}
                                          onChange={e => restyleConn(el, {end: e.target.value, start: v.cardStart})}>
                    {cardOptions}
                </select></label>
            </div>
            <div id="pCustom" hidden={!v.isCustom}>
                <label>Line<select id="pStyle" value={v.style}
                                    onChange={e => restyleConn(el, {
                                        style: e.target.value,
                                        start: v.start,
                                        end: v.end
                                    })}>
                    {styleOptions}
                </select></label>
                <div className="row">
                    <label>Start<select id="pStart" value={v.start}
                                         onChange={e => restyleConn(el, {
                                             style: v.style,
                                             start: e.target.value,
                                             end: v.end
                                         })}>
                        {markerOptions}
                    </select></label>
                    <label>End<select id="pEnd" value={v.end}
                                       onChange={e => restyleConn(el, {
                                           style: v.style,
                                           start: v.start,
                                           end: e.target.value
                                       })}>
                        {markerOptions}
                    </select></label>
                </div>
            </div>
            <label>Meaning shown in the key<input type="text" id="pMeans" placeholder={v.placeholder}
                                                    value={means.value} onChange={means.onChange}
                                                    onBlur={means.onBlur} onKeyDown={means.onKeyDown}/></label>
            <div className="btns one">
                <button id="pReverse" onClick={() => reverseConnection(el)}>Reverse direction</button>
            </div>
        </>
    );
}
