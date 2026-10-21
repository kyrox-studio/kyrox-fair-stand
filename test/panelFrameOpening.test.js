import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPanelToFrameOpening } from '../src/wallPanelBand.js';

// 350 cm duvar, çerçeveden 4 cm iç pay: panel alanı 0,04 … 3,46 m.
const opening = Object.freeze({ bottomY: 0.04, topY: 3.46 });

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

test('bottom band starts at the inset above the frame bottom', () => {
  const fitted = fitPanelToFrameOpening(0.25, 0.5, opening);
  near(fitted.panelHeight, 0.46);
  near(fitted.centerY, 0.04 + 0.23);
});

test('top band ends at the inset below the frame top', () => {
  const fitted = fitPanelToFrameOpening(3.25, 0.5, opening);
  near(fitted.panelHeight, 0.46);
  near(fitted.centerY, 3.46 - 0.23);
});

test('bands inside the panel area keep their height and center', () => {
  const fitted = fitPanelToFrameOpening(1.75, 0.498, opening);
  near(fitted.panelHeight, 0.498);
  near(fitted.centerY, 1.75);
});

test('a band outside the panel area keeps a positive height', () => {
  const fitted = fitPanelToFrameOpening(0.01, 0.02, opening);
  assert.ok(fitted.panelHeight > 0);
});
