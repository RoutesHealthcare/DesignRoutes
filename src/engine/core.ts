import type {EditorState} from "./editorState";
import {DEF, VISIO_COLOUR} from "./colours";

export const NS='http://schemas.microsoft.com/office/visio/2012/main';
export const RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const PRNS='http://schemas.openxmlformats.org/package/2006/relationships';
const SVGNS='http://www.w3.org/2000/svg';
export const PX=96;                 // screen px per inch at 100%
export const MM=1/25.4;             // inches per mm
export const XML_DECL='<?xml version="1.0" encoding="utf-8" standalone="yes"?>\r\n';
export const WALK='_WALKGLUE(BegTrigger,EndTrigger,WalkPreference)';
export type Pt  = [x: number, y: number];
export type Box = {x0: number, y0: number, x1: number, y1: number};

export const S: EditorState = {
    zip:null,
    name:'Untitled.flow',
    text:'',
    ast:null,
    built:[],
    handle:null,
    pages:[],pi:0,
    masters:{},
    styles:{},
    zoom:1,
    panX:40,
    panY:40,
    sel:null,
    tool:'select',
    undo:[],
    redo:[],
    dirty:false,
    boxes:{},
    polys:{},
    elById:{},
    editing:null,
    selection:new Set(),
    hover:null,
    present: null,
    lines:{}
};
/* An element the page always has (index.html and the React components draw them all). Name its type when the
   code needs more than an HTMLElement, e.g. $<HTMLInputElement>('exportName').value */
export const $=<T extends HTMLElement = HTMLElement>(id: string)=>document.getElementById(id) as T;
export let svg: SVGSVGElement;
export let stage: HTMLElement;
export function init(){
    svg=$('canvas') as unknown as SVGSVGElement;
    stage=$('stage');
}

/* ---------- small helpers ---------- */
export const kids=(el: Element|null|undefined, n: string): Element[] =>
    el?[...el.children].filter(c=>c.localName===n):[];
export const kid=(el: Element|null|undefined, n: string): Element|null =>
    el?[...el.children].find(c=>c.localName===n)||null:null;
export function ownCell(el: Element|null|undefined, n: string) : Element|null {
    if(!el) return null;
    for(const c of el.children) if(c.localName==='Cell'&&c.getAttribute('N')===n) return c; return null;
}
export function fmtV(v: unknown): string {
    if(typeof v!=='number') return String(v);
    if(!isFinite(v)||Math.abs(v)<1e-9) return '0'; return String(Math.round(v*1e10)/1e10);
}
type Attrs = Record<string, string | number | null | undefined>;
function mkNS(doc: Document, ns: string, name: string, attrs: Attrs = {}, children: Node[] = []){
    const e=doc.createElementNS(ns,name);
    for(const k in attrs) if(attrs[k]!=null) e.setAttribute(k,String(attrs[k])); for(const c of children) e.appendChild(c);
    return e;
}
export const mk=(doc: Document, name: string, attrs?: Attrs, children?: Node[]) : Element => {
    return mkNS(doc, NS, name, attrs, children);
};
export function cellEl(doc: Document, n: string, v: unknown, f?: string|null, u?: string|null) : Element{
    return mk(doc,'Cell',{N:n,V:fmtV(v),F:f||null,U:u||null});
};
export function svgEl(n: string, a: Attrs = {}){
    const e=document.createElementNS(SVGNS,n);
    for(const k in a) if(a[k]!=null) e.setAttribute(k,String(a[k]));
    return e;
}
export const ser=(d: Document)=>{
    return new XMLSerializer().serializeToString(d.documentElement);
};
export function parseXml(t : string){
    const d=new DOMParser().parseFromString(t,'application/xml');
    if(d.getElementsByTagName('parsererror').length) throw new Error('XML parse error');
    return d;
}
/* Shortest distance from (x,y) to a set of polylines, each a list of [x,y] points */
export function distToPolyline(segs: Pt[][] | null | undefined, x: number, y: number){
  let best=Infinity;
  for(const s of segs||[]) for(let i=1;i<s.length;i++){
    const [ax,ay]=s[i-1],
        [bx,by]=s[i],
        dx :number= bx-ax,
        dy :number=by-ay,
        L :number=dx*dx+dy*dy,
        t :number=L?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/L)):0;
    best=Math.min(best,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  return best;
}
export const snapIn=(v : number)=>{
    const g=2.5*MM;
    return Math.round(v/g)*g;
};
/* A short confirmation message, shown and faded by Notify.tsx. The message itself (toastMsg) is kept even once
   hidden: the fade is a CSS transition on the "show" class, not a mount/unmount, so the old text must stay put
   under it, the same as when toast() wrote the DOM directly. */
let toastTimer : ReturnType<typeof setTimeout> | undefined;
let toastMsg='', toastVisible=false;
const toastListeners=new Set<()=>void>();

export function subscribeToast(listener : ()=>void){
    toastListeners.add(listener);
    return ()=>{ toastListeners.delete(listener); };
}
export const getToastMsg=()=>toastMsg;
export const getToastVisible=()=>toastVisible;

export function toast(msg : string, ms : number=4500){
    toastMsg=msg;
    toastVisible=true;
    toastListeners.forEach(l=>l());
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{
        toastVisible=false;
        toastListeners.forEach(l=>l());
    },ms);
}
/* A name typed by someone, or a page name, made safe to use as a file name on Windows, macOS and Linux alike */
export const safeFileName=(s : unknown)=> {
    return String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

/* Cell writes: f undefined = drop formula, string = set formula, null = keep existing formula */
const CELL_STOP=new Set(['Trigger','Section','Text','Data1','Data2','Data3','ForeignData','Shapes']);
export function setCell(el: Element, n: string, v: unknown, f?: string | null) : Element | null{
  let c=ownCell(el,n);
  if(!c){ c=el.ownerDocument.createElementNS(NS,'Cell'); c.setAttribute('N',n);
    el.insertBefore(c,[...el.children].find(x=>CELL_STOP.has(x.localName))||null); }
  c.setAttribute('V',fmtV(v)); c.removeAttribute('E');
  if(f===undefined) c.removeAttribute('F'); else if(f!==null) c.setAttribute('F',f);
  return c;
}
export function delCell(el: Element, n: string){
    const c : Element | null = ownCell(el,n);
    if(c) c.remove();
}
export function insertSection(el: Element, sec: Element) : void {
    el.insertBefore(sec,[...el.children].find(x=>['Text','Data1','Data2','Data3','ForeignData','Shapes'].includes(x.localName))||null);
}

/* Evaluate simple ShapeSheet formulas such as Width*0.5 or Width-Height*0.5 */
export function evalF(f: string | null | undefined, W: number, H: number): number | null{
    if(!f) return null;
    const s=f.replace(/GUARD\(/g,'(').replace(/\bWidth\b/g,'('+W+')').replace(/\bHeight\b/g,'('+H+')');
    if(!/^[0-9.+\-*/()\seE]+$/.test(s)) return null;
    try{
        const v=Function('"use strict";return ('+s+')')();
        return isFinite(v)?v:null;
    }
    catch(_){
        return null;
    }
}

const VISIO_COLOURS: readonly string[]=Object.values(VISIO_COLOUR);   // in the order colours.ts lists them
/* WCAG relative luminance and contrast ratio, used to keep text readable when a fill cannot be resolved */
function luminance(hex : string){
  const ch=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);
  return 0.2126*ch[0]+0.7152*ch[1]+0.0722*ch[2];
}
function contrast(a : string, b : string){
    const la=luminance(a), lb=luminance(b);
    return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05);
}
const MIN_TEXT_CONTRAST=1.5;
export function readableText(col : string, bg : string){
    if(contrast(col,bg)>=MIN_TEXT_CONTRAST) return col;
    return contrast(DEF.text,bg)>=contrast(DEF.textOnDark,bg)?DEF.text:DEF.textOnDark;
}

/* Dark or white text, whichever reads better on bg: for labels on fills the shape picks itself (a treemap's tiles) */
export function clearestText(bg: string) {
    return contrast(DEF.text, bg) >= contrast(DEF.textOnDark, bg) ? DEF.text : DEF.textOnDark;
}

export function colour<D extends string | null>(v: unknown, d: D): string | D {
    if(v==null) return d; const s=String(v).trim();
    if(/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
    if(/^\d+$/.test(s)&&+v<VISIO_COLOURS.length) return VISIO_COLOURS[+v];
    const m=s.match(/^RGB\((\d+),\s*(\d+),\s*(\d+)\)$/i);
    if(m) return '#'+[m[1],m[2],m[3]].map(x=>(+x).toString(16).padStart(2,'0')).join('').toUpperCase();
    return d;
}
