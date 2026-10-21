import {test, expect} from './fixtures.js';

/* The palette's search box: shapes and patterns by caption, type, the other names for a type, or tooltip */

const openFlow = (app, text) => app.open({name: 'search.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});
const box = page => page.locator('#paletteSearch');
const results = page => page.getByRole('region', {name: 'Search results'});

test.beforeEach(async ({app}) => {
    await openFlow(app, 'flow 1\npage "One"\na: process "Step" @ 10,10\n');
});

test('typing shows matching shapes and patterns in place of the groups, best match first', async ({page}) => {
    await box(page).fill('sticky');
    await expect(results(page).locator('button').first()).toHaveAttribute('data-kind', 'sticky');
    await expect(page.locator('.palette-groups')).toBeHidden();
    // another name for a type finds it too, and a pattern made of it comes up with it
    await box(page).fill('postit');
    await expect(results(page).locator('[data-kind="sticky"]')).toHaveCount(1);
    await box(page).fill('kanban');
    await expect(results(page).locator('[data-pattern="kanban"]')).toHaveCount(1);
    // every word has to match: two words narrow it down
    await box(page).fill('bpmn gateway');
    const kinds = await results(page).locator('button').evaluateAll(bs => bs.map(b => b.dataset.kind));
    expect(kinds).toEqual(expect.arrayContaining(['gateway', 'parallelgateway', 'inclusivegateway', 'eventgateway']));
    expect(kinds).not.toContain('decision');
    await box(page).fill('nothing like this');
    await expect(page.getByRole('status').filter({hasText: 'No shapes or patterns match'})).toBeVisible();
});

test('Enter adds the best match, a result can be clicked, and Escape brings the groups back as they were', async ({
                                                                                                                      app,
                                                                                                                      page
                                                                                                                  }) => {
    const wire = page.locator('.palette details', {has: page.locator('summary', {hasText: 'UI wireframe'})});
    await wire.locator('summary').click();                                   // open a group before searching
    await expect(wire).toHaveAttribute('open', '');
    await box(page).fill('treemap');
    await box(page).press('Enter');
    await expect(app.shapes.filter({hasText: 'Rent'})).toHaveCount(1);
    await box(page).fill('journey');
    await results(page).locator('[data-pattern="journey"]').click();
    await expect(app.shape('Customer journey')).toHaveCount(1);
    await box(page).fill('mood');
    await box(page).press('Escape');
    await expect(box(page)).toHaveValue('');
    await expect(page.locator('.palette-groups')).toBeVisible();
    await expect(wire).toHaveAttribute('open', '');                          // still open
    const text = await app.flowText();
    expect(text).toMatch(/: treemap "Rent/);
    expect(text).toMatch(/^journey: container "Customer journey"/m);
    expect(text).toContain('a: process "Step" @ 10,10');
});

test('typing in the search box doesn\'t trigger the editor\'s shortcuts', async ({app, page}) => {
    await app.click('Step');
    await expect(app.title).toHaveText('Process');
    await box(page).click();
    await page.keyboard.type('del');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    await expect(app.shape('Step')).toHaveCount(1);                          // the selected shape is still there
    await expect(box(page)).toHaveValue('de');
});
