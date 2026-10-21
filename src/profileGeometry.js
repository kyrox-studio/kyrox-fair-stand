import * as THREE from 'three';

// Alüminyum profilin dört uzun yüzünün ortasında boyuna kanal (T-kanal görünümü). Yalnız görünüm;
// dış ölçü kutuyla aynıdır. Kanal ağzı/derinliği kesit yüzünün en fazla %40 / %30'u kadar olur.
export const PROFILE_SLOT_WIDTH_M = 0.02;
export const PROFILE_SLOT_DEPTH_M = 0.015;

function createProfileSectionShape(sizeU, sizeV) {
  const halfU = sizeU / 2;
  const halfV = sizeV / 2;
  const slotU = Math.min(PROFILE_SLOT_WIDTH_M, sizeU * 0.4) / 2;
  const slotV = Math.min(PROFILE_SLOT_WIDTH_M, sizeV * 0.4) / 2;
  const depthU = Math.min(PROFILE_SLOT_DEPTH_M, sizeU * 0.3);
  const depthV = Math.min(PROFILE_SLOT_DEPTH_M, sizeV * 0.3);
  const points = [
    [-halfU, -halfV], [-slotU, -halfV], [-slotU, -halfV + depthV], [slotU, -halfV + depthV], [slotU, -halfV],
    [halfU, -halfV], [halfU, -slotV], [halfU - depthU, -slotV], [halfU - depthU, slotV], [halfU, slotV],
    [halfU, halfV], [slotU, halfV], [slotU, halfV - depthV], [-slotU, halfV - depthV], [-slotU, halfV],
    [-halfU, halfV], [-halfU, slotV], [-halfU + depthU, slotV], [-halfU + depthU, -slotV], [-halfU, -slotV],
  ];
  return new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u, v)));
}

// BoxGeometry(sizeX, sizeY, sizeZ) yerine: en uzun eksen profil boyudur, diğer ikisi kesittir.
// Kesit uzun eksen boyunca uzatılır; geometri kutu gibi merkezlidir.
export function createSlottedProfileGeometry(sizeX, sizeY, sizeZ) {
  const longest = Math.max(sizeX, sizeY, sizeZ);
  if (longest === sizeY) {
    const geometry = new THREE.ExtrudeGeometry(createProfileSectionShape(sizeX, sizeZ), { depth: sizeY, bevelEnabled: false });
    geometry.translate(0, 0, -sizeY / 2);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }
  if (longest === sizeX) {
    const geometry = new THREE.ExtrudeGeometry(createProfileSectionShape(sizeZ, sizeY), { depth: sizeX, bevelEnabled: false });
    geometry.translate(0, 0, -sizeX / 2);
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }
  const geometry = new THREE.ExtrudeGeometry(createProfileSectionShape(sizeX, sizeY), { depth: sizeZ, bevelEnabled: false });
  geometry.translate(0, 0, -sizeZ / 2);
  return geometry;
}
