/**
 * The modular terrain's mesh, off the main thread (ModularTerrain.tsx). The arrays
 * are transferred back, not copied.
 */
import { terrainMesh, type TerrainOptions } from "./modular";

self.onmessage = (e: MessageEvent<TerrainOptions>) => {
	const m = terrainMesh(e.data);
	(self as unknown as Worker).postMessage(m, [m.pos.buffer, m.col.buffer, m.nrm.buffer, m.index.buffer]);
};
