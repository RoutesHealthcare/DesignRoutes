import {test, expect} from './fixtures.js';

test('Credits shows the map data credits and every bundled licence, and closes', async({app,page})=>{
  await page.click('#btnCredits');
  const dlg=page.locator('#creditsDlg'), text=page.locator('#creditsText');
  await expect(dlg).toBeVisible();
  await expect(text).toContainText('Contains OS data © Crown copyright and database right 2025');
  await expect(text).toContainText('Open Government Licence v.3.0');
  await expect(text).toContainText('OS OpenData licence');
  await expect(text).toContainText('Natural Earth');
  for(const pkg of ['React','React DOM','JSZip','pako']) await expect(text.locator('h4',{hasText:pkg}).first()).toBeVisible();
  await expect(text).toContainText('Copyright (c) Meta Platforms, Inc. and affiliates.');
  await expect(text).toContainText('Copyright (c) 2026 Routes Healthcare');
  await page.click('#creditsClose');
  await expect(dlg).toBeHidden();
});
