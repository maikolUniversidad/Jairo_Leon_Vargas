// ============================================================================
// UTL 360 · Descarga los GeoJSON del territorio a /public/geo (una sola vez).
// Uso (en una máquina con internet):  node scripts/fetch-geo.mjs
//
// Deja los polígonos servidos desde tu propio dominio, así el mapa dibuja cada
// localidad / barrio / departamento resaltado y enmarcado, sin depender de CORS
// ni de que un tercero esté disponible. Prueba varias fuentes por capa.
// ============================================================================
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "geo");

const LAYERS = [
  {
    file: "bogota-localidades.geojson",
    label: "Bogotá · Localidades",
    urls: [
      "https://services5.arcgis.com/l23kE3b7uPnZIuaB/arcgis/rest/services/Localidades_Bogota/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&resultRecordCount=1000&f=geojson",
    ],
  },
  {
    file: "bogota-barrios.geojson",
    label: "Bogotá · Barrios",
    urls: [
      "https://services5.arcgis.com/l23kE3b7uPnZIuaB/arcgis/rest/services/Barrios_Bogota/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&resultRecordCount=10000&f=geojson",
    ],
  },
  {
    file: "colombia-departamentos.geojson",
    label: "Colombia · Departamentos",
    urls: [
      "https://gist.githubusercontent.com/john-guerra/43c7656821069d00dcbc/raw/be6a6e239cd5b5b803c6e7c2ec405b793a9064dd/Colombia.geo.json",
    ],
  },
];

function isFeatureCollection(x) {
  return x && x.type === "FeatureCollection" && Array.isArray(x.features) && x.features.length > 0;
}

async function tryLayer(layer) {
  for (const url of layer.urls) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) { console.log(`   · ${res.status} ${url}`); continue; }
      const json = await res.json();
      if (!isFeatureCollection(json)) { console.log(`   · sin features ${url}`); continue; }
      await writeFile(join(OUT, layer.file), JSON.stringify(json));
      console.log(`✓ ${layer.label}: ${json.features.length} polígonos → public/geo/${layer.file}`);
      return true;
    } catch (e) {
      console.log(`   · error ${url} (${e.message})`);
    }
  }
  console.log(`✖ ${layer.label}: ninguna fuente respondió. Descarga el GeoJSON manualmente y guárdalo como public/geo/${layer.file}`);
  return false;
}

await mkdir(OUT, { recursive: true });
console.log("Descargando GeoJSON del territorio…\n");
let ok = 0;
for (const layer of LAYERS) if (await tryLayer(layer)) ok++;
console.log(`\nListo. ${ok}/${LAYERS.length} capas descargadas. Recarga /territorio para verlas.`);
