/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * windowfilter.js
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


const Lang = imports.lang;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

let extension = imports.misc.extensionUtils.getCurrentExtension();
let Lib = extension.imports.lib;


const WindowFilter = new Lang.Class({
    Name: 'WindowFilter',
    Abstract: true,
    
    _init: function() {
        this.tracker = Shell.WindowTracker.get_default();
    },
    
    filter: function(realWindow, metaWindow, metaWorkspace) {
        return true;
    }
    
});

function create(name) {
    if (this.hasOwnProperty(name)) {
        let Classs = this[name];
        try {
            let instance = new Classs();
            return instance;
        }
        catch (e) {
            return new WindowOnWorkspaceFilter();
        }
    } else {
        return new WindowOnWorkspaceFilter();
    }
}

const WindowOnWorkspaceFilter = new Lang.Class({
    Name: 'WindowOnWorkspaceFilter',
    Extends: WindowFilter,
    
    _init: function() {
        this.parent();
    },
    
    filter: function(realWindow, metaWindow, metaWorkspace) {
        let interesting = this.tracker.is_window_interesting(metaWindow) &&
           metaWindow.showing_on_its_workspace();
        let onWorkspace = Main.isWindowActorDisplayedOnWorkspace(realWindow, metaWorkspace.index());
        return interesting && onWorkspace;
    }
    
});

const WindowNotOnWorkspaceFilter = new Lang.Class({
    Name: 'WindowNotOnWorkspaceFilter',
    Extends: WindowFilter,
    
    _init: function() {
        this.parent();
    },
    
    filter: function(realWindow, metaWindow, metaWorkspace) {
        let interesting = this.tracker.is_window_interesting(metaWindow) &&
           metaWindow.showing_on_its_workspace();
        let onWorkspace = Main.isWindowActorDisplayedOnWorkspace(realWindow, metaWorkspace.index());
        return interesting && !onWorkspace;
    }
    
});

const CustomWindowFilter = new Lang.Class({
    Name: 'CustomWindowFilter',
    Extends: WindowFilter,
    
    _init: function() {
        this.parent();
        this._settings = Lib.getSettings(extension, 'workspace-monitor');
    },
    
    filter: function(realWindow, metaWindow, metaWorkspace) {
        try {
            let data = this._settings.get_string(Lib.Settings.CUSTOM_WINDOW_FILTER_DATA_KEY);
            return eval(data);
        } catch (e) {
            global.logError("[Workspace Monitor] Your CustomWindowFilter data has JS Error: "+e.message);
            return true;
        }
    }
    
});


