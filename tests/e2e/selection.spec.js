import {test, expect} from './fixtures.js';

test.beforeEach(async({app})=>{ await app.open(); });

test('clicking a shape selects it', async({app})=>{
  await app.click('Step A');
  await expect(app.title).toHaveText('Process');   // what the shape is; its id is in the box under it
  await expect(app.selId).toHaveValue('a1');
  await expect(app.selectionBoxes).toHaveCount(1);
});

test('clicking on a connection selects it', async({app,page})=>{
  const p=await app.connectionPoint('next');   // the a1 -> a2 connection
  await page.mouse.click(p.x,p.y+3);   // a few pixels off the line still counts
  await expect(app.title).toHaveText('Connection');
});

test('shift+click adds to and removes from the selection', async({app})=>{
  await app.click('Step A');
  await app.click('Form',{modifiers:['Shift']});
  await expect(app.title).toHaveText('2 items selected');
  await app.click('Step A',{modifiers:['Shift']});
  await expect(app.selId).toHaveValue('b1');
});

test('Ctrl+A selects everything and Escape clears it', async({app,page})=>{
  await page.keyboard.press('Control+a');
  await expect(app.title).toHaveText(/^\d+ items selected$/);
  await page.keyboard.press('Escape');
  await app.nothingSelected();
});

test('dragging a box on empty page selects only what is fully inside', async({app})=>{
  const a=await app.shape('Step A').boundingBox(), b=await app.shape('Step B').boundingBox();
  await app.drag({x:a.x-20,y:a.y-15},{x:b.x+b.width+20,y:b.y+b.height+15});
  await expect(app.title).toHaveText('3 items selected');   // two shapes and the connection between them
  await expect(app.selectionBoxes).toHaveCount(3);
});

test('Alt+click selects the shape underneath', async({app,page})=>{
  const a=await app.centreOf(app.shape('Step A')), f=await app.centreOf(app.shape('Form'));
  await app.drag(f,a);   // put Form on top of Step A
  await page.keyboard.press('Escape');
  await page.mouse.click(a.x,a.y);
  await expect(app.selId).toHaveValue('b1');
  await page.keyboard.down('Alt'); await page.mouse.click(a.x,a.y); await page.keyboard.up('Alt');
  await expect(app.selId).toHaveValue('a1');
});

test('shift+click on the page does not select text in the panels', async({app,page})=>{
  await app.click('Step A');
  await app.click('Form',{modifiers:['Shift']});
  expect(await page.evaluate(()=>String(window.getSelection()))).toBe('');
});

test.describe('connections on a filled panel',()=>{
  /* Two shapes on a filled panel, joined by a connection, and a shape added after them */
  const PANEL='flow 1\npage "Panel" size 200x100\npanel: process "Panel" @ 10,10 180x80 [fill=#E9EEF2]\n'+
    'a: process "A" @ 20,40 30x15\nb: process "B" @ 150,40 30x15\na -> b : "go"\nlater: process "Later" @ 90,70 20x10\n';
  test.beforeEach(async({app})=>{ await app.open({name:'panel.flow',mimeType:'text/plain',buffer:Buffer.from(PANEL)}); });

  test('a connection is drawn above the shapes it joins and beneath the shapes after them', async({app})=>{
    // app.shapes is in paint order; each shape's text is in its sibling #labels group, not a descendant of g itself
    const order=await app.shapes.evaluateAll(gs=>gs.map(g=>
      document.querySelector(`#labels > [data-id="${CSS.escape(g.getAttribute('data-id'))}"]`).textContent.trim()));
    expect(order).toEqual(['Panel','A','B','go','Later']);
  });

  test('clicking a connection over the panel selects the connection, not the panel', async({app,page})=>{
    const p=await app.connectionPoint('go');
    await page.mouse.click(p.x,p.y+3);
    await expect(app.title).toHaveText('Connection');
  });
});
