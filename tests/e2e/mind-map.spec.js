import {test, expect} from './fixtures.js';

/* Mind maps: topics written under a central topic join its map, indented to hang off the topic above them, with
   branch lines drawn for them and no positions of their own (ShapesPlan.md, mind map behaviour) */

const openFlow = (app, text) => app.open({name: 'mind.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});
const MAP = 'flow 1\npage "Mind"\nidea: centraltopic "Website" @ 120,60\ngoals: topic "Goals"\n  g1: topic "Sign-ups"\n' +
    '  g2: topic "Speed"\nusers: topic "Users"\n  u1: topic "Staff"\nalone: topic "On its own" @ 10,150\n';
/* A shape's middle on the screen */
const mid = shape => shape.evaluate(g => {
    const r = g.querySelector('path').getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
});

test('topics under a central topic join its map, indented ones hanging off the topic above, with branch lines and no arrows', async ({
                                                                                                                                         app,
                                                                                                                                         page
                                                                                                                                     }) => {
    await openFlow(app, MAP);
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const c = await mid(app.shape('Website'));
    for (const [kid, parent] of [['Sign-ups', 'Goals'], ['Speed', 'Goals'], ['Staff', 'Users']]) {
        const k = await mid(app.shape(kid)), p = await mid(app.shape(parent));
        expect(Math.abs(k.x - c.x)).toBeGreaterThan(Math.abs(p.x - c.x));   // further out than its parent ...
        expect(Math.sign(k.x - c.x)).toBe(Math.sign(p.x - c.x));            // ... on the same side
    }
    expect(await app.connectionLines()).toHaveLength(5);                   // a branch per topic in the map
    // no arrowheads on branch lines
    const ends = await page.locator('#layer > [data-id]').evaluateAll(gs => gs.flatMap(g =>
        g.querySelector('path[fill="none"][stroke="transparent"]') ? [g.querySelectorAll('path').length] : []));
    expect(Math.max(...ends)).toBeLessThanOrEqual(2);                      // the hit path and the line, nothing more
    // the topic with a place of its own stands alone, where it was put
    const alone = await app.shape('On its own').evaluate(g => g.getBoundingClientRect().left);
    expect(alone).toBeLessThan(c.x - 300);
    // nothing about the branches is written to the text, which reads as typed after an unrelated edit
    await app.click('On its own');
    await page.keyboard.press('ArrowDown');
    const text = await app.flowText();
    expect(text).toContain('goals: topic "Goals"\n  g1: topic "Sign-ups"\n  g2: topic "Speed"\nusers: topic "Users"\n  u1: topic "Staff"\n');
    expect(text).not.toMatch(/->/);
    expect(text).toContain('idea: centraltopic "Website" @ 120,60');
});

test('a branch line can\'t be picked, a typed size on a topic stays as typed, and old maps joined by connections still work', async ({
                                                                                                                                         app,
                                                                                                                                         page
                                                                                                                                     }) => {
    await openFlow(app, 'flow 1\npage "Mind"\nidea: centraltopic "Website"\ngoals: topic "Goals" 40x15\nnote: sticky "Unrelated" @ 200,10\n');
    const [line] = await app.connectionLines();
    const m = await page.evaluate(([x, y]) => {   // the middle of the branch line on the screen
        const svg = document.querySelector('#layer').ownerSVGElement, p = svg.createSVGPoint();
        p.x = x;
        p.y = y;
        const q = p.matrixTransform(document.querySelector('#layer').getScreenCTM());
        return {x: q.x, y: q.y};
    }, [(line[0][0] + line[line.length - 1][0]) / 2, (line[0][1] + line[line.length - 1][1]) / 2]);
    // the point really is on the branch line, so a click there would pick an ordinary connection
    expect(await page.evaluate(({x, y}) => !!document.elementsFromPoint(x, y).find(n =>
        n.closest('#layer > [data-id]')?.querySelector('path[stroke="transparent"]')), m)).toBe(true);
    await page.mouse.click(m.x, m.y);
    await app.nothingSelected();
    await app.click('Unrelated');
    await page.keyboard.press('ArrowRight');
    expect(await app.flowText()).toContain('goals: topic "Goals" 40x15\n');
    // a map written the old way, with connections, keeps them and gets no extra branches
    await openFlow(app, 'flow 1\npage "Mind"\nidea: centraltopic "Website"\na: topic "Goals"\nb: topic "Users"\nidea -> a\nidea -> b\n');
    expect(await app.connectionLines()).toHaveLength(2);
    expect(await app.flowText()).toContain('idea -> a\nidea -> b');
});

test('moving the central topic moves its map, and exports still get the branches', async ({app, page}) => {
    await openFlow(app, MAP);
    const before = await mid(app.shape('Sign-ups')), c = await mid(app.shape('Website'));
    await app.drag(c, {x: c.x + 60, y: c.y + 40});
    const after = await mid(app.shape('Sign-ups'));
    expect(after.x - before.x).toBeGreaterThan(40);
    expect(after.y - before.y).toBeGreaterThan(25);
    const text = await app.flowText();
    expect(text).toMatch(/^idea: centraltopic "Website" @ [\d.]+,[\d.]+$/m);
    expect(text).not.toContain('idea: centraltopic "Website" @ 120,60');
    expect(text).toContain('  g1: topic "Sign-ups"\n');                     // its topics still have no places
    await page.click('#btnExport');
    await page.selectOption('#exportFmt', 'dot');
    const dot = await page.locator('#exportText').inputValue();
    expect(dot.match(/->/g)).toHaveLength(5);
});

test('Add topic in the properties panel adds a topic under the selected one, ready to name', async ({app, page}) => {
    await openFlow(app, MAP);
    const add = page.locator('#pAddTopic');
    await app.click('On its own');                                         // a topic on its own isn't in a map
    await expect(add).toBeHidden();
    await app.click('Goals');
    await expect(add).toBeVisible();
    await add.click();
    await expect(app.textEditor).toBeVisible();                            // its text is ready to type over
    await page.keyboard.type('Accessible');
    await page.keyboard.press('Control+Enter');
    await expect(app.shape('Accessible')).toHaveCount(1);
    // under the central topic: a new branch, after the whole map, not indented
    await app.click('Website');
    await add.click();
    await page.keyboard.type('Budget');
    await page.keyboard.press('Control+Enter');
    const text = await app.flowText();
    expect(text).toContain('goals: topic "Goals"\n  g1: topic "Sign-ups"\n  g2: topic "Speed"\n  topic: topic "Accessible"\n' +
        'users: topic "Users"\n  u1: topic "Staff"\ntopic_2: topic "Budget"\n');
    // the new topics are in the map: further out than the central topic, with branch lines
    expect(await app.connectionLines()).toHaveLength(7);
    const c = await mid(app.shape('Website')), a = await mid(app.shape('Accessible')),
        g = await mid(app.shape('Goals'));
    expect(Math.abs(a.x - c.x)).toBeGreaterThan(Math.abs(g.x - c.x));
});

test('deleting a topic deletes its branch, and deleting the central topic deletes its whole map', async ({
                                                                                                             app,
                                                                                                             page
                                                                                                         }) => {
    await openFlow(app, MAP);
    await app.click('Goals');
    await page.keyboard.press('Delete');
    for (const t of ['Goals', 'Sign-ups', 'Speed']) await expect(app.shape(t)).toHaveCount(0);
    await expect(app.shape('Users')).toHaveCount(1);
    let text = await app.flowText();
    expect(text).not.toMatch(/goals|g1|g2/);
    expect(text).toContain('users: topic "Users"\n  u1: topic "Staff"\n');
    await app.click('Website');
    await page.keyboard.press('Delete');
    for (const t of ['Website', 'Users', 'Staff']) await expect(app.shape(t)).toHaveCount(0);
    await expect(app.shape('On its own')).toHaveCount(1);                 // not in the map, so it stays
    text = await app.flowText();
    expect(text).toContain('alone: topic "On its own" @ 10,150');
    expect(text).not.toMatch(/idea|users|u1/);
    // one undo brings the whole map back
    await page.keyboard.press('Control+z');
    for (const t of ['Website', 'Users', 'Staff']) await expect(app.shape(t)).toHaveCount(1);
});

test('the map moves with its central topic during a drag and with the arrow keys, and stays out of containers', async ({
                                                                                                                           app,
                                                                                                                           page
                                                                                                                       }) => {
    await openFlow(app, MAP + 'box: container "Frame" @ 230,120 120x80\n');
    const c = await mid(app.shape('Website')), s0 = await mid(app.shape('Sign-ups'));
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 30, c.y + 20, {steps: 4});
    const s1 = await mid(app.shape('Sign-ups'));                         // mid-drag, the topic has come along
    expect(s1.x - s0.x).toBeGreaterThan(20);
    const f = await mid(app.shape('Frame'));
    await page.mouse.move(f.x, f.y, {steps: 6});                          // over the container ...
    await page.mouse.up();
    let text = await app.flowText();
    expect(text).not.toMatch(/\[in=box\]/);                               // ... but the map doesn't go in it
    expect(text).toContain('  g1: topic "Sign-ups"\n');
    const s2 = await mid(app.shape('Sign-ups'));
    await app.click('On its own');                                        // the drag left it selected: a second click would edit its text
    await app.click('Website');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await mid(app.shape('Sign-ups'))).x).toBeGreaterThan(s2.x);
    text = await app.flowText();
    expect(text).toContain('  g1: topic "Sign-ups"\n');                   // the topics still have no places
});
