import * as THREE from 'three';

// Editör yardımcısıdır; ürün geometrisine ve proje verisine dahil edilmez.
export function createSelectionBoundsFrame(color) {
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.05,
      depthTest: false, depthWrite: false, transparent: true, opacity: 0.95, toneMapped: false }),
  );
  frame.renderOrder = 1000;
  frame.visible = false;
  frame.userData.isModuleSelectionVisual = true;
  frame.raycast = () => {};
  frame.computeLineDistances();
  return frame;
}

export function fitSelectionBoundsFrame(frame, bounds, padding = 0.02) {
  if (!bounds || bounds.isEmpty()) { frame.visible = false; return; }
  const size = bounds.getSize(new THREE.Vector3()).addScalar(padding);
  // Koordinatları geometriye yazmak kesiklerin dünya birimindeki aralığını korur.
  const positions = frame.geometry.attributes.position;
  const unit = frame.userData.unitPositions ??= positions.array.slice();
  for (let i = 0; i < positions.count; i += 1) {
    positions.setXYZ(i, unit[i * 3] * size.x, unit[i * 3 + 1] * size.y, unit[i * 3 + 2] * size.z);
  }
  positions.needsUpdate = true;
  frame.geometry.computeBoundingBox();
  frame.geometry.computeBoundingSphere();
  const distances = frame.geometry.attributes.lineDistance;
  for (let i = 0; i < positions.count; i += 2) {
    const start = i === 0 ? 0 : distances.getX(i - 1);
    distances.setX(i, start);
    distances.setX(i + 1, start + Math.hypot(
      positions.getX(i + 1) - positions.getX(i),
      positions.getY(i + 1) - positions.getY(i),
      positions.getZ(i + 1) - positions.getZ(i),
    ));
  }
  distances.needsUpdate = true;
  bounds.getCenter(frame.position);
  frame.visible = true;
}
