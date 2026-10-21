import {test, expect} from './fixtures.js';

/* The @animation block: steps that restate shapes, played one at a time in present mode */
const openFlow = (app, text) => app.open({name: 'anim.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});
const DOC = [
    'flow 1',
    'page "One"',
    'order: process "Order" @ 20,20',
    'pay: process "Pay" @ 80,20 [fill=#DE2121]',
    'ship: process "Ship" @ 140,20',
    'order -> pay',
    'pay -> ship',
    '',
    '@animation start',
    'step 1',
    '   $pay @ 80,60 [fill=#C8E6C9]',
    'step 3',
    '   $order terminator',
    '   -$ship',
    'step 4',
    '   +retry: process "Retry" @ 140,60',
    '   +$ship',
    '@animation end',
    ''].join('\n');
const fillOf = loc => loc.locator('path[fill]:not([fill="transparent"]):not([fill="none"])').first().getAttribute('fill');
const boxOf = async loc => {
    const b = await loc.boundingBox();
    if (!b) throw new Error('not visible');
    return b;
};

test.beforeEach(async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});   // steps land at once, so what's drawn can be read straight away
});

test('Present needs an @animation block', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\na: process "A"\n');
    await expect(page.locator('#btnPresent')).toBeDisabled();
    await openFlow(app, DOC);
    await expect(page.locator('#btnPresent')).toBeEnabled();
});

test('presenting plays each step, back undoes it, and leaving shows the base diagram with the text untouched', async ({
                                                                                                                          app,
                                                                                                                          page
                                                                                                                      }) => {
    await openFlow(app, DOC);
    const before = await app.flowText(), payAt = await boxOf(app.shape('Pay'));
    await page.click('#btnPresent');
    await expect(page.locator('body')).toHaveClass(/presenting/);
    await expect(page.locator('#presentBar')).toBeVisible();
    await expect(page.locator('.bar')).toBeHidden();
    await expect(page.locator('#presentCount')).toHaveText('0 / 3');

    await page.keyboard.press('ArrowRight');                     // step 1: Pay moves down and turns green
    await expect(page.locator('#presentCount')).toHaveText('1 / 3');
    expect(await fillOf(app.shape('Pay'))).toBe('#C8E6C9');
    expect((await boxOf(app.shape('Pay'))).y).toBeGreaterThan(payAt.y + 20);

    await page.keyboard.press('Space');                          // step 3: Order becomes a terminator, Ship goes
    await expect(app.shape('Order')).toHaveAttribute('data-kind', 'terminator');
    await expect(app.shape('Ship')).toHaveCount(0);
    expect(await fillOf(app.shape('Pay'))).toBe('#C8E6C9');      // carried over from step 1

    await page.locator('#presentStep').selectOption('3');        // jump to step 4: Retry added, Ship back
    await expect(app.shape('Retry')).toBeVisible();
    await expect(app.shape('Ship')).toBeVisible();

    await page.keyboard.press('Home');
    await expect(app.shape('Order')).toHaveAttribute('data-kind', 'process');
    await expect(app.shape('Retry')).toHaveCount(0);
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');                      // back to step 3
    await expect(app.shape('Ship')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/presenting/);
    await expect(page.locator('#presentBar')).toHaveCount(0);
    await expect(app.shape('Order')).toHaveAttribute('data-kind', 'process');
    expect(await fillOf(app.shape('Pay'))).toBe('#DE2121');
    await expect(app.shape('Retry')).toHaveCount(0);
    expect(await app.flowText()).toBe(before);
    await expect(page.locator('#btnUndo')).toBeDisabled();       // presenting is not an edit
});

test('a click goes to the next step, and nothing on the page can be edited while presenting', async ({app, page}) => {
    await openFlow(app, DOC);
    const before = await app.flowText();
    await page.click('#btnPresent');
    await app.click('Pay');                                      // a click is next, not a selection
    await expect(page.locator('#presentCount')).toHaveText('1 / 3');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Control+z');
    await expect(page.locator('#presentCount')).toHaveText('1 / 3');
    await expect(app.shape('Pay')).toBeVisible();
    await page.click('#presentExit');
    await expect(app.shape('Pay')).toBeVisible();
    expect(await app.flowText()).toBe(before);
});

test('with motion on, a moved shape slides there and a shape that goes fades out', async ({app, page}) => {
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await openFlow(app, DOC);
    await page.click('#btnPresent');
    await page.waitForTimeout(100);
    const from = await boxOf(app.shape('Pay'));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);                              // partway: Pay is on its way down, the old look fading
    const mid = await boxOf(app.shape('Pay'));
    expect(mid.y).toBeGreaterThan(from.y + 1);
    expect(await page.locator('#ghosts > *').count()).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    const to = await boxOf(app.shape('Pay'));
    expect(to.y).toBeGreaterThan(mid.y + 1);
    await expect(page.locator('#ghosts > *')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');                     // Ship fades out as a ghost
    await expect(app.shape('Ship')).toHaveCount(0);
    await expect(page.locator('#ghosts > *').first()).toBeAttached();
    await page.keyboard.press('ArrowRight');                     // a key mid-fade finishes it first
    await expect(page.locator('#presentCount')).toHaveText('3 / 3');
    await page.waitForTimeout(600);
    await expect(page.locator('#ghosts > *')).toHaveCount(0);
});

test('connections hide with their shapes', async ({app, page}) => {
    await openFlow(app, DOC);
    expect((await app.connectionLines()).length).toBe(2);
    await page.click('#btnPresent');
    await page.locator('#presentStep').selectOption('2');        // step 3: Ship hidden, so pay -> ship goes too
    expect((await app.connectionLines()).length).toBe(1);
    await page.keyboard.press('Escape');
    expect((await app.connectionLines()).length).toBe(2);
});

test('a step that places one shape leaves the rest of a laid-out page where it was', async ({app, page}) => {
    await openFlow(app, [
        'flow 1', 'page "One"', 'a: process "A"', 'b: process "B"', 'c: process "C"', 'd: process "D"',
        'a -> b', 'b -> c', 'a -> d', '',
        '@animation start', 'step 1', '   $d @ 200,150', '@animation end', ''].join('\n'));
    const at = {};
    for (const s of ['A', 'B', 'C', 'D']) at[s] = await boxOf(app.shape(s));
    await page.click('#btnPresent');
    await page.waitForTimeout(100);   // fit runs on the next frame
    const was = {};
    for (const s of ['A', 'B', 'C', 'D']) was[s] = await boxOf(app.shape(s));
    await page.keyboard.press('ArrowRight');
    for (const s of ['A', 'B', 'C']) {
        const b = await boxOf(app.shape(s));
        expect(Math.abs(b.x - was[s].x)).toBeLessThan(1);
        expect(Math.abs(b.y - was[s].y)).toBeLessThan(1);
    }
    const d = await boxOf(app.shape('D'));
    expect(Math.abs(d.x - was.D.x) + Math.abs(d.y - was.D.y)).toBeGreaterThan(5);
});

test('the text pane marks what is wrong in the block, and warns about a shape twice in one step', async ({
                                                                                                             app,
                                                                                                             page
                                                                                                         }) => {
    await openFlow(app, DOC.replace('step 1\n', 'step 1\n   $pay [fill=#000000]\n'));
    await page.keyboard.press('Control+e');
    await expect(page.locator('#tpStatus')).toContainText('only that later line counts');
    await expect(page.locator('#codeGutter .warn')).toHaveCount(1);
    await page.locator('#codeText').fill(DOC.replace('   -$ship', '   -$ship\n   -$nobody'));
    await expect(page.locator('#tpStatus')).toContainText('There is no shape "nobody" for -$nobody.');
    await expect(page.locator('#codeGutter .err')).toHaveText(['15']);
});

test('Present picks up a step typed a moment ago, before it has been applied', async ({app, page}) => {
    await openFlow(app, DOC);
    await page.keyboard.press('Control+e');
    await page.locator('#tpPin').click();
    const code = page.locator('#codeText');
    await code.fill((await code.inputValue()).replace('@animation end', 'step 5\n   $order [fill=#000000]\n@animation end'));
    await page.click('#btnPresent');                             // straight away, inside the typing pause
    await expect(page.locator('#presentCount')).toHaveText('0 / 4');
    await page.waitForTimeout(600);                              // the pause runs out while presenting: nothing redraws
    await page.keyboard.press('End');
    expect(await fillOf(app.shape('Order'))).toBe('#000000');
    await page.keyboard.press('Escape');
});

test('a step on another page takes the presentation there, and leaving comes back', async ({app, page}) => {
    await openFlow(app, ['flow 1', 'page "One"', 'a: process "A" @ 10,10', 'page "Two"', 'b: process "B" @ 10,10', '',
        '@animation start', 'step 1', '   $b [fill=#C8E6C9]', '@animation end', ''].join('\n'));
    await expect(app.shape('A')).toBeVisible();
    await page.click('#btnPresent');
    await page.keyboard.press('ArrowRight');
    await expect(app.shape('B')).toBeVisible();
    expect(await fillOf(app.shape('B'))).toBe('#C8E6C9');
    await page.keyboard.press('Escape');
    await expect(app.shape('A')).toBeVisible();
});

test('right-click rename works on a $id in the block', async ({app, page}) => {
    await openFlow(app, DOC);
    await page.keyboard.press('Control+e');
    const code = page.locator('#codeText');
    await code.click();
    await code.evaluate(ta => {
        const at = ta.value.indexOf('$pay @') + 2;
        ta.setSelectionRange(at, at);
    });
    await page.keyboard.press('F2');
    await expect(page.locator('#renameInput')).toBeVisible();
    await page.locator('#renameInput').fill('payment');
    await page.keyboard.press('Enter');
    await expect(code).toHaveValue(/payment: process "Pay"[\s\S]*\$payment @ 80,60/);
});

test('adding a page and renaming a shape keep the block last and its $id lines right', async ({app, page}) => {
    await openFlow(app, DOC);
    await page.locator('#tabs button[aria-label="Add a page"]').click();
    let text = await app.flowText();
    expect(text.trimEnd().endsWith('@animation end')).toBe(true);
    expect(text.indexOf('page "Page-')).toBeLessThan(text.indexOf('@animation start'));
    await page.locator('#tabs button').first().click();
    await app.click('Pay');
    await page.locator('#pId').fill('payment');
    await page.keyboard.press('Enter');
    text = await app.flowText();
    expect(text).toContain('   $payment @ 80,60 [fill=#C8E6C9]');
    expect(text).not.toContain('$pay ');
});
