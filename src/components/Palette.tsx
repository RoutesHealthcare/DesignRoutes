import {useState, useSyncExternalStore} from "react";
import {
    PALETTE,
    PATTERN_GROUPS,
    PATTERNS,
    searchPalette,
    type Pattern,
    type PatternGroup,
    type PaletteItem,
    type PaletteMatch
} from "../shapes";
import {
    PATTERN_DRAG,
    SHAPE_DRAG,
    getTool,
    placeInView,
    placePatternInView,
    setDraggedPattern,
    setDraggedShape,
    setTool,
    subscribeTool
} from "../engine/palette";

/* One shape button, from the palette entry in the shape's own definition (src/shapes/*.ts): click it to add the
   shape in the middle of the view, or drag it onto the page. data-kind stays on the button for the tests and the
   text pane's hover help (intellisense.ts). The icon is fixed markup from the shape files, never user text. */
function ShapeButton({kind, label, title = label, icon}: PaletteItem) {
    return (
        <button data-kind={kind} draggable="true" title={title}
                onClick={() => placeInView(kind)}
                onDragStart={e => {
                    setDraggedShape(kind);
                    e.dataTransfer.setData(SHAPE_DRAG, kind);
                    e.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => setDraggedShape(null)}>
            <svg viewBox="0 0 44 28" dangerouslySetInnerHTML={{__html: icon}}/>
            {label}
        </button>
    );
}

const buttons = (items: PaletteItem[]) => items.map(i => <ShapeButton key={i.kind} {...i}/>);

/* A ready-made pattern (shapes/patterns.ts): several shapes at once, so data-pattern rather than data-kind, which
   would make the text pane offer it as a shape type. Click it to add it in the middle of the view, or drag it onto
   the page, as a shape. */
function PatternButton({name, label, title, icon}: Pattern) {
    return (
        <button data-pattern={name} draggable="true" title={title}
                onClick={() => placePatternInView(name)}
                onDragStart={e => {
                    setDraggedPattern(name);
                    e.dataTransfer.setData(PATTERN_DRAG, name);
                    e.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => setDraggedPattern(null)}>
            <svg viewBox="0 0 44 28" dangerouslySetInnerHTML={{__html: icon}}/>
            {label}
        </button>
    );
}

/* Adds a search result to the page, as clicking its button would */
const place = (m: PaletteMatch) => m.shape ? placeInView(m.shape.kind) : placePatternInView(m.pattern.name);

/* The search results, best first, in place of the groups while there's something in the search box */
function Results({found}: { found: PaletteMatch[] }) {
    if (!found.length) return <p className="palette-none" role="status">No shapes or patterns match</p>;
    return (
        <div className="grp" role="region" aria-label="Search results">
            {found.map(m => m.shape ? <ShapeButton key={m.shape.kind} {...m.shape}/>
                : <PatternButton key={"pattern:" + m.pattern.name} {...m.pattern}/>)}
        </div>
    );
}

/* Switches between selecting and drawing connectors; Escape (hot-keys.ts) or adding a shape switches back */
function ConnectButton() {
    const on = useSyncExternalStore(subscribeTool, getTool) === "connect";
    return (
        <button id="toolConnect" aria-pressed={on} title="Draw connectors between shapes"
                onClick={() => setTool(on ? "select" : "connect")}>
            <svg viewBox="0 0 44 28">
                <path d="M6 21 34 7"/>
                <path d="M27 6 35 6.5 31 13.5"/>
            </svg>
            Connect
        </button>
    );
}

/* The search box keeps what's typed in React state: it's the palette's own, nothing in the engine reads it. Enter adds
   the best match, Escape clears the box and shows the groups again. */
export function Palette() {
    const [query, setQuery] = useState("");
    const found = query.trim() ? searchPalette(query) : null;
    return (
        <nav className="palette" aria-label="Shapes">
            <input id="paletteSearch" type="search" placeholder="Search…" aria-label="Search shapes and patterns"
                   value={query} onChange={e => setQuery(e.target.value)}
                   onKeyDown={e => {
                       if (e.key === "Enter" && found?.length) place(found[0]);
                       else if (e.key === "Escape") setQuery("");
                   }}/>
            <ConnectButton/>
            {found && <Results found={found}/>}
            {/* hidden, not removed, while searching, so the groups you'd opened are still open afterwards */}
            <div className="palette-groups" hidden={!!found}>
            {buttons(PALETTE.pinned)}
            {PALETTE.groups.map(g => (
                <details key={g.name} open={g.open}>
                    <summary>{g.name}</summary>
                    <div className="grp">{buttons(g.items)}</div>
                </details>
            ))}
                {(Object.entries(PATTERN_GROUPS) as [PatternGroup, string][]).map(([group, name]) => (
                    <details key={group}>
                        <summary>{name}</summary>
                        <div className="grp">{PATTERNS.filter(p => p.group === group).map(p =>
                            <PatternButton key={p.name} {...p}/>)}</div>
                    </details>
                ))}
                </div>
        </nav>
    );
}
