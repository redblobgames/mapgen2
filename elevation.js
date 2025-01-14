/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

/**
 * Coast corners are connected to coast sides, which have
 * ocean on one side and land on the other
 */
function find_t_coasts(mesh, ocean_r) {
    let t_coasts = [];
    for (let s = 0; s < mesh.numSides; s++) {
        let r0 = mesh.r_begin_s(s);
        let r1 = mesh.r_end_s(s);
        let t = mesh.t_inner_s(s);
        if (ocean_r[r0] && !ocean_r[r1]) {
            // It might seem that we also need to check !ocean_r[r0] && ocean_r[r1]
            // and it might seem that we have to add both t and its opposite but
            // each t vertex shows up in *four* directed sides, so we only have to test
            // one fourth of those conditions to get the vertex in the list once.
            t_coasts.push(t);
        }
    }
    return t_coasts;
}


/**
 * Elevation is based on breadth first search from the seed points,
 * which are the coastal graph nodes. Since breadth first search also
 * calculates the 'parent' pointers, return those for use as the downslope
 * graph. To handle lakes, which should have all corners at the same elevation,
 * there are two deviations from breadth first search:
 * 1. Instead of pushing to the end of the queue, push to the beginning.
 * 2. Like uniform cost search, check if the new distance is better than
 *    previously calculated distances. It is possible that one lake corner
 *    was reached with distance 2 and another with distance 3, and we need
 *    to revisit that node and make sure it's set to 2.
 */
export function assign_elevation_t(
    elevation_t, coastdistance_t, s_downslope_t,
    mesh,
    ocean_r, water_r, randInt
) {
    coastdistance_t.length = mesh.numTriangles;
    s_downslope_t.length = mesh.numTriangles;
    elevation_t.length = mesh.numTriangles;
    coastdistance_t.fill(null);
    s_downslope_t.fill(-1);
    
    const is_ocean_t = (t) => ocean_r[mesh.r_begin_s(3*t)];
    const is_lake_r = (r) => water_r[r] && !ocean_r[r];
    const is_lake_s = (s) => is_lake_r(mesh.r_begin_s(s)) || is_lake_r(mesh.r_end_s(s));

    let s_out = [];
    let t_queue = find_t_coasts(mesh, ocean_r);
    t_queue.forEach((t) => { coastdistance_t[t] = 0; });
    let minDistance = 1, maxDistance = 1;
    
    while (t_queue.length > 0) {
        let t_current = t_queue.shift();
        mesh.s_around_t(t_current, s_out);
        let iOffset = randInt(s_out.length);
        for (let i = 0; i < s_out.length; i++) {
            let s = s_out[(i + iOffset) % s_out.length];
            let lake = is_lake_s(s);
            let neighbor_t = mesh.t_outer_s(s);
            let newDistance = (lake? 0 : 1) + coastdistance_t[t_current];
            if (coastdistance_t[neighbor_t] === null || newDistance < coastdistance_t[neighbor_t]) {
                s_downslope_t[neighbor_t] = mesh.s_opposite_s(s);
                coastdistance_t[neighbor_t] = newDistance;
                if (is_ocean_t(neighbor_t) && newDistance > minDistance) { minDistance = newDistance; }
                if (!is_ocean_t(neighbor_t) && newDistance > maxDistance) { maxDistance = newDistance; }
                if (lake) {
                    t_queue.unshift(neighbor_t);
                } else {
                    t_queue.push(neighbor_t);
                }
            }
        }
    }

    coastdistance_t.forEach((d, t) => {
        elevation_t[t] = is_ocean_t(t) ? (-d / minDistance) : (d / maxDistance);
    });
};


/** 
 * Set r elevation to the average of the t elevations. There's a
 * corner case though: it is possible for an ocean region (r) to be
 * surrounded by coastline corners (t), and coastlines are set to 0
 * elevation. This means the region elevation would be 0. To avoid
 * this, I subtract a small amount for ocean regions. */
export function assign_elevation_r(elevation_r, mesh, elevation_t, ocean_r) {
    const max_ocean_elevation = -0.01;
    elevation_r.length = mesh.numRegions;
    let t_out = [];
    for (let r = 0; r < mesh.numRegions; r++) {
        mesh.t_around_r(r, t_out);
        let elevation = 0.0;
        for (let t of t_out) {
            elevation += elevation_t[t];
        }
        elevation_r[r] = elevation/t_out.length;
        if (ocean_r[r] && elevation_r[r] > max_ocean_elevation) {
            elevation_r[r] = max_ocean_elevation;
        }
    }
    return elevation_r;
};


/**
 * Redistribute elevation values so that lower elevations are more common
 * than higher elevations. Specifically, we want elevation Z to have frequency
 * (1-Z), for all the non-ocean regions.
 */
// TODO: this messes up lakes, as they will no longer all be at the same elevation
export function redistribute_elevation_t(elevation_t, mesh) {
    // NOTE: This is the same algorithm I used in 2010, because I'm
    // trying to recreate that map generator to some extent. I don't
    // think it's a great approach for other games but it worked well
    // enough for that one.
    
    // SCALE_FACTOR increases the mountain area. At 1.0 the maximum
    // elevation barely shows up on the map, so we set it to 1.1.
    const SCALE_FACTOR = 1.1;

    let t_nonocean = [];
    for (let t = 0; t < mesh.numSolidTriangles; t++) {
        if (elevation_t[t] > 0.0) {
            t_nonocean.push(t);
        }
    }
    
    t_nonocean.sort((t1, t2) => elevation_t[t1] - elevation_t[t2]);

    for (let i = 0; i < t_nonocean.length; i++) {
        // Let y(x) be the total area that we want at elevation <= x.
        // We want the higher elevations to occur less than lower
        // ones, and set the area to be y(x) = 1 - (1-x)^2.
        let y = i / (t_nonocean.length-1);
        // Now we have to solve for x, given the known y.
        //  *  y = 1 - (1-x)^2
        //  *  y = 1 - (1 - 2x + x^2)
        //  *  y = 2x - x^2
        //  *  x^2 - 2x + y = 0
        // From this we can use the quadratic equation to get:
        let x = Math.sqrt(SCALE_FACTOR) - Math.sqrt(SCALE_FACTOR*(1-y));
        if (x > 1.0) x = 1.0;
        elevation_t[t_nonocean[i]] = x;
    }
};
