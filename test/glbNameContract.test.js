import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// scene3d.js bazı GLB parçalarını adıyla bulur: sandalye oturağını boyamak, çöp kutusundan
// fazlalığı silmek, koltuk parçalarını ayırmak gibi. Bir GLB yeniden dışa aktarılır,
// sıkıştırılır veya optimize edilirse bu adlar kaybolabilir ve testler yeşil kalırken
// sahnede yanlış renk / eksik parça çıkar (ör. meshopt optimize sonrası Eames oturağı ahşap
// renginde kaldı: aynı renkteki malzemeler birleştirildi, `plastic_wit` silindi).
// Bu test kodun aradığı her adın ilgili GLB içinde durduğunu kilitler.

const MODELS = new URL('../public/models/', import.meta.url);
const SCENE_SOURCE = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');

function readGlbJson(fileName) {
  const buffer = readFileSync(new URL(fileName, MODELS));
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF', `${fileName} bir GLB değil`);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.toString('ascii', 16, 20), 'JSON', `${fileName} ilk chunk JSON değil`);
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
}

function namesOf(gltf) {
  return {
    nodes: (gltf.nodes ?? []).map((node) => node.name).filter(Boolean),
    meshes: (gltf.meshes ?? []).map((mesh) => mesh.name).filter(Boolean),
    materials: (gltf.materials ?? []).map((material) => material.name).filter(Boolean),
  };
}

// Bir malzemeyi en az bir primitive kullanıyor mu? Silinmemiş ama hiçbir parçaya bağlı
// olmayan malzeme sahnede de bulunamaz.
function primitiveMaterialNames(gltf) {
  const names = [];
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const material = gltf.materials?.[primitive.material];
      if (material?.name) names.push(material.name);
    }
  }
  return names;
}

const BEIGE_SOFA_MESHES = (() => {
  const block = SCENE_SOURCE.match(/const BEIGE_SOFA_MESH = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(block, 'BEIGE_SOFA_MESH tanımı scene3d.js içinde bulunamadı');
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
})();

// Kodun adla aradığı her şey: dosya → aranan ad ve nerede arandığı.
const REQUIREMENTS = [
  {
    file: 'eames_chair.glb',
    why: 'oturak plastic_wit ile boyanır, bacaklar Material1 ile ahşap rengi alır',
    usedMaterials: ['plastic_wit', 'Material1'],
  },
  {
    file: 'bar_chair.glb',
    why: 'oturak Burlington_Leather (veya düğüm adı) ile bulunup boyanır',
    anyOf: [
      { kind: 'nodes', name: 'Cube.001_Burlington Leather_0' },
      { kind: 'materials', name: 'Burlington_Leather' },
    ],
  },
  {
    file: 'plastic_trash_bin.glb',
    why: 'Sphere_1 fazlalık olarak silinir, Object_5 gövde beyaza boyanır',
    nodes: ['Sphere_1', 'Object_5'],
  },
  {
    file: 'bej_koltuk_1_ciftli_2_tekli.glb',
    why: 'ikili ve iki tekli koltuk getObjectByName ile ayrı yerleştirilir (BEIGE_SOFA_MESH)',
    nodes: BEIGE_SOFA_MESHES,
  },
  ...['saksi_bitkili_100x30x30.glb', 'saksi_bitkili_150x30x30.glb', 'saksi_bitkili_200x30x30.glb'].map((file) => ({
    file,
    why: 'saksı gövdesi /planter|plant_pot|pot_0/i ile bulunup boyanır',
    pattern: /planter|plant_pot|pot_0/i,
  })),
  ...['wall_separator_50_sarmasik.glb', 'wall_separator_100_sarmasik.glb'].map((file) => ({
    file,
    why: 'yalnız /Vines_FIXED_/i sarmaşık parçaları görünür kalır',
    pattern: /Vines_FIXED_/i,
  })),
];

for (const requirement of REQUIREMENTS) {
  test(`${requirement.file}: kodun adla aradığı parçalar duruyor (${requirement.why})`, () => {
    const gltf = readGlbJson(requirement.file);
    const names = namesOf(gltf);

    for (const name of requirement.nodes ?? []) {
      assert.ok(names.nodes.includes(name), `${requirement.file}: "${name}" düğümü yok`);
    }

    if (requirement.usedMaterials) {
      const used = primitiveMaterialNames(gltf);
      for (const name of requirement.usedMaterials) {
        assert.ok(names.materials.includes(name), `${requirement.file}: "${name}" malzemesi yok`);
        assert.ok(used.includes(name), `${requirement.file}: "${name}" malzemesi hiçbir parçaya bağlı değil`);
      }
      // Aynı parça iki rolü birden alamaz: oturak ve bacak ayrı malzemede kalmalı.
      assert.equal(new Set(requirement.usedMaterials).size, requirement.usedMaterials.length);
    }

    if (requirement.anyOf) {
      assert.ok(
        requirement.anyOf.some(({ kind, name }) => names[kind].includes(name)),
        `${requirement.file}: ${requirement.anyOf.map(({ name }) => `"${name}"`).join(' veya ')} bulunamadı`,
      );
    }

    if (requirement.pattern) {
      const all = [...names.nodes, ...names.meshes, ...names.materials];
      assert.ok(all.some((name) => requirement.pattern.test(name)), `${requirement.file}: ${requirement.pattern} ile eşleşen parça yok`);
    }
  });
}

test('scene3d.js içindeki her GLB ad karşılaştırması bu testin listesinde', () => {
  const literals = new Set();
  for (const match of SCENE_SOURCE.matchAll(/\b(?:object|child)\.(?:material\?\.)?name === '([^']+)'/g)) {
    literals.add(match[1]);
  }
  const covered = new Set(REQUIREMENTS.flatMap((requirement) => [
    ...(requirement.nodes ?? []),
    ...(requirement.usedMaterials ?? []),
    ...(requirement.anyOf ?? []).map(({ name }) => name),
  ]));
  const missing = [...literals].filter((name) => !covered.has(name));
  assert.deepEqual(missing, [], `scene3d.js yeni bir GLB adına bağlandı; REQUIREMENTS listesine ekle: ${missing.join(', ')}`);
  assert.ok(literals.size >= 5, 'ad karşılaştırmaları bulunamadı; test kalıbı güncellenmeli');
});
