import {test, expect} from './fixtures.js';

/* Patterns' walk-throughs (Pattern.animation): added to the file's one @animation block when a pattern goes in, and
   the block kept readable when shapes it changes are deleted on the canvas */
const openFlow = (app, text) => app.open({name: 'anim.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});

test('deleting a shape on the canvas takes its step lines with it, then empty steps, then an empty block', async ({
                                                                                                                      app,
                                                                                                                      page
                                                                                                                  }) => {
    const text = 'flow 1\npage "P"\na: process "Alpha" @ 10,10\nb: process "Beta" @ 70,10\na -> b\n\n' +
        '@animation start\nstep 1\n   $a [fill=#FFE38A]\nstep 2\n   $b [fill=#FFE38A]\n   $a "Alpha again"\n@animation end\n';
    await openFlow(app, text);
    await app.click('Alpha');
    await page.keyboard.press('Delete');
    let now = await app.flowText();
    expect(now).not.toContain('$a');
    expect(now).not.toMatch(/step 1\n\s*step 2/);                   // step 1 had only $a, so it went
    expect(now).toMatch(/@animation start\nstep 2\n {3}\$b \[fill=#FFE38A\]\n@animation end/);
    await page.keyboard.press('Control+e');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);   // still reads
    await page.keyboard.press('Control+e');
    await app.click('Beta');
    await page.keyboard.press('Delete');
    now = await app.flowText();
    expect(now).not.toContain('@animation');                         // nothing left to animate
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    expect(await app.flowText()).toBe(text);                         // and undo brings it all back
});

/* Clicks a ready-made pattern on the palette, opening its group first */
async function addPattern(page, name) {
    const b = page.locator(`.palette [data-pattern="${name}"]`);
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
}

const stepsOf = text => text.slice(text.indexOf('@animation start'));

test('a pattern brings its walk-through: the first starts the block, the next follows on with its own ids', async ({
                                                                                                                       app,
                                                                                                                       page
                                                                                                                   }) => {
    await openFlow(app, 'flow 1\npage "One"\nemail: process "Mail" @ 250,20\n\npage "Two"\nx: process "Step" @ 250,180\n');
    await page.locator('#tabs button', {hasText: 'Two'}).click();
    await addPattern(page, 'login');
    let text = await app.flowText();
    expect(text.trimEnd().endsWith('@animation end')).toBe(true);    // the block is the last thing in the file
    expect(text).toMatch(/^email_2: field "Email" \[in=login\]$/m);  // "email" is taken on page One, and a $id names one shape
    expect(stepsOf(text)).toMatch(/^step 1\n {3}\$email_2 \[fill=#FFE38A stroke=#E69138\]\n {3}\$about "/m);
    expect(stepsOf(text)).toContain('step 5');                      // four steps, then the whole picture again
    await addPattern(page, 'login');
    text = await app.flowText();
    expect(text.match(/@animation start/g)).toHaveLength(1);          // still one block
    expect(stepsOf(text)).toMatch(/^step 6\n {3}\$email_3 \[fill=#FFE38A/m);   // numbered on, with the new ids
    expect(stepsOf(text)).toContain('$about_2 "The email');
    await page.keyboard.press('Control+e');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    await page.keyboard.press('Control+e');
    await page.keyboard.press('Control+z');                           // the second one, steps and all, in one step
    text = await app.flowText();
    expect(text).not.toContain('step 6');
    expect(text).not.toContain('email_3');
});

test('present mode plays a pattern\'s walk-through, lighting each part and saying what it is', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    await addPattern(page, 'login');
    /* How many texts say t. The about block's lines are wrapped into tspans with no space between them, and where
       they wrap depends on the fonts (Linux breaks "says who | is" where Windows breaks after "is"), so the lines are
       joined with spaces before looking. */
    const said = t => page.locator('#layer text').evaluateAll((els, t) => els.filter(e => {
        const lines = [...e.querySelectorAll('tspan')].map(s => s.textContent);
        return (lines.length ? lines.join(' ') : e.textContent).replace(/\s+/g, ' ').includes(t);
    }).length, t);
    await expect(page.locator('#btnPresent')).toBeEnabled();         // the pattern's steps make the drawing playable
    await page.locator('#btnPresent').click();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => said('says who is')).toBe(1);
    const field = app.shape('Email').locator('path[data-sec]:not([fill="none"])').first();
    await expect(field).toHaveAttribute('fill', '#FFE38A');
    await page.keyboard.press('ArrowRight');
    await expect(field).not.toHaveAttribute('fill', '#FFE38A');      // back to how it was when the next part lights
    await expect.poll(() => said('The password proves it')).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => said('A login form')).toBe(1);            // the description again
});

test('the kanban board\'s walk-through moves cards from column to column', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    await addPattern(page, 'kanban');
    /* how far a card is from "Make the repo", which stays in Done: 0 when it's in the same column. Measured together,
       as present mode zooms the page to fit */
    const fromDone = async t => (await app.shape(t).first().boundingBox()).x -
        (await app.shape('Make the repo').first().boundingBox()).x;
    expect(await fromDone('Login page')).toBeLessThan(-20);              // drawn in Doing
    await page.locator('#btnPresent').click();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => fromDone('Login page')).toBeCloseTo(0, 0);   // step 4: finished, into Done
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => fromDone('Write the brief')).toBeLessThan(-20);   // step 5: picked up ...
    expect(await fromDone('Write the brief')).toBeGreaterThan(await fromDone('Sketch screens'));   // ... out of To do
    expect(await fromDone('Login page')).toBeCloseTo(0, 0);                    // and the login card stays done
    await page.keyboard.press('Escape');
    await expect.poll(() => fromDone('Login page')).toBeLessThan(-20);   // the board as drawn again
    expect(await fromDone('Write the brief')).toBeCloseTo(await fromDone('Sketch screens'), 0);
});

/* The UI patterns are flexi containers: the description is their last member */
for (const name of ['login', 'signup', 'settings', 'cookies', 'search', 'chat', 'storelocator', 'directions', 'dashboard', 'journey', 'kanban']) {
    test(`the ${name} UI pattern goes in described and with its walk-through`, async ({app, page}) => {
        await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
        await addPattern(page, name);
        await expect(page.locator('#btnPresent')).toBeEnabled();
        const text = await app.flowText();
        expect(text).toMatch(/^about: text ".+" [\d.]+x[\d.]+ \[in=[a-z_]+\]$/m);
        expect(text).toMatch(/@animation start\nstep 1\n/);
        await page.keyboard.press('Control+e');
        await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    });
}
