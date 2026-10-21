import {test, expect} from './fixtures.js';

/* Opens a .flow document given as text */
const openFlow=(app,text)=>app.open({name:'wireframe.flow',mimeType:'text/plain',buffer:Buffer.from(text)});
/* Clicks a palette button, opening its (collapsed) group first */
async function addFromPalette(page,kind){
    const b=page.locator(`.palette [data-kind="${kind}"]`);
    if(!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
}

test('radio buttons and progress rings come from the palette and the text', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nr1: radio "Monthly"\np1: progress "40%"\np2: ring "Loading"\n');
    await expect(app.shape('Monthly')).toHaveCount(1);
    await expect(app.shape('40%')).toHaveCount(1);
    // the filled band is only drawn when the label carries a percentage
    const bands=t=>app.shape(t).locator('path[fill="#1F6F78"]');
    await expect(bands('40%')).toHaveCount(1);
    await expect(bands('Loading')).toHaveCount(0);
    await addFromPalette(page,'radio');
    await addFromPalette(page,'progress');
    const text=await app.flowText();
    expect(text).toMatch(/: radio "Option"/);
    expect(text).toMatch(/: progress "75%"/);
    expect(text).toContain('p2: ring "Loading"');   // lines that did not change are left as typed, aliases included
});

test('editing a progress ring\'s label redraws its band', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\np1: progress "25%"\n');
    const band=()=>app.shapes.first().locator('path[fill="#1F6F78"]').getAttribute('d');
    const quarter=await band();
    await app.click('25%'); await app.click('25%');
    await page.keyboard.type('90%'); await page.keyboard.press('Control+Enter');
    await expect(app.shape('90%')).toHaveCount(1);
    expect(await band()).not.toEqual(quarter);
});

/* A w x h PNG of one colour, made in the page */
const makePng=async(page,w,h,colour)=>Buffer.from(await page.evaluate(([w,h,colour])=>{
    const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.fillStyle=colour; x.fillRect(0,0,w,h);
    return c.toDataURL('image/png').split(',')[1]; },[w,h,colour]),'base64');

test('an image shape shows a chosen picture, and swapping it drops the old one from the text', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ni1: image "Logo" @ 10,10 40x40\n');
    await app.click('Logo');
    await expect(page.locator('#pImage')).toHaveText('Choose picture…');
    await page.setInputFiles('#imageInput',{name:'logo.png',mimeType:'image/png',buffer:await makePng(page,80,40,'#C0392B')});
    await expect(app.shape('Logo').locator('image')).toHaveCount(1);
    let text=await app.flowText();
    expect(text).toMatch(/^icon logo "data:image\/png;base64,/m);
    expect(text).toContain('i1: image "Logo" @ 10,10 40x20 [icon=logo]');   // keeps its width, takes the picture's proportions
    await expect(page.locator('#pImage')).toHaveText('Change picture…');

    await page.setInputFiles('#imageInput',{name:'logo.png',mimeType:'image/png',buffer:await makePng(page,40,40,'#2471A3')});
    await expect.poll(()=>app.flowText()).toContain('[icon=logo_2]');   // the picture is read asynchronously, so wait for the swap
    text=await app.flowText();
    expect(text).not.toMatch(/^icon logo "/m);
    expect(text).toMatch(/^icon logo_2 "data:image\/png;base64,/m);
    expect(text).toContain('i1: image "Logo" @ 10,10 40x40 [icon=logo_2]');

    await page.keyboard.press('Control+z');   // one undo step brings the first picture back, data and all
    text=await app.flowText();
    expect(text).toMatch(/^icon logo "/m);
    expect(text).toContain('[icon=logo]');
});

test('dropping a picture file on the page adds an image shape showing it', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\na: process "Step"\n');
    const data=(await makePng(page,96,48,'#1F6F78')).toString('base64'), box=await page.locator('#stage').boundingBox();
    await page.locator('#stage').evaluate((stage,[data,x,y])=>{
        const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)), dt=new DataTransfer();
        dt.items.add(new File([bytes],'Team photo.png',{type:'image/png'}));
        stage.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,clientX:x,clientY:y,bubbles:true,cancelable:true}));
    },[data,box.x+box.width/2,box.y+box.height/2]);
    await expect(page.locator('#layer image')).toHaveCount(1);
    const text=await app.flowText();
    expect(text).toMatch(/^icon team_photo "data:image\/png;base64,/m);
    expect(text).toMatch(/^team_photo: image @ [\d.]+,[\d.]+ 25\.4x12\.7 \[icon=team_photo\]$/m);   // 96 x 48 px at 96 per inch
    await expect(page.locator('#pId')).toHaveValue('team_photo');
});

test('a photo too big to keep as it is gets scaled down', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ni1: image "Big" @ 10,10 40x40\n');
    // random noise compresses badly, so a 1600 px square comes out far over the size kept in the text
    const noise=Buffer.from(await page.evaluate(()=>{
        const c=document.createElement('canvas'); c.width=c.height=1600; const x=c.getContext('2d'), d=x.createImageData(1600,1600);
        for(let i=0;i<d.data.length;i++) d.data[i]=i%4===3?255:Math.random()*256;
        x.putImageData(d,0,0); return c.toDataURL('image/png').split(',')[1]; }),'base64');
    await app.click('Big');
    await page.setInputFiles('#imageInput',{name:'noise.png',mimeType:'image/png',buffer:noise});
    await expect(app.shape('Big').locator('image')).toHaveCount(1);
    const line=(await app.flowText()).split('\n').find(l=>l.startsWith('icon noise '));
    expect(line.length).toBeLessThan(620000);
});

const GRID_LINE='g1: grid { Name, "Role, team", Notes; Ann, Admin, ""; Bob, User, "says \\"hi\\"" } @ 20,20';

test('a grid draws one cell per entry, and an unrelated edit leaves its line exactly as typed', async({app,page})=>{
    await openFlow(app,`flow 1\npage "UI"\n${GRID_LINE}\na: process "Step" @ 150,20\n`);
    for(const t of ['Name','Role, team','Notes','Ann','Admin','Bob','User','says "hi"']) await expect(app.shape(t)).toHaveCount(1);
    expect(await app.shape('Ann').locator('text').count()).toBe(8);   // the empty cell has no text
    const c=await app.centreOf(app.shape('Step'));
    await app.drag(c,{x:c.x+40,y:c.y});
    const text=await app.flowText();
    expect(text).toContain(GRID_LINE+'\n');
    expect(text).not.toContain('a: process "Step" @ 150,20\n');
});

test('rows and columns are added and removed from the properties panel, in one undo step each', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ng1: grid { A, B; 1, 2 } @ 20,20\n');
    await app.click('A');
    await expect(app.title).toHaveText('Grid table');
    await expect(app.selId).toHaveValue('g1');
    await expect(page.locator('#gridBtns')).toBeVisible();
    await page.click('#pAddRow');
    expect(await app.flowText()).toMatch(/g1: grid \{ A, B; 1, 2; "", "" \} @ 20,20/);
    await page.click('#pAddCol');
    expect(await app.flowText()).toMatch(/g1: grid \{ A, B, Column 3; 1, 2, ""; "", "", "" \} @ 20,20 [\d.]+x22\.9\n/);   // a third row of 7.6 mm, so 22.9 mm high
    await expect(app.shape('Column 3')).toHaveCount(1);
    await page.click('#pDelCol'); await page.click('#pDelRow');
    expect(await app.flowText()).toMatch(/g1: grid \{ A, B; 1, 2 \} @ 20,20/);
    await page.click('#pDelRow');
    expect(await app.flowText()).toMatch(/g1: grid \{ A, B \} @ 20,20/);
    await page.click('#pDelRow');
    await expect(page.locator('#toast')).toContainText('at least one row');
    await page.keyboard.press('Control+z');
    expect(await app.flowText()).toMatch(/g1: grid \{ A, B; 1, 2 \} @ 20,20/);
});

test('a grid cell is edited on the page, and a grid comes from the palette', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ng1: grid { A, B; 1, 2 } @ 20,20\n');
    const c=await app.centreOf(app.shape('2').locator('tspan',{hasText:/^2$/}));
    await page.mouse.dblclick(c.x,c.y);
    await expect(app.textEditor).toHaveValue('2');
    await page.keyboard.type('Two'); await page.keyboard.press('Control+Enter');
    expect(await app.flowText()).toContain('g1: grid { A, B; 1, Two } @ 20,20');
    await addFromPalette(page,'grid');
    expect(await app.flowText()).toMatch(/: grid \{ Name, Status, Date; Item 1, Open, 01\/02; Item 2, Done, 03\/04 \} @/);
});

test('a connection to a grid stays attached when a column is added', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ng1: grid { A, B; 1, 2 } @ 20,20\na: process "Step" @ 20,80\na -> g1 : "feeds"\n');
    await app.click('A'); await page.click('#pAddCol');
    const text=await app.flowText();
    expect(text).toContain('a -> g1 : "feeds"');
    await expect(app.shape('feeds')).toHaveCount(1);
});

test('a grid keeps its cells through Mermaid and back', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ng1: grid { A, B; 1, 2 } @ 20,20\n');
    await page.keyboard.press('Control+e');
    await page.selectOption('#tpLang','mermaid');
    const mermaid=await page.locator('#codeText').inputValue();
    await page.selectOption('#tpLang','flow'); await page.keyboard.press('Control+e');
    await app.importFile({name:'grid.mmd',mimeType:'text/plain',buffer:Buffer.from(mermaid)},'new');
    expect((await app.flowText()).match(/: grid \{ A, B; 1, 2 \}/g)).toHaveLength(2);   // the original, and the one on the imported page
});

test('editing a grid\'s cells in the Mermaid view and applying it changes the grid', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ng1: grid { A, B; 1, 2 } @ 20,20\n');
    await page.keyboard.press('Control+e');
    await page.selectOption('#tpLang','mermaid');
    const code=page.locator('#codeText');
    await code.fill((await code.inputValue()).replace('1 | 2','1 | 3'));
    await page.click('#tpApply');
    await page.selectOption('#tpLang','flow');
    expect(await code.inputValue()).toMatch(/g1: grid \{ A, B; 1, 3 \}/);
});

test('a picture survives copy and paste; a grid, like any group, is not copied', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ng1: grid { A, B; 1, 2 } @ 20,20\ni1: image "Pic" @ 100,20 40x40\n');
    await app.click('A'); await page.keyboard.press('Control+c');
    await expect(page.locator('#toast')).toContainText('not groups');
    await app.click('Pic');
    await page.setInputFiles('#imageInput',{name:'pic.png',mimeType:'image/png',buffer:await makePng(page,40,40,'#2471A3')});
    await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');   // the image is still selected
    const text=await app.flowText();
    expect(text.match(/: image "Pic" .*\[icon=pic\]/g)).toHaveLength(2);
    expect(text.match(/^icon pic /gm)).toHaveLength(1);   // the copy shares the picture
    await expect(page.locator('#layer image')).toHaveCount(2);
});

test('a PNG export includes pictures, JPEG ones too', async({app,page},testInfo)=>{
    await openFlow(app,'flow 1\npage "UI" size 120x60\ni1: image "Pic" @ 10,10 40x40\n');
    // a noisy picture is stored as a JPEG; a solid red square in its middle checks it reaches the export
    const jpeg=Buffer.from(await page.evaluate(()=>{
        const c=document.createElement('canvas'); c.width=c.height=1200; const x=c.getContext('2d'), d=x.createImageData(1200,1200);
        for(let i=0;i<d.data.length;i++) d.data[i]=i%4===3?255:Math.random()*256;
        x.putImageData(d,0,0); x.fillStyle='#FF0000'; x.fillRect(400,400,400,400); return c.toDataURL('image/png').split(',')[1]; }),'base64');
    await app.click('Pic');
    await page.setInputFiles('#imageInput',{name:'photo.png',mimeType:'image/png',buffer:jpeg});
    expect(await app.flowText()).toMatch(/^icon photo "data:image\/jpeg;base64,/m);
    await page.click('#btnExport');
    await page.selectOption('#exportFmt','png');
    const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#exportDownload')]);
    const file=testInfo.outputPath('pic.png'); await dl.saveAs(file);
    const centre=await page.evaluate(async b64=>{
        const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
        const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0);
        // the picture's centre is 30 mm from the left and top of a 120 x 60 mm page
        return [...x.getImageData(Math.round(img.width*30/120),Math.round(img.height*30/60),1,1).data];
    },(await import('node:fs')).readFileSync(file).toString('base64'));
    expect(centre[0]).toBeGreaterThan(200); expect(centre[1]).toBeLessThan(60); expect(centre[2]).toBeLessThan(60);
});

/* filled paths drawn in the chart's teal: one per bar, or the area, or every other pie slice */
const tealParts=(app,title)=>app.shape(title).locator('path[fill="#1F6F78"]');
/* filled paths of any colour: pie slices, funnel bands and polar wedges each take a series colour. A chart or
   frame's backdrop ([bg=], on by default) isn't one of them. */
const filledParts = (app, title) => app.shape(title).locator('path[fill]:not([fill="none"]):not([fill="transparent"]):not([data-bg])');
const fillsOf=async(app,title)=>filledParts(app,title).evaluateAll(ps=>ps.map(p=>p.getAttribute('fill')));

test('charts draw their own values, or a sample when they have none', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nb1: bar "Sales" { 3, 0, 5 }\nb2: column "Sample"\np1: pie "Share" { 50, 30, 20 }\nd1: donut "Devices" { 1, 1, 1, 1 }\n');
    await expect(tealParts(app,'Sales')).toHaveCount(2);      // a zero draws no bar
    await expect(tealParts(app,'Sample')).toHaveCount(5);     // the sample has five
    await expect(filledParts(app,'Share')).toHaveCount(3);    // every slice is filled, each its own colour
    await expect(filledParts(app,'Devices')).toHaveCount(4);
    const text=await app.flowText();
    expect(text).toContain('b2: column "Sample"\n');           // no values written for a sample
});

test('a chart\'s values are edited in the properties panel, in one undo step', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nb1: bar "Sales" @ 10,10\n');
    await app.click('Sales');
    await expect(page.locator('#pValues')).toHaveValue('4, 7, 5, 9, 6');
    await page.locator('#pValues').fill('2 8'); await page.locator('#pValues').press('Enter');
    await page.locator('#pValues').blur();
    await expect(tealParts(app,'Sales')).toHaveCount(2);
    expect(await app.flowText()).toContain('b1: bar "Sales" { 2, 8 } @ 10,10');
    await page.locator('#pValues').fill('2, lots'); await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('numbers of 0 or more');
    expect(await app.flowText()).toContain('b1: bar "Sales" { 2, 8 } @ 10,10');
    await page.keyboard.press('Control+z');
    expect(await app.flowText()).toContain('b1: bar "Sales" @ 10,10');
});

test('a chart with values that are not numbers is an error in the text', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\na: process "Step"\nb1: bar "Sales" { 3, x }\n');
    await expect(page.locator('#tpStatus')).toContainText('numbers of 0 or more');
});

test('a bubble chart draws one filled circle per bubble, from x, y, size threes', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nb1: bubble "Reach" { 2, 3, 4; 4, 7, 9; 6, 4, 0 } @ 10,10\nb2: bubble "Sample"\n');
    await expect(tealParts(app,'Reach')).toHaveCount(2);      // a size of 0 draws no bubble
    await expect(tealParts(app,'Sample')).toHaveCount(4);     // the sample has four
    expect(await app.flowText()).toContain('b1: bubble "Reach" { 2, 3, 4; 4, 7, 9; 6, 4, 0 } @ 10,10');
    await app.click('Reach');
    await expect(page.locator('#pValues')).toHaveValue('2, 3, 4; 4, 7, 9; 6, 4, 0');
    await page.locator('#pValues').fill('1 2 3 4 5 6'); await page.locator('#pValues').blur();
    await expect(tealParts(app,'Reach')).toHaveCount(2);
    expect(await app.flowText()).toContain('b1: bubble "Reach" { 1, 2, 3; 4, 5, 6 } @ 10,10');
    await page.locator('#pValues').fill('1, 2'); await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('three numbers per bubble');
    expect(await app.flowText()).toContain('b1: bubble "Reach" { 1, 2, 3; 4, 5, 6 } @ 10,10');
});

test('a histogram draws its bars touching, with no gaps between them', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nh1: histogram "Ages" { 2, 5, 0, 4 }\nh2: histogram "Sample"\n');
    await expect(tealParts(app,'Ages')).toHaveCount(3);       // a zero leaves an empty slot
    await expect(tealParts(app,'Sample')).toHaveCount(7);
    const boxes=(await tealParts(app,'Sample').evaluateAll(ps=>ps.map(p=>{ const b=p.getBoundingClientRect(); return [b.left,b.right]; }))).sort((a,b)=>a[0]-b[0]);
    for(let i=1;i<boxes.length;i++) expect(Math.abs(boxes[i][0]-boxes[i-1][1])).toBeLessThan(1);
    expect(await app.flowText()).toContain('h1: histogram "Ages" { 2, 5, 0, 4 }');
});

test('pie slices take series colours, the first being the chart\'s own fill', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\np1: pie "Share" { 5, 0, 3, 2, 1, 1, 1, 1 } @ 10,10\np2: pie "Own" { 1, 1 } @ 70,10 [fill=#AA3377]\n');
    const share=await fillsOf(app,'Share');
    expect(share).toHaveLength(7);                             // the 0 draws no slice
    expect(share[0]).toBe('#1F6F78');
    for(let i=1;i<share.length;i++) expect(share[i]).not.toBe(share[i-1]);   // neighbours always differ
    expect(new Set(share.slice(0,6)).size).toBe(6);
    expect((await fillsOf(app,'Own'))[0]).toBe('#AA3377');     // [fill=] still colours the chart
    expect(await app.flowText()).toContain('p2: pie "Own" { 1, 1 } @ 70,10 [fill=#AA3377]');
});

test('a waterfall fills its rises and outlines its falls, and takes values below 0', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nw1: waterfall "Profit" { 10, 4, -3, 0, 5 } @ 10,10\nw2: waterfall "Sample" @ 70,10\n');
    await expect(tealParts(app,'Profit')).toHaveCount(3);      // 10, 4 and 5; the fall is outlined and a 0 draws nothing
    await expect(tealParts(app,'Sample')).toHaveCount(3);
    expect(await app.flowText()).toContain('w1: waterfall "Profit" { 10, 4, -3, 0, 5 } @ 10,10');
    await app.click('Profit');
    await page.locator('#pValues').fill('5, -8, 2'); await page.locator('#pValues').blur();
    expect(await app.flowText()).toContain('w1: waterfall "Profit" { 5, -8, 2 } @ 10,10');
    await expect(tealParts(app,'Profit')).toHaveCount(2);
});

test('only a waterfall takes values below 0', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\na: process "Step"\nb1: bar "Sales" { 3, -1 }\n');
    await expect(page.locator('#tpStatus')).toContainText('numbers of 0 or more');
});

test('a funnel draws one band per stage, each its own colour', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nf1: funnel "Sales" { 100, 60, 30 } @ 10,10\nf2: funnel "Sample" @ 70,10\n');
    await expect(filledParts(app,'Sales')).toHaveCount(3);
    await expect(filledParts(app,'Sample')).toHaveCount(4);
    expect(new Set(await fillsOf(app,'Sales')).size).toBe(3);
    const [wide,narrow]=await filledParts(app,'Sales').evaluateAll(ps=>ps.map(p=>p.getBoundingClientRect()).sort((a,b)=>a.top-b.top).map(b=>b.width));
    expect(wide).toBeGreaterThan(narrow);
    expect(await app.flowText()).toContain('f1: funnel "Sales" { 100, 60, 30 } @ 10,10');
});

/* the boxes of a chart's filled parts, as page rectangles, with their fill */
const partBoxes = (app, title) => filledParts(app, title).evaluateAll(ps => ps.map(p => {
    const b = p.getBoundingClientRect();
    return {fill: p.getAttribute('fill'), left: b.left, right: b.right, top: b.top, bottom: b.bottom};
}));

test('a bar chart with a row of values per series draws them side by side, and the rows survive an unrelated edit', async ({
                                                                                                                               app,
                                                                                                                               page
                                                                                                                           }) => {
    const LINE = 'b1: bar "Sales" { 3, 5, 2; 4, 1, 6 } @ 10,10';
    await openFlow(app, `flow 1\npage "BI"\n${LINE}\na: process "Step" @ 150,20\n`);
    const fills = await fillsOf(app, 'Sales');
    expect(fills).toHaveLength(6);
    expect(fills.filter(f => f === '#1F6F78')).toHaveLength(3);   // the first series is the chart's own fill
    expect(fills.filter(f => f === '#C9781C')).toHaveLength(3);   // the second the first palette colour
    const c = await app.centreOf(app.shape('Step'));
    await app.drag(c, {x: c.x + 40, y: c.y});
    expect(await app.flowText()).toContain(LINE + '\n');
    await app.click('Sales');
    await expect(page.locator('#pValues')).toHaveValue('3, 5, 2; 4, 1, 6');
    await page.locator('#pValues').fill('1 2; 3 4; 5 6');
    await page.locator('#pValues').blur();
    expect(await app.flowText()).toContain('b1: bar "Sales" { 1, 2; 3, 4; 5, 6 } @ 10,10');
    expect(new Set(await fillsOf(app, 'Sales')).size).toBe(3);
    await page.locator('#pValues').fill('1, 2; 3');
    await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('every row the same length');
    expect(await app.flowText()).toContain('b1: bar "Sales" { 1, 2; 3, 4; 5, 6 } @ 10,10');
});

test('series rows must be the same length, and only some charts take more than one', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step"\nb1: bar "Sales" { 3, 5; 4 }\n');
    await expect(page.locator('#tpStatus')).toContainText('every row the same length');
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step"\np1: pie "Share" { 3, 5; 4, 1 }\n');
    await expect(page.locator('#tpStatus')).toContainText('shows one series');
});

test('a line chart draws a line per series, each in its series colour', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\nl1: line "Trend" { 1, 2, 3; 3, 2, 1; 2, 2, 2 } @ 10,10\nl2: line "One" { 1, 3, 2 } @ 70,10\n');
    const strokes = t => app.shape(t).locator('path[fill="none"][data-sec]').evaluateAll(ps => ps.map(p => p.getAttribute('stroke')));
    const trend = await strokes('Trend');
    expect(trend.slice(1, 4)).toEqual(['#2B3A47', '#C9781C', '#4A6FB5']);   // after the frame; the first keeps the chart's line colour
    expect(new Set(await strokes('One')).size).toBe(1);                     // one series: one colour, as before
    expect(await app.flowText()).toContain('l1: line "Trend" { 1, 2, 3; 3, 2, 1; 2, 2, 2 } @ 10,10');
});

test('area and radar charts overlap their series, the biggest at the back, each outlined in its colour', async ({
                                                                                                                    app,
                                                                                                                    page
                                                                                                                }) => {
    await openFlow(app, 'flow 1\npage "BI"\na1: area "Visits" { 1, 2, 1; 3, 4, 3 } @ 10,10\nr1: radararea "Reach" { 5, 3, 4; 2, 4, 2 } @ 70,10\nr2: radar "Skills" { 5, 3, 4; 2, 4, 2 } @ 130,10\na2: area "One" { 1, 3, 2 } @ 10,60\n');
    expect(await fillsOf(app, 'Visits')).toEqual(['#C9781C', '#1F6F78']);   // the bigger second series drawn first, at the back
    expect(await fillsOf(app, 'Reach')).toEqual(['#1F6F78', '#C9781C']);
    const outlines = t => app.shape(t).locator('path[fill="none"][data-sec]').evaluateAll(ps => ps.map(p => p.getAttribute('stroke')));
    expect((await outlines('Visits')).slice(-3, -1)).toEqual(['#2B3A47', '#C9781C']);   // before the axes; the first keeps the line colour
    await expect(filledParts(app, 'Skills')).toHaveCount(6);                 // a dot per value per series, in its colour
    expect(new Set(await fillsOf(app, 'Skills')).size).toBe(2);
    await expect(filledParts(app, 'One')).toHaveCount(1);                    // one series: just the fill, as before
    const text = await app.flowText();
    expect(text).toContain('a1: area "Visits" { 1, 2, 1; 3, 4, 3 } @ 10,10');
    expect(text).toContain('r2: radar "Skills" { 5, 3, 4; 2, 4, 2 } @ 130,10');
});

test('stacked bars put each series on the one before; 100% bars all reach the same height', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\ns1: stackedbar "Mix" { 3, 1; 1, 3 } @ 10,10\ns2: percentbar "Share" { 1, 3; 1, 1 } @ 70,10\ns3: stackedhbar "Lying" @ 10,60\n');
    const mix = await partBoxes(app, 'Mix');
    expect(mix).toHaveLength(4);
    const [first, second] = mix.filter(b => Math.abs(b.left - mix[0].left) < 1);   // the first category's two parts
    expect(Math.abs(first.right - second.right)).toBeLessThan(1);            // stacked, not side by side
    expect(Math.abs(second.bottom - first.top)).toBeLessThan(1);             // the second starts where the first ends
    expect(first.fill).not.toBe(second.fill);
    const share = await partBoxes(app, 'Share'), tops = share.map(b => b.top);
    expect(Math.max(...tops) - Math.min(...tops.filter(t => t < Math.max(...tops) - 1))).toBeGreaterThan(1);   // splits differ...
    const cats = [...new Set(share.map(b => Math.round(b.left)))];
    const heights = cats.map(l => {
        const bs = share.filter(b => Math.round(b.left) === l);
        return Math.max(...bs.map(b => b.bottom)) - Math.min(...bs.map(b => b.top));
    });
    expect(Math.abs(heights[0] - heights[1])).toBeLessThan(1);               // ...but every bar is the whole
    await expect(filledParts(app, 'Lying')).toHaveCount(12);                 // the sample: three series of four
    expect(await app.flowText()).toContain('s3: stackedhbar "Lying" @ 10,60\n');
});

test('stacked areas draw a band per series, each its own colour', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\na1: stackedarea "Visits" { 3, 4, 5; 2, 2, 1 } @ 10,10\na2: percentarea "Split" @ 70,10\n');
    expect(new Set(await fillsOf(app, 'Visits')).size).toBe(2);
    expect(new Set(await fillsOf(app, 'Split')).size).toBe(3);
    expect(await app.flowText()).toContain('a1: stackedarea "Visits" { 3, 4, 5; 2, 2, 1 } @ 10,10');
});

test('a radar chart joins its values round a circle, as a line or a filled area', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nr1: radar "Skills" { 5, 3, 4, 2, 5 } @ 10,10\nr2: radararea "Reach" { 5, 3, 4 } @ 70,10\nr3: spider "Sample" @ 130,10\n');
    await expect(tealParts(app,'Skills')).toHaveCount(5);      // the line isn't filled; a dot marks each value
    await expect(tealParts(app,'Reach')).toHaveCount(1);
    const text=await app.flowText();
    expect(text).toContain('r1: radar "Skills" { 5, 3, 4, 2, 5 } @ 10,10');
    expect(text).toContain('r3: spider "Sample" @ 130,10');    // the alias is kept as typed
});

test('a polar chart draws one wedge per value, each its own colour, longer for bigger values', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\np1: polar "Wind" { 9, 4, 1, 0 } @ 10,10\np2: rose "Sample" @ 70,10\n');
    await expect(filledParts(app,'Wind')).toHaveCount(3);      // a 0 draws no wedge
    await expect(filledParts(app,'Sample')).toHaveCount(8);
    const [big,,small]=await filledParts(app,'Wind').evaluateAll(ps=>ps.map(p=>{ const b=p.getBoundingClientRect(); return b.width*b.height; }));
    expect(big).toBeGreaterThan(small*4);
    expect(await app.flowText()).toContain('p1: polar "Wind" { 9, 4, 1, 0 } @ 10,10');
});

test('a spiral chart winds its values outwards, twelve a turn, alternately filled', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\ns1: spiral "Visits" { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 } @ 10,10\ns2: spiral "Sample" @ 70,10\n');
    await expect(tealParts(app,'Visits')).toHaveCount(7);
    await expect(tealParts(app,'Sample')).toHaveCount(12);
    // the 13th value sits a turn further out than the 1st, beside it at the top
    const tops=await tealParts(app,'Visits').evaluateAll(ps=>ps.map(p=>p.getBoundingClientRect().top));
    expect(tops[6]).toBeLessThan(tops[0]);
    expect(await app.flowText()).toContain('s1: spiral "Visits" { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 } @ 10,10');
});

test('a scatter chart draws one dot per x, y pair', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\ns1: scatter "Height" { 1, 2; 3, 5; 4, 4 } @ 10,10\ns2: scatter "Sample"\n');
    await expect(tealParts(app,'Height')).toHaveCount(3);
    await expect(tealParts(app,'Sample')).toHaveCount(7);     // the sample has seven
    expect(await app.flowText()).toContain('s1: scatter "Height" { 1, 2; 3, 5; 4, 4 } @ 10,10');
    await app.click('Height');
    await expect(page.locator('#pValues')).toHaveValue('1, 2; 3, 5; 4, 4');
    await page.locator('#pValues').fill('1, 2, 3'); await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('two numbers per dot');
});

test('a bubble chart whose values are not in threes is an error in the text', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\na: process "Step"\nb1: bubble "Reach" { 2, 3, 4; 5 }\n');
    await expect(page.locator('#tpStatus')).toContainText('three numbers per bubble');
});

test('a candlestick chart fills rising candles and outlines falling ones, from fours of values', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nc1: candlestick "Price" { 5, 8, 4, 7; 7, 9, 3, 4; 4, 6, 4, 6 } @ 10,10\nc2: ohlc "Sample" @ 70,10\n');
    await expect(tealParts(app,'Price')).toHaveCount(2);       // the second candle fell
    await expect(tealParts(app,'Sample')).toHaveCount(3);
    expect(await app.flowText()).toContain('c1: candlestick "Price" { 5, 8, 4, 7; 7, 9, 3, 4; 4, 6, 4, 6 } @ 10,10');
    await app.click('Price');
    await page.locator('#pValues').fill('1, 2, 3'); await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('four numbers per candle');
});

test('a box plot draws a filled box per five values, and its numbers must rise', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\nb1: boxplot "Times" { 2, 4, 5, 7, 9; 4, 6, 8, 9, 11 } @ 10,10\nb2: whisker "Sample" @ 70,10\n');
    await expect(tealParts(app, 'Times')).toHaveCount(2);
    await expect(tealParts(app, 'Sample')).toHaveCount(3);
    expect(await app.flowText()).toContain('b1: boxplot "Times" { 2, 4, 5, 7, 9; 4, 6, 8, 9, 11 } @ 10,10');
    await app.click('Times');
    await page.locator('#pValues').fill('1, 2, 3');
    await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('five numbers per box');
    await page.locator('#pValues').fill('5, 4, 3, 2, 1');
    await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('from smallest to largest');
});

test('a heatmap draws a cell per value, the highest in its fill and lower ones paler', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\nh1: heatmap "Load" { 1, 5; 9, 3 } @ 10,10\nh2: heatgrid "Sample" @ 70,10\n');
    const fills = await fillsOf(app, 'Load'),
        light = f => [1, 3, 5].reduce((t, i) => t + parseInt(f.slice(i, i + 2), 16), 0);
    expect(fills).toHaveLength(4);                               // the frame isn't filled
    expect(fills[2]).toBe('#1F6F78');                            // 9, the highest, in the chart's fill
    expect(light(fills[0])).toBeGreaterThan(light(fills[3]));    // 1 paler than 3
    expect(light(fills[3])).toBeGreaterThan(light(fills[1]));    // 3 paler than 5
    expect(await fillsOf(app, 'Sample')).toHaveLength(24);
    expect(await app.flowText()).toContain('h1: heatmap "Load" { 1, 5; 9, 3 } @ 10,10');
    await app.click('Load');
    await page.locator('#pValues').fill('1, 2; 3');
    await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('same number of cells');
});

test('a sparkline is a line with no frame, a dot on its latest value and its label beside it', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\ns1: sparkline "Sales" { 3, 9, 4, 6 } @ 10,10\ns2: spark "Sample" @ 10,30\n');
    const dot=tealParts(app,'Sales');
    await expect(dot).toHaveCount(1);
    await expect(tealParts(app,'Sample')).toHaveCount(1);
    const end=await dot.boundingBox(), label=await app.shape('Sales').locator('text').boundingBox();
    expect(label.x).toBeGreaterThan(end.x+end.width);       // the label is beside the line's end, not over it
    expect(await app.flowText()).toContain('s1: sparkline "Sales" { 3, 9, 4, 6 } @ 10,10');
});

test('a bullet chart fills to its value and marks its target', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nb1: bullet "Sales" { 30, 90 } @ 10,10\nb2: bullet "Over" { 90, 30 } @ 10,30\n');
    const parts=async t=>(await tealParts(app,t).evaluateAll(ps=>ps.map(p=>p.getBoundingClientRect()))).sort((a,b)=>b.height-a.height);
    const [markS,barS]=await parts('Sales'), [markO,barO]=await parts('Over');   // the mark is the taller part
    expect(markS.left).toBeGreaterThan(barS.right);          // short of the target
    expect(markO.right).toBeLessThan(barO.right);            // past it
    expect(await app.flowText()).toContain('b1: bullet "Sales" { 30, 90 } @ 10,10');
    await app.click('Sales');
    await page.locator('#pValues').fill('1, 2, 3'); await page.locator('#pValues').blur();
    await expect(page.locator('#toast')).toContainText('two numbers of 0 or more (value, target)');
});

test('a bullet chart takes exactly a value and a target', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\na: process "Step"\nb1: bullet "Sales" { 30 }\n');
    await expect(page.locator('#tpStatus')).toContainText('two numbers of 0 or more (value, target)');
});

test('a gauge fills its half dial to the percentage in its label', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\ng1: dial "25%" @ 10,10\ng2: dial "100%" @ 60,10\ng3: speedometer "Speed" @ 110,10\n');
    await expect(tealParts(app,'Speed')).toHaveCount(0);       // no percentage, no fill
    const quarter=await tealParts(app,'25%').boundingBox(), full=await tealParts(app,'100%').boundingBox();
    expect(quarter.width).toBeLessThan(full.width/2);          // a quarter of the way round reaches less than half across
    expect(full.width).toBeGreaterThan(full.height*1.8);       // a half circle: twice as wide as it is tall
    expect(await app.flowText()).toContain('g3: speedometer "Speed" @ 110,10');
});

test('a KPI card shows its figure large, above its caption, and BI shapes come from the palette', async({app,page})=>{
    await openFlow(app,'flow 1\npage "BI"\nk1: kpi "£12.4k\\nRevenue"\n');
    const sizes=await app.shapes.first().locator('text').evaluateAll(ts=>ts.map(t=>[t.textContent,+t.getAttribute('font-size'),t.getAttribute('font-weight')]));
    expect(sizes[0][0]).toBe('£12.4k'); expect(sizes[1][0]).toBe('Revenue');
    expect(sizes[0][1]).toBeCloseTo(sizes[1][1]*2,1); expect(sizes[0][2]).toBe('bold');
    const BI = ['bar', 'hbar', 'stackedbar', 'stackedhbar', 'percentbar', 'percenthbar', 'histogram', 'waterfall', 'funnel', 'line', 'area', 'stackedarea', 'percentarea', 'radar', 'radararea', 'polar', 'spiral', 'pie', 'donut', 'scatter', 'bubble', 'candlestick', 'boxplot', 'heatmap', 'gantt', 'treemap', 'wordcloud', 'sankey', 'chord', 'tilemap', 'worldmap', 'countrymap', 'routemap', 'sparkline', 'bullet', 'dial', 'kpi', 'legend', 'legendrow'];
    for (const k of BI) await addFromPalette(page, k);
    const text=await app.flowText();
    for (const k of BI) expect(text).toMatch(new RegExp(`: ${k} "`));
});

test('a legend draws a square per name in its label, each in its series colour, the first the shape\'s fill', async ({
                                                                                                                         app,
                                                                                                                         page
                                                                                                                     }) => {
    await openFlow(app, 'flow 1\npage "BI"\nl1: legend "North | South | East | West" @ 10,10\nb1: bar "Sales" { 3, 5; 4, 1 } @ 60,10\n');
    const fills = await fillsOf(app, 'North');
    expect(fills).toHaveLength(4);
    expect(fills.slice(0, 2)).toEqual(['#1F6F78', '#C9781C']);               // the same colours as a chart's series
    expect(new Set(fills).size).toBe(4);
    const tops = (await partBoxes(app, 'North')).map(b => b.top);
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1]);   // top down, in label order
    await expect(app.shape('North').locator('text')).toContainText(['North', 'South', 'East', 'West']);
    expect(await app.flowText()).toContain('l1: legend "North | South | East | West" @ 10,10');
});

test('colours= gives a chart and its legend their own series colours, the rest carrying on with the palette', async ({
                                                                                                                         app,
                                                                                                                         page
                                                                                                                     }) => {
    const BAR = 'b1: bar "Sales" { 3, 5; 4, 1; 2, 2 } @ 10,10 [colours=#AA3377,#228833]';
    await openFlow(app, `flow 1\npage "BI"\n${BAR}\nl1: legend "North | South | East" @ 70,10 [colours="#aa3377 #228833"]\n` +
        'l2: line "Trend" { 1, 2; 2, 1 } @ 10,60 [colours=#AA3377,#228833]\na: process "Step" @ 150,20\n');
    const bars = await fillsOf(app, 'Sales');
    expect(bars.filter(f => f === '#AA3377')).toHaveLength(2);
    expect(bars.filter(f => f === '#228833')).toHaveLength(2);
    expect(bars.filter(f => f === '#4A6FB5')).toHaveLength(2);              // the third series: the palette's, as before
    expect(await fillsOf(app, 'North')).toEqual(['#AA3377', '#228833', '#4A6FB5']);
    const strokes = await app.shape('Trend').locator('path[fill="none"][data-sec]').evaluateAll(ps => ps.map(p => p.getAttribute('stroke')));
    expect(strokes).toEqual(['#2B3A47', '#AA3377', '#228833', '#2B3A47']);    // the frame and axes keep the line colour
    const c = await app.centreOf(app.shape('Step'));
    await app.drag(c, {x: c.x + 40, y: c.y});
    const text = await app.flowText();
    expect(text).toContain(BAR + '\n');                                      // left as typed after an unrelated edit
    expect(text).toContain('l1: legend "North | South | East" @ 70,10 [colours="#aa3377 #228833"]');   // quoted, spaces are fine
});

test('the properties panel has a colour picker per series, which writes colours= in one undo step', async ({
                                                                                                               app,
                                                                                                               page
                                                                                                           }) => {
    await openFlow(app, 'flow 1\npage "BI"\nb1: bar "Sales" { 3, 5; 4, 1; 2, 2 } @ 10,10\nl1: legend "North | South" @ 70,10\nl2: line "Trend" { 1, 2; 2, 1 } @ 10,60\na: process "Step" @ 150,20\n');
    const picks = page.locator('#pColours input[type=color]');
    await app.click('Sales');
    await expect(picks).toHaveCount(3);
    expect(await picks.evaluateAll(ps => ps.map(p => p.value))).toEqual(['#1f6f78', '#c9781c', '#4a6fb5']);
    await expect(page.locator('#fillWrap')).toBeHidden();                    // the first series' picker is the fill
    await expect(page.locator('#pColoursReset')).toBeHidden();
    await picks.nth(1).fill('#aa3377');
    expect(await app.flowText()).toContain('b1: bar "Sales" { 3, 5; 4, 1; 2, 2 } @ 10,10 [colours=#1F6F78,#AA3377]');
    expect((await fillsOf(app, 'Sales')).filter(f => f === '#AA3377')).toHaveLength(2);
    await page.locator('#pColoursReset').click();
    expect(await app.flowText()).toContain('b1: bar "Sales" { 3, 5; 4, 1; 2, 2 } @ 10,10\n');
    await page.keyboard.press('Control+z');
    expect(await app.flowText()).toContain('[colours=#1F6F78,#AA3377]');
    await app.click('North');
    await expect(page.locator('#pColours label')).toHaveText(['North', 'South']);   // a legend's pickers take its names
    await app.click('Step');
    await expect(page.locator('#coloursWrap')).toBeHidden();
    await expect(page.locator('#fillWrap')).toBeVisible();
    await app.click('Trend');
    expect(await picks.evaluateAll(ps => ps.map(p => p.value))).toEqual(['#2b3a47', '#c9781c']);   // the first line is the line colour
});

test('only charts and legends take colours, and they must be colours', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "BI"\nb: process "Other"\na: process "Step" [colours=#AA3377,#228833]\n');
    await expect(page.locator('#tpStatus')).toContainText('Only charts and legends have colours');
    await openFlow(app, 'flow 1\npage "BI"\na: process "Step"\nb1: bar "Sales" [colours=#AA3377,red]\n');
    await expect(page.locator('#tpStatus')).toContainText('colours lists up to 12 colours');
});

test('a progress bar fills to its label', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nb1: progressbar "60%" @ 10,10\nb2: meter "Done" @ 10,20\n');
    await expect(tealParts(app,'60%')).toHaveCount(1);
    await expect(tealParts(app,'Done')).toHaveCount(0);      // no percentage, no fill
    await addFromPalette(page,'progressbar');
    expect(await app.flowText()).toMatch(/: progressbar "60%" @/);
});

/* The switch's one filled part: the whole track when on, just the knob when off */
const switchFillWidth=async(app,label)=>(await tealParts(app,label).boundingBox()).width;

test('a switch is one shape, turned on and off in the properties panel or the text', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ns1: switch "Alerts" [state=on] @ 90,10\ns2: toggle "Sync" [state=off] @ 90,20\n');
    const on=await switchFillWidth(app,'Alerts'), off=await switchFillWidth(app,'Sync');
    expect(on).toBeGreaterThan(off*2);
    expect(await app.flowText()).toContain('s2: toggle "Sync" [state=off] @ 90,20');   // left as typed until it changes

    await app.click('Sync');
    await expect(page.locator('#pState')).not.toBeChecked();
    await page.locator('#pState').check();
    expect(await app.flowText()).toContain('s2: switch "Sync" @ 90,20 [state=on]');   // a changed line is written in the standard form
    expect(await switchFillWidth(app,'Sync')).toBeCloseTo(on,0);
    await page.locator('#pState').uncheck();
    expect(await app.flowText()).toContain('s2: switch "Sync" @ 90,20\n');   // off is the default, so nothing is written
    await page.locator('#pState').blur();   // shortcuts are not taken while a panel control has focus
    await page.keyboard.press('Control+z');
    expect(await app.flowText()).toContain('s2: switch "Sync" @ 90,20 [state=on]');

    await addFromPalette(page,'switch');
    expect(await app.flowText()).toMatch(/: switch "Switch" @[^[]*$/m);   // a new switch starts off
});

test('only switches, checkboxes, radios and robot checks have a state, and it is on or off', async ({app, page}) => {
    await openFlow(app,'flow 1\npage "UI"\na: process "Step"\nb: process "Other" [state=on]\ns: switch "Alerts" [state=maybe]\n');
    await expect(page.locator('#tpStatus')).toContainText('Only switches, checkboxes, radio buttons and robot checks have a state');
    await expect(page.locator('#tpStatus')).toContainText('1 more problem');
});

/* The screen x of each part of a segmented label, in the order they were drawn */
const partXs=(app,title)=>app.shape(title).locator('text').evaluateAll(ts=>ts.map(t=>{ const b=t.getBoundingClientRect(); return b.left+b.width/2; }));

test('tabs draw one slot per part of the label, the first one marked open', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nt1: tabs "Home | Profile | Settings" @ 10,10\nt2: tabs "Overview | A rather long tab name" @ 10,30\n');
    const xs=await partXs(app,'Home');
    expect(xs).toHaveLength(3);
    expect(xs[0]).toBeLessThan(xs[1]); expect(xs[1]).toBeLessThan(xs[2]);
    await expect(tealParts(app,'Home')).toHaveCount(1);        // the bar under the open tab
    const bar=await tealParts(app,'Home').boundingBox(), box=await app.shape('Home').boundingBox();
    expect(bar.width).toBeLessThan(box.width/2);
    const [a,b]=await app.shape('Overview').locator('text').evaluateAll(ts=>ts.map(t=>t.getBoundingClientRect().height));
    expect(b).toBeCloseTo(a,0);                                // the long name is not wrapped onto a second line
    await addFromPalette(page,'tabs');
    const text=await app.flowText();
    expect(text).toContain('t1: tabs "Home | Profile | Settings" @ 10,10');
    expect(text).toMatch(/: tabs "Home \| Profile \| Settings"/);
});

/* The screen y of each part of a segmented label, in the order they were drawn */
const partYs=(app,title)=>app.shape(title).locator('text').evaluateAll(ts=>ts.map(t=>{ const b=t.getBoundingClientRect(); return b.top+b.height/2; }));
const rising=xs=>xs.every((x,i)=>!i||x>xs[i-1]);

test('segmented shapes draw a slot per part: rows left to right, columns top to bottom', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nb: breadcrumb "Home | Products | Shoes" @ 10,10\np: pagination "‹ | 1 | 2 | 3 | ›" @ 10,25\n'+
        's: stepper "Cart | Details | Payment | Done" @ 10,40\nf: chips "All | Open | Closed" @ 10,62\nl: list "First | Second | Third" @ 100,10\n'+
        'm: sidebar "Dashboard | Reports | Settings" @ 100,40\na: accordion "One | Two | Three | Four" @ 150,10\na3: accordion "Uno | Dos | Tres" @ 220,10\n');
    for(const [t,n] of [['Home',3],['‹',5],['Cart',4],['All',3]]){ const xs=await partXs(app,t); expect(xs).toHaveLength(n); expect(rising(xs)).toBe(true); }
    for(const [t,n] of [['First',3],['Dashboard',3],['One',4]]){ const ys=await partYs(app,t); expect(ys).toHaveLength(n); expect(rising(ys)).toBe(true); }
    await expect(tealParts(app,'Cart')).toHaveCount(1);        // the current step
    await expect(tealParts(app,'‹')).toHaveCount(1);           // the current page's bar
    await expect(tealParts(app,'Dashboard')).toHaveCount(1);   // the current page's edge
    const four=await partYs(app,'One'), three=await partYs(app,'Uno'), spread=ys=>ys[ys.length-1]-ys[0];
    expect(spread(four)/spread(three)).toBeCloseTo(1.5,1);     // a column grows by a row for each part, rows keep their height
    expect(await app.flowText()).toContain('f: chips "All | Open | Closed" @ 10,62');
});

test('segmented shapes come from the palette with their sample parts', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\na: process "Step"\n');
    const kinds=['breadcrumb','pagination','stepper','pills','list','sidebar','accordion'];
    for(const k of kinds) await addFromPalette(page,k);
    const text=await app.flowText();
    for(const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "[^"]+ \\| [^"]+"`));
});

test('a checkbox is ticked and a radio button selected with [state=on], or the On box', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nc1: checkbox "Remember me" [state=on] @ 10,10\nc2: checkbox "Newsletter" @ 10,20\nr1: radio "Monthly" [state=on] @ 10,30\nr2: radio "Yearly" @ 10,40\n');
    const parts=t=>app.shape(t).locator('path[fill="none"]:not([stroke="transparent"])');   // visible lines
    expect(await parts('Remember me').count()).toBeGreaterThan(await parts('Newsletter').count());   // the tick
    await expect(tealParts(app,'Monthly')).toHaveCount(1);     // the dot
    await expect(tealParts(app,'Yearly')).toHaveCount(0);
    await app.click('Newsletter');
    await page.locator('#pState').check();
    expect(await app.flowText()).toContain('c2: checkbox "Newsletter" @ 10,20 [state=on]');
});

test('a slider sits at the percentage in its label', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\ns1: slider "20%" @ 10,10\ns2: slider "80%" @ 10,20\n');
    const knob=async t=>(await tealParts(app,t).evaluateAll(ps=>ps.map(p=>p.getBoundingClientRect()))).sort((a,b)=>b.height-a.height)[0];
    const low=await knob('20%'), high=await knob('80%');
    expect(high.left-low.left).toBeGreaterThan(50);
});

test('the input pieces come from the palette', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\na: process "Step"\n');
    const kinds = ['slider', 'search', 'textarea', 'datepicker', 'password', 'numberinput', 'segmented', 'timepicker', 'colourpicker', 'upload', 'otp', 'togglechips', 'rangeslider', 'formfield'];
    for(const k of kinds) await addFromPalette(page,k);
    const text=await app.flowText();
    for(const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "`));
});

test('toggle chips fill the options that start with a tick, and a segmented control its first option', async ({app}) => {
    await openFlow(app, 'flow 1\npage "UI"\nt1: togglechips "✓ Wi-Fi | Parking | ✓ Pool | Gym" @ 10,10\ns1: buttongroup "Day | Week | Month" @ 10,30\n');
    await expect(filledParts(app, '✓ Wi-Fi')).toHaveCount(2);
    await expect(filledParts(app, 'Day')).toHaveCount(1);
    const xs = await partXs(app, 'Day');
    expect(xs).toHaveLength(3);
    expect(rising(xs)).toBe(true);
    expect(await app.flowText()).toContain('s1: buttongroup "Day | Week | Month" @ 10,30');
});

test('a range slider puts a handle at each percentage in its label and fills between them', async ({app}) => {
    await openFlow(app, 'flow 1\npage "UI"\nr1: rangeslider "20–70%" @ 10,10\nr2: dualslider "10% to 30%" @ 10,25\n');
    // by order, not by label: "10% to 30%" wraps onto two lines with Linux's wider fonts (CI), so app.shape can't find it
    const teal = i => app.shapes.nth(i).locator('path[fill="#1F6F78"]');
    await expect(teal(0)).toHaveCount(3);     // the filled part and two handles
    await expect(teal(1)).toHaveCount(3);
    const knobs = async i => (await teal(i).evaluateAll(ps => ps.map(p => p.getBoundingClientRect())))
        .sort((a, b) => b.height - a.height).slice(0, 2).sort((a, b) => a.left - b.left);
    const [lowA, highA] = await knobs(0), [lowB, highB] = await knobs(1);
    expect(lowB.left).toBeLessThan(lowA.left);
    expect(highB.left).toBeLessThan(highA.left);
    expect(highA.left - lowA.left).toBeGreaterThan(highB.left - lowB.left);
    expect(await app.flowText()).toContain('r2: dualslider "10% to 30%" @ 10,25');
});

test('a form field boxes the middle of its three parts: name, value and message, top down', async ({app}) => {
    await openFlow(app, 'flow 1\npage "UI"\nf1: formfield "Email | sam@example.com | Enter a valid email" @ 10,10\n');
    const ys = await app.shape('Email').locator('text').evaluateAll(ts => ts.map(t => t.getBoundingClientRect().top));
    expect(ys).toHaveLength(3);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    const box = await filledParts(app, 'Email').first().boundingBox();
    expect(box.y).toBeLessThan(ys[1]);
    expect(box.y + box.height).toBeGreaterThan(ys[1]);
});

test('page pieces: nav bar, modal, card, alert and tooltip', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nn: navbar "Acme | Home | About" @ 10,10\nm: dialog "Delete?" @ 10,30\nc: card "Title" @ 100,30\na: alert "Saved." @ 10,90\nt: tooltip "Tip" @ 100,90\n');
    const xs=await partXs(app,'Acme'); expect(xs).toHaveLength(3); expect(rising(xs)).toBe(true);
    await expect(tealParts(app,'Acme')).toHaveCount(1);        // the logo
    await expect(tealParts(app,'Saved.')).toHaveCount(1);      // the bar down the alert's edge
    expect(await app.shape('Tip').locator('text').getAttribute('fill')).toBe('#FFFFFF');   // light text on the dark tooltip
    await expect(app.shape('Delete?')).toHaveCount(1); await expect(app.shape('Title')).toHaveCount(1);
    const kinds=['navbar','modal','card','alert','tooltip'];
    for(const k of kinds) await addFromPalette(page,k);
    const text=await app.flowText();
    for(const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toContain('m: dialog "Delete?" @ 10,30');
});

test('a star rating fills as many stars as its score, out of its total', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nr1: rating "4/5" @ 10,10\nr2: stars "2.6 / 10" @ 10,20\nr3: rating "Unrated" @ 10,30\n');
    await expect(tealParts(app,'4/5')).toHaveCount(4);
    await expect(tealParts(app,'2.6 / 10')).toHaveCount(3);    // rounded to the nearest whole star
    await expect(tealParts(app,'Unrated')).toHaveCount(0);
    const outlines=t=>app.shape(t).locator('path[fill="none"]:not([stroke="transparent"])');
    await expect(outlines('2.6 / 10')).toHaveCount(10);        // every star has an outline
});

test('small pieces: avatar, badge and icon placeholder', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\na: avatar "SR" @ 10,10\nb: tag "Beta" @ 30,10\n');
    await expect(app.shape('SR')).toHaveCount(1);
    expect(await app.shape('Beta').locator('text').getAttribute('fill')).toBe('#FFFFFF');   // light text on the filled badge
    const kinds=['avatar','badge','rating','glyph'];
    for(const k of kinds) await addFromPalette(page,k);
    const text=await app.flowText();
    for(const k of ['avatar','badge','rating']) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toMatch(/: glyph @/);                         // no label
    expect(text).toContain('b: tag "Beta" @ 30,10');
});

test('feedback pieces: a spinner fades round, a toast is a white card with a white tick, an inline error is red', async ({
                                                                                                                             app,
                                                                                                                             page
                                                                                                                         }) => {
    await openFlow(app, 'flow 1\npage "UI"\ns1: loader @ 10,10\nt1: snackbar "Saved" @ 30,10\ne1: inlineerror "Required" @ 30,30\n');
    const dots = await page.locator('#layer [data-kind="spinner"] path[fill^="#"]').evaluateAll(ps => ps.map(p => p.getAttribute('fill')));
    expect(dots).toHaveLength(8);
    expect(dots[0]).toBe('#1F6F78');                             // the top dot in the full fill
    expect(new Set(dots).size).toBe(8);                          // each paler than the last
    const fills = await fillsOf(app, 'Saved');
    expect(fills).toContain('#FFFFFF');                          // the card
    expect(fills).toContain('#1F6F78');                          // the tick's circle
    await expect(app.shape('Saved').locator('path[fill="none"][stroke="#FFFFFF"]')).toHaveCount(1);   // the tick
    expect(await app.shape('Required').locator('text').getAttribute('fill')).toBe('#B9474F');
    const kinds = ['spinner', 'skeleton', 'toast', 'emptystate', 'inlineerror'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of ['toast', 'emptystate', 'inlineerror']) expect(text).toMatch(new RegExp(`: ${k} "`));
    for (const k of ['spinner', 'skeleton']) expect(text).toMatch(new RegExp(`: ${k} @`));   // no label
    expect(text).toContain('s1: loader @ 10,10');
});

test('navigation pieces: menus light their first item, a tab bar fills its first icon, an action button has a white +', async ({
                                                                                                                                   app,
                                                                                                                                   page
                                                                                                                               }) => {
    await openFlow(app, 'flow 1\npage "UI"\nd1: openmenu "Sort | New | Old" @ 10,10\nc1: contextmenu "Cut | Copy | Paste" @ 80,10\n' +
        'm1: menubar "File | Edit | View" @ 10,60\nt1: bottomnav "Home | Search | Me" @ 10,80\nf1: fab @ 120,80\nb1: appbar "Settings" @ 10,110\n');
    const ys = await app.shape('Sort').locator('text').evaluateAll(ts => ts.map(t => t.getBoundingClientRect().top));
    expect(ys).toHaveLength(3);
    expect(ys[0]).toBeLessThan(ys[1]);
    for (const t of ['Sort', 'Cut']) {
        const fills = await fillsOf(app, t);
        expect(fills).toContain('#FFFFFF');                      // the card
        expect(fills.filter(f => f !== '#FFFFFF')).toHaveLength(2);   // its shadow and the lit item
    }
    const lit = await filledParts(app, 'Sort').nth(2).boundingBox();   // the lit option is the first under the field
    expect(lit.y).toBeLessThan(ys[1]);
    expect(lit.y + lit.height).toBeGreaterThan(ys[1]);
    const xs = await partXs(app, 'File');
    expect(xs).toHaveLength(3);
    expect(rising(xs)).toBe(true);
    await expect(tealParts(app, 'Home')).toHaveCount(1);         // the open tab's icon
    const plus = await page.locator('#layer [data-kind="fab"] path[fill^="#"]').evaluateAll(ps => ps.map(p => p.getAttribute('fill')));
    expect(plus.filter(f => f === '#FFFFFF')).toHaveLength(2);
    expect(plus).toContain('#1F6F78');
    await expect(tealParts(app, 'Settings')).toHaveCount(3);     // the ⋮ dots
    const kinds = ['dropdownmenu', 'contextmenu', 'menubar', 'tabbar', 'fab', 'backheader'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds.filter(k => k !== 'fab')) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toMatch(/: fab @/);                             // no label
    expect(text).toContain('t1: bottomnav "Home | Search | Me" @ 10,80');
});

test('layout pieces: a divider breaks for its label, a scroll bar turns with its shape, a split pane has two panes', async ({
                                                                                                                                app,
                                                                                                                                page
                                                                                                                            }) => {
    await openFlow(app, 'flow 1\npage "UI"\nd1: hr "or" @ 10,10\nd2: divider @ 10,20\nf1: footer "© Acme | Privacy | Terms" @ 10,30\n' +
        'h1: hero "Headline" @ 10,50\np1: splitview "Files | Preview" @ 120,50\ns1: scrollbar @ 10,110 5x50\ns2: scrollbar @ 30,110 50x5\n');
    const lines = async i => page.locator('#layer [data-kind="divider"]').nth(i).locator('path[fill="none"]:not([stroke="transparent"])')
        .evaluateAll(ps => ps.map(p => (p.getAttribute('d').match(/M/g) || []).length).reduce((a, b) => a + b, 0));
    expect(await lines(0)).toBe(2);                              // broken for "or"
    expect(await lines(1)).toBe(1);                              // one line when it has no label
    const xs = await partXs(app, '© Acme');
    expect(xs).toHaveLength(3);
    expect(rising(xs)).toBe(true);
    await expect(tealParts(app, 'Headline')).toHaveCount(1);     // the button
    expect(await partXs(app, 'Files')).toHaveLength(2);
    await expect(tealParts(app, 'Files')).toHaveCount(1);        // the grip
    const thumbs = page.locator('#layer [data-kind="scrollbar"]');
    const box = async i => (await thumbs.nth(i).locator('path[fill="#1F6F78"]').evaluateAll(ps => ps.map(p => p.getBoundingClientRect())))
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];   // the thumb is the biggest filled part
    const down = await box(0), across = await box(1);
    expect(down.height).toBeGreaterThan(down.width);
    expect(across.width).toBeGreaterThan(across.height);
    const kinds = ['divider', 'footer', 'hero', 'splitpane', 'scrollbar'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds.filter(k => k !== 'scrollbar')) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toMatch(/: scrollbar @/);                       // no label
    expect(text).toContain('p1: splitview "Files | Preview" @ 120,50');
});

test('content pieces: a bell shows a badge only with a count, a comment thread ends in a reply box, a user menu lights its first item', async ({
                                                                                                                                                   app,
                                                                                                                                                   page
                                                                                                                                               }) => {
    await openFlow(app, 'flow 1\npage "UI"\nb1: bell "3" @ 10,10\nb2: notifications @ 30,10\nc1: carousel @ 50,10\n' +
        'k1: code "let n = 1" @ 120,10\nm1: chat "Hi there" @ 10,60\nt1: comments "Ana: Bigger? | Ben: Done | Reply…" @ 10,80\n' +
        'u1: usermenu "Ana Smith | Profile | Sign out" @ 120,80\n');
    const badges = i => page.locator('#layer [data-kind="bell"]').nth(i).locator('path[fill="#B9474F"]');
    await expect(badges(0)).toHaveCount(1);                      // the count's badge
    await expect(badges(1)).toHaveCount(0);                      // no count, no badge
    const dots = page.locator('#layer [data-kind="carousel"] path[fill="#1F6F78"]');
    await expect(dots).toHaveCount(1);                           // the first slide's dot
    await expect(app.shape('let n = 1')).toHaveCount(1);
    await expect(app.shape('Hi there')).toHaveCount(1);
    const ys = await app.shape('Ana: Bigger?').locator('text').evaluateAll(ts => ts.map(t => t.getBoundingClientRect().top));
    expect(ys).toHaveLength(3);
    expect(ys.every((y, i) => !i || y > ys[i - 1])).toBe(true);  // top down, the reply last
    expect(await partXs(app, 'Ana Smith')).toHaveLength(3);
    const kinds = ['carousel', 'codeblock', 'chatbubble', 'commentthread', 'bell', 'usermenu'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds.filter(k => k !== 'carousel')) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toMatch(/: carousel @/);                        // no label
    expect(text).toContain('t1: comments "Ana: Bigger? | Ben: Done | Reply…" @ 10,80');
});

test('chat bubbles sit on the left or, with side=right, mirrored on the right', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "UI"\nm1: chat "Hi, are you free?" @ 10,10 70x12\nm2: chatbubble "Yes, at 3" @ 10,30 70x12 [side=right]\n' +
        'm3: chatbubble "Great" @ 10,50 70x12 [side=left]\n');
    /* where the avatar (the first part) and the text sit, as fractions of the bubble's width */
    const sides = t => app.shape(t).evaluate(g => {
        const b = g.getBoundingClientRect(), a = g.querySelector('path[data-sec="0"]').getBoundingClientRect(),
            x = g.querySelector('text').getBoundingClientRect();
        return {avatar: (a.left + a.width / 2 - b.left) / b.width, text: (x.left + x.width / 2 - b.left) / b.width};
    });
    const left = await sides('Hi, are you free?'), right = await sides('Yes, at 3');
    expect(left.avatar).toBeLessThan(0.2);
    expect(right.avatar).toBeGreaterThan(0.8);
    expect(right.text).toBeLessThan(left.text);                  // the text block is mirrored too
    await app.click('Great');
    await page.keyboard.press('ArrowRight');                     // an unrelated edit, so the text is written back
    const text = await app.flowText();
    expect(text).toContain('m2: chatbubble "Yes, at 3" @ 10,30 70x12 [side=right]');
    expect(text).toMatch(/m3: chatbubble "Great" @ [\d.]+,50 70x12$/m);   // left is the default, so it isn't written
    await openFlow(app, 'flow 1\npage "UI"\na: process "Step"\nb: button "Go" [side=right]\n');
    await expect(page.locator('#tpStatus')).toContainText('Only chat bubbles have a side');
});

/* Clicks a ready-made pattern on the palette, opening its group first */
async function addPattern(page, name) {
    const b = page.locator(`.palette [data-pattern="${name}"]`);
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
}

test('a pattern goes into the current page with its own ids, as one undo step, and comes selected', async ({
                                                                                                               app,
                                                                                                               page
                                                                                                           }) => {
    await openFlow(app, 'flow 1\npage "One"\na: process "Step"\n\npage "Two"\nemail: process "Email"\n');
    await page.locator('#tabs button', {hasText: 'Two'}).click();
    await addPattern(page, 'login');
    await expect(page.locator('#pId')).toHaveValue(/login/);   // the outermost container is selected
    await addPattern(page, 'login');
    const text = await app.flowText();
    const two = text.slice(text.indexOf('page "Two"'));
    expect(text.slice(0, text.indexOf('page "Two"'))).not.toContain('container');   // nothing went on page One
    expect(two).toMatch(/^login: container "Log in" @ [\d.]+,[\d.]+ \[flow=column\]$/m);
    expect(two).toMatch(/^email_2: field "Email" \[in=login\]$/m);   // "email" was taken by the page's own shape
    expect(two).toMatch(/^login_2: container "Log in" @/m);
    expect(two).toMatch(/^email_3: field "Email" \[in=login_2\]$/m);   // in= follows the rename
    expect(two).toMatch(/^log_in_2: button "Log in" \[in=login_2\]$/m);
    await expect(app.shape('Keep me signed in')).toHaveCount(2);
    await page.keyboard.press('Control+z');                       // the second one goes in one step
    await expect(app.shape('Keep me signed in')).toHaveCount(1);
    expect(await app.flowText()).not.toContain('login_2');
});

test('a pattern dropped on a page before the last one goes onto that page, not the next one', async ({
                                                                                                           app,
                                                                                                           page
                                                                                                       }) => {
    await openFlow(app, 'flow 1\npage "One"\na: process "Step"\n\npage "Two"\nemail: process "Email"\n');
    // stays on "One" (the default current page): this used to land the pattern on "Two" instead
    await addPattern(page, 'cookies');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const text = await app.flowText(), two = text.indexOf('page "Two"');
    expect(text.slice(0, two)).toMatch(/^cookies: container "Cookies" @ [\d.]+,[\d.]+ \[flow=row align=center\]$/m);
    expect(text.slice(two)).not.toContain('container');   // nothing went on page Two
});

test('every pattern opens cleanly, a chat with bubbles on both sides', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "UI"\na: process "Step"\n');
    for (const name of ['login', 'signup', 'settings', 'cookies', 'search', 'chat', 'storelocator', 'directions', 'dashboard'])
        await addPattern(page, name);
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const text = await app.flowText();
    expect(text).toContain('msg2: chatbubble "Yes, see you there!" [side=right in=chat]');
    await expect(app.shape('Yes, see you there!')).toHaveCount(1);
    await expect(app.shape('1,204')).toHaveCount(1);
});

test('map screens: a map, satellite and street view with their search text along the top, a pin and directions', async ({
                                                                                                                            app,
                                                                                                                            page
                                                                                                                        }) => {
    await openFlow(app, 'flow 1\npage "UI"\nm1: streetmap "Cafes near me" @ 10,10\ns1: aerial "Leeds" @ 90,10\n' +
        'v1: streetlevel "High Street" @ 170,10\np1: mapmarker @ 250,10\n' +
        'd1: routepanel "From: A | To: B | Turn left at the lights" @ 10,80\n' +
        'd2: directions "From: A | To: B | Turn right at the lights" @ 90,80\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    for (const t of ['Cafes near me', 'Leeds', 'High Street']) {
        const pos = await app.shape(t).evaluate(g => {
            const r = g.querySelector('text').getBoundingClientRect(), b = g.getBoundingClientRect();
            return {y: r.top + r.height / 2 - b.top, x: r.left - b.left, h: b.height, w: b.width};
        });
        expect(pos.y).toBeLessThan(pos.h * 0.2);                     // in the search box (or card) along the top
        expect(pos.x).toBeLessThan(pos.w * 0.25);                    // starting at its left
    }
    // a step's arrow turns the way its text says: its bent stem (the last section but one) sits left of the
    // turn-right one's
    const stem = i => page.locator('#layer [data-kind="directions"]').nth(i).evaluate(g => {
        const secs = [...g.querySelectorAll('path[data-sec]')], last = Math.max(...secs.map(p => +p.dataset.sec)),
            r = secs.find(p => +p.dataset.sec === last - 1).getBoundingClientRect(), b = g.getBoundingClientRect();
        return r.left + r.width / 2 - b.left;
    });
    expect(await stem(0)).toBeLessThan(await stem(1) - 2);
    const kinds = ['mapview', 'satellite', 'streetview', 'mappin', 'directions'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds.filter(k => k !== 'mappin')) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toMatch(/: mappin @/);                          // no label
    expect(text).toContain('m1: streetmap "Cafes near me" @ 10,10');
});

test('robot checks: a box to tick that takes [state=on], a picture grid and a code to type', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "UI"\nc1: robotcheck "Not ticked" @ 10,10\nc2: captcha "Ticked" @ 10,40 [state=on]\n' +
        'i1: picturecheck "Select all squares with buses" @ 90,10\nt1: codecaptcha "x7Kp2" @ 160,10\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const paths = t => app.shape(t).locator('path[data-sec]').count();
    expect(await paths('Ticked')).toBe(await paths('Not ticked') + 1);   // the tick
    // the instruction is white on the band along the top
    const fill = await app.shape('Select all squares with buses').locator('text').getAttribute('fill');
    expect(fill?.toUpperCase()).toBe('#FFFFFF');
    await expect(app.shape('x7Kp2')).toHaveCount(1);
    const kinds = ['captcha', 'imagecaptcha', 'textcaptcha'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toContain('c2: captcha "Ticked" @ 10,40 [state=on]');
});

test('device frames: a tablet, a smartwatch and an app window with its title in the bar', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "UI"\nt1: tablet "Dashboard" @ 10,10\nw1: watch "10:09" @ 90,10\n' +
        'a1: window "Settings" @ 130,10 80x50\n');
    await expect(app.shape('Dashboard')).toHaveCount(1);
    await expect(app.shape('10:09')).toHaveCount(1);
    const win = await app.shape('Settings').evaluate(g => {
        const t = g.querySelector('text').getBoundingClientRect(), b = g.getBoundingClientRect();
        return {t: t.top + t.height / 2 - b.top, h: b.height};
    });
    expect(win.t).toBeLessThan(win.h * 0.2);                     // the title is in the bar along the top
    const kinds = ['tablet', 'smartwatch', 'appwindow'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toContain('w1: watch "10:09" @ 90,10');
});

test('a video player has a play button that pulses on hover, and comes from the palette', async({app,page})=>{
    await openFlow(app,'flow 1\npage "UI"\nv1: video "Product demo" @ 10,10\nv2: player "Intro" @ 80,10\n');
    await expect(app.shape('Product demo')).toHaveCount(1);
    const play=app.shape('Product demo').locator('path[data-sec="2"][fill="#1F6F78"]');
    await expect(play).toHaveCount(1);                       // the filled play triangle
    expect(await play.evaluate(p=>getComputedStyle(p).animationName)).toBe('none');
    await app.shape('Product demo').hover();
    expect(await play.evaluate(p=>getComputedStyle(p).animationName)).toBe('video-play');
    await addFromPalette(page,'video');
    const text=await app.flowText();
    expect(text).toMatch(/: video "Video title"/);
    expect(text).toContain('v2: player "Intro" @ 80,10');   // the alias is left as typed
});
