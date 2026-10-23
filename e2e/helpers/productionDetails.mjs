export async function openProductionDetails(page) {
  const details = page.locator('#design-details');
  if (!(await details.evaluate(element => element.open))) await details.locator(':scope > summary').click();
}
