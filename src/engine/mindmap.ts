/* Mind maps on the page: adding a topic to a map (the properties panel's Add topic button), and which shapes go with
   a central topic or topic when it's moved or deleted. A map is written in the text (checkMindMaps in
   flow/language.ts): topics under a central topic, indented under the topic they hang off. So a new topic is a new
   line in the right place, and the page is rebuilt from the text. */
import {S} from './core';
import {editDoc} from './document';
import {select} from './selection';
import {editText} from './text-editor';
import {userV} from './flow/model';
import {uniqueFid, type ShapeDecl} from './flow/language';

/* The text's line for a shape on the current page, if it has one */
const declOf = (fid: string | null): ShapeDecl | undefined => fid ? S.ast?.pages[S.pi]?.byId.get(fid) : undefined;

/* True for a central topic, or a topic in a map: the shapes a topic can be added to */
export function takesTopics(el: Element | null | undefined): boolean {
    const d = el ? declOf(userV(el, 'FlowId')) : undefined;
    return !!d && !d.implicit && (d.kind === 'centraltopic' || !!d.map);
}

/* Adds a topic hanging off the central topic or topic `fid`: its line goes after the last line of that shape's
   branch, indented like the shape's other topics (two spaces more than the shape, when it has none yet), so the text
   puts it in the map in the right place. It comes selected, with its text ready to type over. */
export function addTopic(fid: string): void {
    const ap = S.ast?.pages[S.pi], d = declOf(fid);
    if (!ap || !d || d.line == null || (d.kind !== 'centraltopic' && !d.map)) return;
    const root = d.kind === 'centraltopic' ? d.id : d.map!.root,
        map = ap.shapes.filter(t => t.map?.root === root && t.line != null);
    const under = (t: ShapeDecl): boolean => {   // t is somewhere down d's branch
        for (let p = t.map?.parent, n = 0; p && n <= ap.shapes.length; p = ap.byId.get(p)?.map?.parent, n++)
            if (p === d.id) return true;
        return false;
    };
    const last = Math.max(d.line, ...map.filter(under).map(t => t.line!)),
        sibling = map.find(t => t.map!.parent === d.id),
        indent = sibling ? sibling.indent ?? 0 : d.kind === 'centraltopic' ? d.indent ?? 0 : (d.indent ?? 0) + 2;
    const id = uniqueFid('topic', new Set(ap.shapes.map(s => s.id))), L = S.text.split('\n');
    L.splice(last + 1, 0, `${' '.repeat(indent)}${id}: topic "Topic"`);
    editDoc(L.join('\n'), S.pi, true);
    const el = Object.values(S.elById).find(e => userV(e, 'FlowId') === id), sid = el?.getAttribute('ID');
    if (!sid) return;
    select(sid);
    editText(sid);
}

/* The page's shape ids for the topics down a central topic's or a topic's branch, every level of it: what goes with
   it when it's moved or deleted. Nothing for any other shape. */
function branchOf(fid: string | null): string[] {
    const ap = S.ast?.pages[S.pi], d = declOf(fid);
    if (!ap || !d || (d.kind !== 'centraltopic' && !d.map)) return [];
    const under = (t: ShapeDecl): boolean => {
        for (let p = t.map?.parent, n = 0; p && n <= ap.shapes.length; p = ap.byId.get(p)?.map?.parent, n++)
            if (p === d.id) return true;
        return false;
    };
    const fids = new Set(ap.shapes.filter(t => t.map && under(t)).map(t => t.id));
    return Object.entries(S.elById).filter(([, el]) => fids.has(userV(el, 'FlowId') ?? '')).map(([id]) => id);
}

/* The ids, with every central topic's map: dragging a central topic carries its topics, as a container carries its
   members (a topic on its own snaps back into its map when dropped, since the map places it) */
export function withMaps(ids: string[]): string[] {
    const out = new Set(ids);
    for (const id of ids) if (declOf(userV(S.elById[id], 'FlowId'))?.kind === 'centraltopic')
        for (const t of branchOf(userV(S.elById[id], 'FlowId'))) out.add(t);
    return [...out];
}

/* The ids, with every topic down the branch of any central topic or topic among them: deleting one deletes its branch,
   and deleting a central topic deletes its whole map */
export function withBranches(ids: string[]): string[] {
    const out = new Set(ids);
    for (const id of ids) for (const t of branchOf(userV(S.elById[id], 'FlowId'))) out.add(t);
    return [...out];
}

/* True for a shape that's part of a mind map, the central topic included: it stays out of containers, as the map
   would come apart if part of it went in one */
export function inMindMap(el: Element | null | undefined): boolean {
    const d = el ? declOf(userV(el, 'FlowId')) : undefined;
    return !!d && (!!d.map || (d.kind === 'centraltopic' && branchOf(d.id).length > 0));
}
