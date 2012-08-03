/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * dim.js
 * This file is part of workspace-monitor
 *
 * Copyright (C) 2012 - Vincent Petithory <vincent.petithory@gmail.com>
 *
 * workspace-monitor is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * workspace-monitor is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with workspace-monitor. If not, see <http://www.gnu.org/licenses/>.
 */

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

let extension = imports.misc.extensionUtils.getCurrentExtension();

var dimShader = undefined;

function getDimShaderSource() {
    if (!dimShader) {
        dimShader = Shell.get_file_contents_utf8_sync(
            extension.dir.get_child('dim.glsl').get_path()
        );
    }
    return dimShader;
}

const DimEffect = new Lang.Class({
    Name: 'DimEffect',

    _init: function(actor) {
        if (Clutter.feature_available(Clutter.FeatureFlags.SHADERS_GLSL)) {
            this._effect = new Clutter.ShaderEffect({ shader_type: Clutter.ShaderType.FRAGMENT_SHADER });
            this._effect.set_shader_source(getDimShaderSource());
        } else {
            this._effect = null;
        }

        this.actor = actor;
    },

    set dimFraction(fraction) {
        this._dimFraction = fraction;

        if (this._effect == null)
            return;

        if (fraction > 0.01) {
            Shell.shader_effect_set_double_uniform(this._effect, 'fraction', fraction);

            if (!this._effect.actor)
                this.actor.add_effect(this._effect);
        } else {
            if (this._effect.actor)
                this.actor.remove_effect(this._effect);
        }
    },

    get dimFraction() {
        return this._dimFraction;
    },

    _dimFraction: 0.0
});
