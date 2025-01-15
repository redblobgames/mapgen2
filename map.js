/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *      http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as util       from './util';
import * as Water      from './water';
import * as Elevation  from './elevation';
import * as Rivers     from './rivers';
import * as Moisture   from './moisture';
import * as Biomes     from './biomes';
import * as NoisyEdges from './noisy-edges';

/**
 * Map generator
 *
 * Map coordinates are 0 ≤ x ≤ 1000, 0 ≤ y ≤ 1000.
 *
 * mesh: TriangleMesh
 * noisyEdgeOptions: {length, amplitude, seed}
 * makeRandInt: function(seed) -> function(N) -> an int from 0 to N-1
 */
export class WorldMap {
    constructor(mesh, noisyEdgeOptions, makeRandInt) {
        this.mesh = mesh;
        this.makeRandInt = makeRandInt;
        this.lines_s = NoisyEdges.assign_lines_s(
            [],
            this.mesh,
            noisyEdgeOptions,
            this.makeRandInt(noisyEdgeOptions.seed)
        );

        this.water_r = [];
        this.ocean_r = [];
        this.coastdistance_t = [];
        this.elevation_t = [];
        this.s_downslope_t = [];
        this.elevation_r = [];
        this.flow_s = [];
        this.waterdistance_r = [];
        this.moisture_r = [];
        this.coast_r = [];
        this.temperature_r = [];
        this.biome_r = [];
    }

 
    calculate(options) {
        options = Object.assign({
            noise: null, // required: function(nx, ny) -> number from -1 to +1
            shape: {round: 0.5, inflate: 0.4, amplitudes: [1/2, 1/4, 1/8, 1/16]},
            numRivers: 30,
            drainageSeed: 0,
            riverSeed: 0,
            noisyEdge: {length: 10, amplitude: 0.2, seed: 0},
            biomeBias: {north_temperature: 0, south_temperature: 0, moisture: 0},
        }, options);

        Water.assign_water_r(this.water_r, this.mesh, options.noise, options.shape);
        Water.assign_ocean_r(this.ocean_r, this.mesh, this.water_r);
        
        Elevation.assign_elevation_t(
            this.elevation_t, this.coastdistance_t, this.s_downslope_t,
            this.mesh,
            this.ocean_r, this.water_r, this.makeRandInt(options.drainageSeed)
        );
        Elevation.redistribute_elevation_t(this.elevation_t, this.mesh);
        Elevation.assign_elevation_r(this.elevation_r, this.mesh, this.elevation_t, this.ocean_r);

        this.t_spring = Rivers.find_t_spring(this.mesh, this.water_r, this.elevation_t);
        util.randomShuffle(this.t_spring, this.makeRandInt(options.riverSeed));
        
        this.t_river = this.t_spring.slice(0, options.numRivers);
        Rivers.assign_flow_s(this.flow_s, this.mesh, this.s_downslope_t, this.t_river);
        
        Moisture.assign_moisture_r(
            this.moisture_r, this.waterdistance_r,
            this.mesh,
            this.water_r, Moisture.find_moisture_r_seeds(this.mesh, this.flow_s, this.ocean_r, this.water_r)
        );
        Moisture.redistribute_moisture_r(this.moisture_r, this.mesh, this.water_r,
                                         options.biomeBias.moisture, 1 + options.biomeBias.moisture);

        Biomes.assign_coast_r(this.coast_r, this.mesh, this.ocean_r);
        Biomes.assign_temperature_r(
            this.temperature_r,
            this.mesh,
            this.elevation_r,
            options.biomeBias.north_temperature, options.biomeBias.south_temperature
        );
        Biomes.assign_biome_r(
            this.biome_r,
            this.mesh,
            this.ocean_r, this.water_r, this.coast_r, this.temperature_r, this.moisture_r
        );
    }
}
