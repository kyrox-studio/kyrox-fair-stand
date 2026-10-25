import { test, expect } from '@playwright/test';
import { disableAutoFurniture, keepWallLock } from './helpers/standSetup.mjs';

async function openScene(page, { frameIntervalMs = 0 } = {}) {
  // Observe the real controls without adding a production debug API.
  await page.route('**/src/scene3d.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    let body = source.replace(
      'const controls = new OrbitControls(camera, renderer.domElement);',
      'const controls = new OrbitControls(camera, renderer.domElement); window.__cameraControls = controls; window.__cameraRenderIdle = () => !editorRenderRequested;',
    ).replace(
      // Count frames the editor actually draws, not animation-loop ticks: an idle
      // scene keeps ticking but must not draw.
      'lastRenderAt = now;',
      'lastRenderAt = now; window.__renderCount = (window.__renderCount || 0) + 1;',
    );
    if (frameIntervalMs) {
      body = body.replace('renderer.setAnimationLoop((now) => {',
        `let testFrameAt = -Infinity;
        renderer.setAnimationLoop((now) => {
          if (now - testFrameAt < ${frameIntervalMs}) return;
          testFrameAt = now;`);
    }
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  const setup = page.locator('details.stand-setup-card');
  await setup.locator('summary').click();
  await setup.getByRole('button', { name: 'Ada Stand' }).click();
  await page.locator('#stand-size-x').fill('4');
  await page.locator('#stand-size-y').fill('4');
  await disableAutoFurniture(page);
  await page.locator('#create-stage').click();
  await page.locator('form input[name="projectName"]').fill('Camera lifecycle');
  await page.getByRole('button', { name: 'Projeyi Oluştur' }).click();
  await keepWallLock(page);
  await expect(page.locator('#viewport-empty')).toBeHidden();
  const box = await page.locator('#viewport > canvas').boundingBox();
  expect(box).not.toBeNull();
  return box;
}

for (const frameIntervalMs of [100, 250]) {
  test(`released camera settles at ${1000 / frameIntervalMs} FPS without blur`, async ({ page }) => {
    const box = await openScene(page, { frameIntervalMs });
    await rotate(page, box);
    await page.mouse.up();
    const settleRenders = await expectIdleAndRepeatable(page, box);
    // Damping is time-based, so released inertia must stop drawing within the
    // same wall-clock budget at every frame rate. Runner speed does not count.
    expect(settleRenders).toBeLessThan(4500 / frameIntervalMs);
  });
}

const renders = page => page.evaluate(() => window.__renderCount || 0);

const camera = page => page.evaluate(() => ({
  state: window.__cameraControls.state,
  position: window.__cameraControls.object.position.toArray(),
}));

async function rotate(page, box) {
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25, { steps: 4 });
  expect((await camera(page)).state).not.toBe(-1);
}

async function expectIdleAndRepeatable(page, box) {
  expect((await camera(page)).state).toBe(-1);
  const releasedRenders = await renders(page);
  // Retained damping is allowed to settle; released mouse motion must not restart orbit.
  // Son sönümleme karesi çizildikten sonra bekleyen son çizim de tüketilmelidir.
  // Düşük FPS koşulunda sabit 3,5 saniye bu iki kare arasına düşebilir.
  await page.waitForTimeout(3500);
  await expect.poll(() => page.evaluate(() => window.__cameraRenderIdle()), {
    timeout: 1000,
    intervals: [50],
  }).toBe(true);
  const settledRenders = await renders(page);
  const before = (await camera(page)).position;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.25, { steps: 5 });
  await page.waitForTimeout(500);
  const after = (await camera(page)).position;
  expect(Math.hypot(...after.map((v, i) => v - before[i]))).toBeLessThan(0.001);
  // A settled scene draws nothing, even while the released mouse moves over it.
  expect(await renders(page)).toBe(settledRenders);
  await rotate(page, box);
  await page.mouse.up();
  expect((await camera(page)).state).toBe(-1);
  return settledRenders - releasedRenders;
}

test('fast rotation and release outside the canvas leave orbit idle', async ({ page }) => {
  const box = await openScene(page);
  await rotate(page, box);
  await page.mouse.move(box.x - 10, box.y + 20);
  await page.mouse.up();
  const released = (await camera(page)).position;
  await page.waitForTimeout(100);
  const smoothed = (await camera(page)).position;
  expect(Math.hypot(...smoothed.map((v, i) => v - released[i]))).toBeGreaterThan(0.001);
  await expectIdleAndRepeatable(page, box);
});

for (const releaseFirst of [false, true]) {
test(`browser focus loss freezes ${releaseFirst ? 'released inertia' : 'active orbit'} and allows another drag`, async ({ page }) => {
  const box = await openScene(page);
  await page.evaluate(() => {
    window.__blurCount = 0;
    window.addEventListener('blur', event => {
      if (event.isTrusted) {
        window.__blurCount++;
        window.__blurPosition = window.__cameraControls.object.position.toArray();
      }
    }, { capture: true });
    const frame = document.createElement('iframe');
    frame.id = 'focus-target';
    frame.srcdoc = '<input aria-label="Focus destination">';
    document.body.append(frame);
  });
  const destination = page.frameLocator('#focus-target').getByRole('textbox');
  await expect(destination).toBeAttached();
  await rotate(page, box);
  if (releaseFirst) await page.mouse.up();
  // Chromium emits a trusted window blur when focus moves into another browsing
  // context. Tab activation is always focus-emulated in Playwright Chromium.
  await destination.focus();
  await expect.poll(() => page.evaluate(() => window.__blurCount)).toBeGreaterThan(0);
  expect((await camera(page)).state).toBe(-1);
  await page.waitForTimeout(250);
  const beforeBlur = await page.evaluate(() => window.__blurPosition);
  const afterBlur = (await camera(page)).position;
  expect(Math.hypot(...afterBlur.map((v, i) => v - beforeBlur[i]))).toBeLessThan(0.001);
  await page.mouse.up();
  await page.evaluate(() => { document.querySelector('#focus-target').remove(); window.focus(); });
  await expectIdleAndRepeatable(page, box);
});
}

for (const termination of ['pointercancel', 'lostpointercapture', 'mouseup']) {
  test(`${termination} ends orbit without disabling subsequent drags`, async ({ page }) => {
    const box = await openScene(page);
    await rotate(page, box);
    await page.evaluate(kind => {
      const el = window.__cameraControls.domElement;
      if (kind === 'lostpointercapture') el.releasePointerCapture(1);
      else if (kind === 'mouseup') window.dispatchEvent(new MouseEvent('mouseup'));
      else el.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' }));
    }, termination);
    if (termination === 'lostpointercapture') {
      // Native capture changes are processed before the next pointer input.
      await page.mouse.move(box.x + box.width * 0.74, box.y + box.height * 0.25);
    }
    await expect.poll(async () => (await camera(page)).state).toBe(-1);
    await page.mouse.up();
    await expectIdleAndRepeatable(page, box);
  });
}

test('a move with no mouse buttons repairs a missed release before controls consume it', async ({ page }) => {
  const box = await openScene(page);
  await rotate(page, box);
  await page.evaluate(() => {
    const el = window.__cameraControls.domElement;
    el.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 10, clientY: 10,
    }));
  });
  expect((await camera(page)).state).toBe(-1);
  await page.mouse.up();
  await expectIdleAndRepeatable(page, box);
});

test('selection modifiers and floor drawing keep their pointer ownership', async ({ page }) => {
  const box = await openScene(page);
  for (const key of ['Control', 'Meta']) {
    await page.keyboard.down(key);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    expect((await camera(page)).state).toBe(-1);
    await page.mouse.up();
    await page.keyboard.up(key);
  }
  await page.keyboard.press('t');
  await page.locator('#editor-mode-advanced').click();
  await page.locator('#floor-area-add').click();
  await page.locator('#floor-area-draw').click();
  await expect(page.locator('#floor-area-draw')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.mouse.down();
  expect(await page.evaluate(() => window.__cameraControls.enabled)).toBe(false);
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 4 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__cameraControls.enabled)).toBe(true);
  await expect(page.locator('#floor-area-draw')).toHaveAttribute('aria-pressed', 'false');
  await expectIdleAndRepeatable(page, box);
});
