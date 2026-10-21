/* ---------- present mode ----------
   Plays the drawing's @animation block full screen, one step at a time, like a slide deck: next is →, space, Page Down
   or a click; back is ←, Backspace or Page Up; Home and End jump to the start and the last step; Esc leaves. Each step
   is the base diagram with steps 1..n applied (flow/animation.ts), built onto the canvas as the text is normally.
   Going between steps, a shape that moves or changes size slides there, one that changes how it looks (its colour,
   its type) crossfades as it slides, and shapes and connections that appear or go fade in or out.
   Nothing here changes the text, and nothing can while presenting (syncFromModel, pushUndo and editDoc all refuse):
   leaving rebuilds the canvas from the text, so what is left is exactly the base diagram. */
import {$, kid, kids, S, stage, type Box} from './core';
import {is1D, shapeCtx} from './visio-package';
import {userV} from './flow/model';
import {playSteps, type Pins} from './flow/animation';
import type {FlowAst, FlowPage, ShapeDecl} from './flow/language';
import {buildModel} from './flow/sync';
import {fit, render} from './render';
import {rebuild} from './document';
import {commitText} from './text-editor';
import {notify} from './store';
import {TP, applyFromEditor} from './text-pane';

const SLIDE_MS = 450;
/* the base diagram's positions, captured on the way in, which each step pins the layout's shapes to */
let pins: Pins = [];
/* the step on the canvas now, and the pages each step's lines change */
let shown: FlowPage[] = [], touched: number[][] = [];
let running: Animation[] = [], wentFull = false, startPage = 0;

const ghosts = (): Element => {
    const g: Element | null = document.getElementById('ghosts');
    if (g) return g;
    const made = document.createElementNS('http://www.w3.org/2000/svg', 'g');   // where shapes on their way out
    made.id = 'ghosts';                                                         // fade, above the page
    made.setAttribute('pointer-events', 'none');
    $('layer').after(made);
    return made;
};

/* Starts presenting from the base diagram */
export function startPresent(): void {
    if (S.present) return;
    if (S.editing) commitText();
    if (TP.open && TP.mode === 'flow') applyFromEditor(true);   // typing still waiting to apply: the steps may be in it
    if (!S.ast) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    const steps = S.ast.animation?.steps ?? [];
    pins = S.built.map(m => new Map([...m].map(([id, g]) => [id, {x: g.x, y: g.y}])));
    shown = S.ast.pages;
    touched = playSteps(S.ast, 0).touched;
    startPage = S.pi;
    S.sel = null;
    S.selection = new Set();
    S.hover = null;
    S.present = {at: 0, labels: ['Start', ...steps.map(s => `Step ${s.n}`)]};
    document.body.classList.add('presenting');
    window.addEventListener('keydown', onKey, true);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'dblclick', 'contextmenu'] as const)
        stage.addEventListener(t, onPointer, true);
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', onFullscreen);
    wentFull = false;
    document.documentElement.requestFullscreen?.().then(() => wentFull = true, () => undefined);
    render();
    notify();
    requestAnimationFrame(fit);   // once the panels have gone and the page has the whole window
}

/* Leaves present mode: the canvas is rebuilt from the text, the base diagram exactly */
export function exitPresent(): void {
    if (!S.present) return;
    settle();
    S.present = null;
    document.body.classList.remove('presenting');
    window.removeEventListener('keydown', onKey, true);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'dblclick', 'contextmenu'] as const)
        stage.removeEventListener(t, onPointer, true);
    window.removeEventListener('resize', fit);
    document.removeEventListener('fullscreenchange', onFullscreen);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    shown = [];
    S.pi = startPage;   // back to the page presenting started on, if the steps went to another
    rebuild(null);
    requestAnimationFrame(fit);
}

export const nextStep = (): void => goTo((S.present?.at ?? 0) + 1);
export const backStep = (): void => goTo((S.present?.at ?? 0) - 1);

/* Shows step `at` (0 is the base diagram), sliding and fading from the step shown now */
export function goTo(at: number): void {
    const p = S.present, ast = S.ast;
    if (!p || !ast) return;
    at = Math.max(0, Math.min(p.labels.length - 1, at));
    if (at === p.at) return;
    settle();
    /* the step that makes the difference: the one going forward to, or the one going back from */
    const pages = touched[Math.max(at, p.at) - 1] ?? [], turn = pages.length > 0 && !pages.includes(S.pi);
    const before = turn ? null : snapshot();
    const next: FlowAst = at === 0 ? ast : {...ast, pages: playSteps(ast, at, {pins}).pages};
    if (turn) S.pi = pages[0];   // the step changes another page: go to it
    const was = shown;
    shown = next.pages;
    p.at = at;
    buildModel(next);   // keeps S.pi
    render();
    if (before) tween(before, was[S.pi], shown[S.pi]);
    else fit();
    notify();
}

/* Each drawn shape and connection, by what it is in the text rather than by its canvas id, which a rebuild changes:
   s:<id> for a shape, e:<line> for a connection, a:<from>><to> for a mind map's branch line */
type Drawn = { g: Element, box: Box | null, line: boolean };

function snapshot(): Map<string, Drawn> {
    const out = new Map<string, Drawn>(), doc = S.pages[S.pi]?.doc;
    const ends = new Map<string, string[]>();
    if (doc) for (const c of kids(kid(doc.documentElement, 'Connects'), 'Connect')) {
        const f = c.getAttribute('FromSheet') ?? '', to = S.elById[c.getAttribute('ToSheet') ?? ''];
        ends.set(f, [...ends.get(f) ?? [], userV(to, 'FlowId') ?? '']);
    }
    for (const g of $('layer').children) {
        const id = g.getAttribute('data-id'), el = id ? S.elById[id] : undefined;
        if (!id || !el) continue;
        const line = is1D(shapeCtx(el, null)), edge = userV(el, 'FlowEdge'), fid = userV(el, 'FlowId');
        const key = line ? (edge != null ? 'e:' + edge : 'a:' + (ends.get(id) ?? []).join('>')) : fid ? 's:' + fid : null;
        if (key) out.set(key, {g, box: S.boxes[id] ? {...S.boxes[id]} : null, line});
    }
    return out;
}

/* How a shape looks, less where it is and how big */
const looks = (d: ShapeDecl | undefined): string => {
    if (!d) return '';
    const {in: _, ...attrs} = d.attrs;
    return JSON.stringify([d.kind, d.label, d.columns, d.cells, d.values, attrs]);
};

/* Slides and fades from what was drawn (before, the page was) to what is drawn now (the page is) */
function tween(before: Map<string, Drawn>, was: FlowPage | undefined, is: FlowPage | undefined): void {
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : SLIDE_MS;
    if (!ms) return;
    const now = snapshot(), out = ghosts(), timing = {duration: ms, easing: 'ease-in-out'};
    const play = (el: Element, frames: Keyframe[]): Animation => {
        const a = el.animate(frames, timing);
        running.push(a);
        return a;
    };
    const fadeOut = (d: Drawn, to: string = 'none') => {
        d.g.removeAttribute('clip-path');   // its clip path went with the old page
        out.appendChild(d.g);
        // gone once faded: an animation's last frame doesn't stay, so the ghost would come back
        play(d.g, [{opacity: 1, transform: 'none'}, {opacity: 0, transform: to}]).onfinish = () => d.g.remove();
    };
    /* the transform that puts box b where box a is, at a's size */
    const onto = (a: Box, b: Box): string => {
        const sx = (a.x1 - a.x0) / Math.max(b.x1 - b.x0, 1e-3), sy = (a.y1 - a.y0) / Math.max(b.y1 - b.y0, 1e-3);
        return `translate(${a.x0}px, ${a.y0}px) scale(${sx}, ${sy}) translate(${-b.x0}px, ${-b.y0}px)`;
    };
    for (const [key, d] of now) {
        const old = before.get(key);
        before.delete(key);
        if (!old) {
            play(d.g, [{opacity: 0}, {opacity: 1}]);
            continue;
        }
        if (d.line) {   // a connection whose route changed fades across (cheaper than re-routing every frame)
            if (old.g.innerHTML !== d.g.innerHTML) {
                fadeOut(old);
                play(d.g, [{opacity: 0}, {opacity: 1}]);
            }
            continue;
        }
        const a = old.box, b = d.box, fid = key.slice(2);
        const moved = a && b && [a.x0 - b.x0, a.y0 - b.y0, a.x1 - b.x1, a.y1 - b.y1].some(v => Math.abs(v) > 0.5);
        const changed = looks(was?.byId.get(fid)) !== looks(is?.byId.get(fid));
        if (moved) play(d.g, [{transform: onto(a!, b!)}, {transform: 'none'}]);
        if (changed) {
            fadeOut(old, moved ? onto(b!, a!) : 'none');
            play(d.g, [{opacity: 0}, {opacity: 1}]);
        }
    }
    for (const d of before.values()) fadeOut(d);   // hidden at this step, or gone with what hid
}

/* Ends any slide or fade still running, at its end */
function settle(): void {
    for (const a of running) a.finish();
    running = [];
    document.getElementById('ghosts')?.replaceChildren();
}

function onKey(e: KeyboardEvent): void {
    if (/^F\d+$/.test(e.key) && e.key !== 'F5') return;   // leave the browser's own keys be
    e.preventDefault();
    e.stopImmediatePropagation();   // and every editing key: nothing edits a step
    if (e.repeat && e.key === 'Escape') return;
    switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
            return nextStep();
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
            return backStep();
        case 'Home':
            return goTo(0);
        case 'End':
            return goTo(Infinity);
        case 'Escape':
            return exitPresent();
    }
}

/* A click on the page is next; the page is not edited, selected or hovered while presenting */
function onPointer(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'pointerdown' && (e as PointerEvent).button === 0) nextStep();
    if (e.type === 'contextmenu') backStep();
}

/* Leaving full screen (Esc in the browser) leaves present mode */
function onFullscreen(): void {
    if (wentFull && !document.fullscreenElement) exitPresent();
}
