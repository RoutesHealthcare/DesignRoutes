import {useSyncExternalStore} from "react";
import {subscribe, getVersion} from "../engine/store";
import {deleteShapes, selIds} from "../engine/selection";
import {LineWeight} from "../shapes/line-weight";
import {
    multiPropsView,
    applyFill,
    applyLine,
    applyTextColour,
    applyWeight,
    applyTextSize,
    nearestWeight,
    TEXT_SIZES,
} from "../engine/properties";
import {useNativeChange} from "./PropsFields";

/* Screen 3 of docs/app-plan.md, shown instead of ShapeProps when two or more items are selected: the fields a
   style change can apply to every selected item at once (properties.ts's styleSelection already works the
   same for one shape or many). */
export function MultiProps() {
    useSyncExternalStore(subscribe, getVersion);
    const v = multiPropsView();

    const fillRef = useNativeChange<HTMLInputElement>(e => applyFill((e.target as HTMLInputElement).value));
    const lineRef = useNativeChange<HTMLInputElement>(e => applyLine((e.target as HTMLInputElement).value));
    const textColRef = useNativeChange<HTMLInputElement>(e => applyTextColour((e.target as HTMLInputElement).value));

    return (
        <>
            <h2 id="selTitle">{v.title}</h2>
            {v.styleVisible && <label id="sizeWrap">Text size<select id="pSize" value={v.size.value}
                                                                      onChange={e => applyTextSize(+e.target.value)}>
                {TEXT_SIZES.map(pt => <option key={pt} value={pt}>{pt} pt</option>)}
                {v.size.extra != null && <option value={v.size.extra}>{v.size.extra} pt</option>}
            </select></label>}
            <div className="row">
                {v.fillVisible && <label id="fillWrap">Fill<input type="color" id="pFill" ref={fillRef}
                                                                    defaultValue={v.fill}/></label>}
                {v.styleVisible && <label id="lineWrap">Line<input type="color" id="pLine" ref={lineRef}
                                                                    defaultValue={v.line}/></label>}
                {v.styleVisible && <label id="textColWrap">Text<input type="color" id="pTextCol" ref={textColRef}
                                                                       defaultValue={v.textCol}/></label>}
            </div>
            {v.styleVisible && <label id="weightWrap">Line weight
                <select id="pWeight" value={nearestWeight(v.weightPt)} onChange={e => applyWeight(+e.target.value)}>
                    {LineWeight.map((n: number) => <option key={n} value={n}>{n} pt</option>)}
                </select>
            </label>}
            <button id="pDelete" className="danger" onClick={() => deleteShapes(selIds())}>{v.deleteLabel}</button>
        </>
    );
}
