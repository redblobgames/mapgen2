/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

import { lerpv } from './util';

/**
 * Noisy edges is a variant of midpoint subdivision that keeps the lines
 * constrained to a quadrilateral. See the explanation here:
 * http://www.redblobgames.com/maps/noisy-edges/
 */

/**
 * Return the noisy line from a to b, within quadrilateral a-p-b-q,
 * as an array of points, not including a. The recursive subdivision
 * has up to 2^levels segments. Segments below a given length are
 * not subdivided further.
 */
const divisor = 0x10000000;
export function recursiveSubdivision(length, amplitude, randInt) {
    function recur(a, b, p, q) {
        let dx = a[0] - b[0], dy = a[1] - b[1];
        if (dx*dx + dy*dy < length*length) { return [b]; }
        
        let ap = lerpv(a, p, 0.5),
            bp = lerpv(b, p, 0.5),
            aq = lerpv(a, q, 0.5),
            bq = lerpv(b, q, 0.5);

        let division = 0.5 * (1 - amplitude) + randInt(divisor)/divisor * amplitude;
        let center = lerpv(p, q, division);
        
        let results1 = recur(a, center, ap, aq),
            results2 = recur(center, b, bp, bq);

        return results1.concat(results2);
    };
    return recur;
}


// TODO: this allocates lots of tiny arrays; find a data format that
// doesn't have so many allocations

export function assign_lines_s(lines_s, mesh, {amplitude, length}, randInt) {
    const subdivide = recursiveSubdivision(length, amplitude, randInt);
    lines_s.length = mesh.numSides;
    for (let s = 0; s < mesh.numSides; s++) {
        let t0 = mesh.t_inner_s(s),
            t1 = mesh.t_outer_s(s),
            r0 = mesh.r_begin_s(s),
            r1 = mesh.r_end_s(s);
        if (r0 < r1) {
            if (mesh.is_ghost_s(s)) {
                lines_s[s] = [mesh.pos_of_t(t1)];
            } else {
                lines_s[s] = subdivide(
                    mesh.pos_of_t(t0),
                    mesh.pos_of_t(t1),
                    mesh.pos_of_r(r0),
                    mesh.pos_of_r(r1)
                );
            }
            // construct line going the other way; since the line is a
            // half-open interval with [p1, p2, p3, ..., pn] but not
            // p0, we want to reverse all but the last element, and
            // then append p0
            let opposite = lines_s[s].slice(0, -1);
            opposite.reverse();
            opposite.push(mesh.pos_of_t(t0));
            lines_s[mesh.s_opposite_s(s)] = opposite;
        }
    }
    return lines_s;
};
