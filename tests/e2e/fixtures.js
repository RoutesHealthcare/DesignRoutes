import {test as base, expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const require=createRequire(import.meta.url);
/* Served in place of the CDN copy so the tests run offline and Visio export works */
const JSZIP=require.resolve('jszip/dist/jszip.min.js');
export const EXAMPLE=resolve('tests/fixtures/connection-types.flow');
/* An anonymised real-world Visio flowchart: dynamic connectors, icon masters, a line that ends on another line */
export const VISIO=resolve('tests/fixtures/visio-flowchart.vsdx');
/* Two shapes and a dynamic connector trimmed from a real diagram whose connector carries no explicit
   BeginArrow/EndArrow: both are the literal string "Themed", left for Visio's theme engine to resolve at
   display time. */
export const VISIO_THEMED=resolve('tests/fixtures/themed-arrow.vsdx');

/* Drives the editor through its UI only, so the same tests run against the source and the bundle */
/* An XPath string literal for s. XPath 1.0 has no in-literal escape for its own delimiter (no &quot;-style entity),
   so a plain "${s}" breaks on any text with a literal double quote in it (e.g. says "hi") - split on " instead and
   rejoin with concat(), each " spliced in as its own single-quoted literal. */
function xpathLiteral(s){
  if(!s.includes('"')) return `"${s}"`;
  return `concat(${s.split('"').map(p=>`"${p}"`).join(`, '"', `)})`;
}

export class FlowApp{
  constructor(page){ this.page=page; }
  get shapes(){ return this.page.locator('#layer > [data-id]'); }
  /* Every shape's own #labels group (its text, possibly several tspans for a chart with many names), in the same
     left-to-right order as #layer's shapes */
  get labels(){ return this.page.locator('#labels > [data-id]'); }
  /* A top-level shape whose text is exactly `text`. Labels live in a separate #labels layer (so a crossing
     connector can never paint over them), mirroring each shape's data-id as a sibling group, not a descendant -
     so this matches shapes by the data-id of their corresponding label rather than filtering for a nested tspan. */
  shape(text){
    const t=xpathLiteral(text);
    return this.page.locator(`xpath=//*[@id="layer"]/*[@data-id and @data-id=//*[@id="labels"]/*[.//*[local-name()="tspan"][text()=${t}]]/@data-id]`);
  }
  /* The #labels-layer group holding a shape's text, found the same way as shape() - for assertions about the text
     itself (its colour, a tspan, a rotated header) rather than the shape's drawn parts */
  label(text){
    const t=xpathLiteral(text);
    return this.page.locator(`xpath=//*[@id="labels"]/*[.//*[local-name()="tspan"][text()=${t}]]`);
  }
  async open(file=EXAMPLE){ await this.page.setInputFiles('#fileInput',file); await expect(this.shapes.first()).toBeVisible(); }
  /* Imports a file through the Import dialog; dest is new, replace or add */
  async importFile(file,dest='replace'){
    await this.page.click('#btnImport'); await this.page.setInputFiles('#importInput',file);
    await this.page.selectOption('#importDest',dest); await this.page.click('#importGo');
    await expect(this.page.locator('#importDlg')).toBeHidden();
  }
  /* Every connection's line as a list of [x,y] points */
  async connectionLines(){
    return this.page.locator('#layer > [data-id] > path[fill="none"][stroke="transparent"]').evaluateAll(ps=>ps.map(p=>
      [...p.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(m=>[+m[1],+m[2]])));
  }
  async centreOf(locator){ const b=await locator.boundingBox(); if(!b) throw new Error('not visible'); return {x:b.x+b.width/2,y:b.y+b.height/2}; }
  async click(text,{modifiers=[]}={}){
    const c=await this.centreOf(this.shape(text));
    for(const m of modifiers) await this.page.keyboard.down(m);
    await this.page.mouse.click(c.x,c.y);
    for(const m of modifiers.reverse()) await this.page.keyboard.up(m);
  }
  async drag(from,to,{steps=6}={}){ const m=this.page.mouse; await m.move(from.x,from.y); await m.down(); await m.move(to.x,to.y,{steps}); await m.up(); }
  /* Screen position halfway along the line of the connection labelled `label` */
  async connectionPoint(label){
    return this.shape(label).locator(':scope > path[fill="none"][stroke="transparent"]').evaluate(p=>{
      const pt=p.getPointAtLength(p.getTotalLength()/2), m=p.getScreenCTM(); return {x:pt.x*m.a+pt.y*m.c+m.e,y:pt.x*m.b+pt.y*m.d+m.f}; });
  }
  get title(){ return this.page.locator('#selTitle'); }
  /* the selected shape's Id box: its id, while the title above it says what kind of shape it is */
  get selId(){ return this.page.locator('#pId'); }
  /* one per selected item: an outline round a shape, or a highlight along a line */
  get selectionBoxes(){ return this.page.locator('#overlay .selbox, #overlay .selline'); }
  get textEditor(){ return this.page.locator('#textEditor'); }
  async nothingSelected(){ await expect(this.page.locator('#propsShape')).toBeHidden(); }
  /* The diagram as .flow text, from the text pane */
  async flowText(){ await this.page.keyboard.press('Control+e'); const t=await this.page.locator('#codeText').inputValue(); await this.page.keyboard.press('Control+e'); return t; }
}

export const test=base.extend({
  appUrl:['',{option:true}],
  /* false makes the page behave like a first visit, so the guided tour opens by itself */
  tourSeen:[true,{option:true}],
  app:async({page,appUrl,tourSeen},use)=>{
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/jszip.min.js',r=>r.fulfill({path:JSZIP,contentType:'text/javascript'}));
    if(tourSeen) await page.addInitScript(()=>{ try{ localStorage.setItem('flowEditor.tourSeen','1'); }catch(_){} });
    await page.goto(appUrl);
    await expect(page.locator('html[data-ready]')).toBeAttached();
    await use(new FlowApp(page));
    expect(errors,'uncaught errors in the page').toEqual([]);
  },
});
export {expect};
