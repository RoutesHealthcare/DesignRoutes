import {test, expect} from './fixtures.js';

const openFlow = (app, text) => app.open({name: 'rename.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});
const DOC = [
    'flow 1',
    'page "One"',
    'box: container "Box" @ 10,10 150x90',
    'order: process "Place order" @ 20,25 [in=box]',
    'pay: process "Pay" @ 80,25 [in=box]',
    'order -> pay : "order"',
    'pay ..> ship   # order goes out here',
    '',
    'page "Two"',
    'order: process "Order"',
    ''].join('\n');
const code = page => page.locator('#codeText');

/* Opens the text pane with the caret just inside `word` on the line that starts with `lineStart` */
async function caretOn(page, lineStart, word) {
    await page.keyboard.press('Control+e');
    await code(page).click();
    await code(page).evaluate((ta, [ls, w]) => {
        const i = ta.value.split('\n').findIndex(l => l.startsWith(ls)),
            at = ta.value.split('\n').slice(0, i).join('\n').length + 1;
        const p = at + ta.value.split('\n')[i].indexOf(w) + 1;
        ta.setSelectionRange(p, p);
    }, [lineStart, word]);
}

/* Where `word` on the line starting `lineStart` is drawn in the text pane, for a right-click */
async function wordPosition(page, lineStart, word) {
    return code(page).evaluate((ta, [ls, w]) => {
        const lines = ta.value.split('\n'), i = lines.findIndex(l => l.startsWith(ls)), col = lines[i].indexOf(w) + 1;
        const c = document.createElement('canvas').getContext('2d');
        c.font = getComputedStyle(ta).font;
        const cw = c.measureText('0').width, pad = parseFloat(getComputedStyle(ta).paddingLeft);
        return {x: pad + col * cw + cw / 2 - ta.scrollLeft, y: 8 + i * 18 + 9 - ta.scrollTop};
    }, [lineStart, word]);
}

test('changing the id in the properties renames the shape everywhere on its page, as one undo step', async ({
                                                                                                                app,
                                                                                                                page
                                                                                                            }) => {
    await openFlow(app, DOC);
    await app.click('Pay');
    await expect(page.locator('#pId')).toHaveValue('pay');
    await page.locator('#pId').fill('payment');
    await page.keyboard.press('Enter');
    await expect(app.title).toHaveText('Process');            // still selected, under its new id
    await expect(page.locator('#pId')).toHaveValue('payment');
    const text = await app.flowText();
    expect(text).toContain('payment: process "Pay" @ 80,25 [in=box]');
    expect(text).toContain('order -> payment : "order"');
    expect(text).toContain('payment ..> ship   # order goes out here');   // the comment is left alone
    expect(text).toContain('page "Two"\norder: process "Order"');
    await page.mouse.click(5, 450);
    await page.keyboard.press('Control+z');
    expect(await app.flowText()).toBe(DOC);
});

test('renaming a container takes the shapes inside it along', async ({app, page}) => {
    await openFlow(app, DOC);
    await caretOn(page, 'box:', 'box');
    await page.keyboard.press('F2');
    await expect(page.locator('#renameInput')).toBeFocused();
    await expect(page.locator('#renameInput')).toHaveValue('box');
    await page.keyboard.type('frame');                           // the old id is selected, so typing replaces it
    await page.keyboard.press('Enter');
    await expect(page.locator('#renameBox')).toHaveCount(0);
    await expect(code(page)).toBeFocused();
    const text = await code(page).inputValue();
    expect(text).toContain('frame: container "Box" @ 10,10 150x90');
    expect(text).toContain('order: process "Place order" @ 20,25 [in=frame]');
    expect(text).toContain('pay: process "Pay" @ 80,25 [in=frame]');
});

test('an id that is taken or not an id is explained and changes nothing', async ({app, page}) => {
    await openFlow(app, DOC);
    await app.click('Place order');
    await page.locator('#pId').fill('pay');
    await page.keyboard.press('Enter');
    await expect(page.locator('#pIdProblem')).toContainText('"pay" is already used on this page.');
    await expect(page.locator('#pId')).toHaveValue('order');
    await page.locator('#pId').fill('2fast');
    await page.keyboard.press('Enter');
    await expect(page.locator('#pIdProblem')).toContainText('An id starts with a letter');
    expect(await app.flowText()).toBe(DOC);
});

test('right-clicking an id in the text offers Rename; right-clicking anything else is the browser menu', async ({
                                                                                                                    app,
                                                                                                                    page
                                                                                                                }) => {
    await openFlow(app, DOC);
    await page.keyboard.press('Control+e');
    await code(page).click();
    await code(page).click({button: 'right', position: await wordPosition(page, 'order ->', '"order"')});
    await expect(page.locator('#codeMenu')).toHaveCount(0);       // a label, even one spelt like an id
    await code(page).click({button: 'right', position: await wordPosition(page, 'order ->', 'pay')});
    await expect(page.locator('#codeMenu')).toContainText('Rename "pay"');
    await page.locator('#codeMenu li').click();
    await expect(page.locator('#renameInput')).toHaveValue('pay');
    await page.keyboard.type('payment');
    await page.keyboard.press('Enter');
    const text = await code(page).inputValue();
    expect(text).toContain('order -> payment : "order"');
    expect(text).toContain('payment: process "Pay"');
});

test('Escape in the rename box leaves the text as it was', async ({app, page}) => {
    await openFlow(app, DOC);
    await caretOn(page, 'pay ..>', 'ship');
    await page.keyboard.press('F2');
    await page.keyboard.type('dispatch');
    await page.keyboard.press('Escape');
    await expect(page.locator('#renameBox')).toHaveCount(0);
    expect(await code(page).inputValue()).toBe(DOC);
});

test('a property being edited applies to its own shape when the canvas is clicked', async ({app, page}) => {
    await openFlow(app, DOC);
    await app.click('Pay');
    await page.locator('#pText').fill('Take payment');
    await app.click('Place order');                               // straight onto another shape
    await expect(app.shape('Take payment')).toHaveCount(1);
    await expect(app.shape('Place order')).toHaveCount(1);        // not given the text instead
    await expect(page.locator('#pText')).toHaveValue('Place order');
});
