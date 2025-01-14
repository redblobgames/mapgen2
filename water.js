// From http://www.redblobgames.com/maps/mapgen2/
// Copyright 2017 Red Blob Games <redblobgames@gmail.com>
// License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>

import * as util from './util';

// NOTE: water_r, ocean_r, other fields are boolean valued so it
// could be more efficient to pack them as bit fields in Uint8Array

/* a region is water if the noise value is low */
export function assign_water_r(water_r, mesh, noise, params) {
    water_r.length = mesh.numRegions;
    for (let r = 0; r < mesh.numRegions; r++) {
        if (mesh.is_ghost_r(r) || mesh.is_boundary_r(r)) {
            water_r[r] = true;
        } else {
            let nx = (mesh.x_of_r(r) - 500) / 500;
            let ny = (mesh.y_of_r(r) - 500) / 500;
            let distance = Math.max(Math.abs(nx), Math.abs(ny));
            let n = util.fbm_noise(noise, params.amplitudes, nx, ny);
            n = util.lerp(n, 0.5, params.round);
            water_r[r] = n - (1.0 - params.inflate) * distance*distance < 0;
        }
    }
    return water_r;
};


/* a region is ocean if it is a water region connected to the ghost region,
   which is outside the boundary of the map; this could be any seed set but
   for islands, the ghost region is a good seed */
export function assign_ocean_r(ocean_r, mesh, water_r) {
    ocean_r.length = mesh.numRegions;
    ocean_r.fill(false);
    let stack = [mesh.r_ghost()];
    let r_out = [];
    while (stack.length > 0) {
        let r1 = stack.pop();
        mesh.r_around_r(r1, r_out);
        for (let r2 of r_out) {
            if (water_r[r2] && !ocean_r[r2]) {
                ocean_r[r2] = true;
                stack.push(r2);
            }
        }
    }
    return ocean_r;
};
