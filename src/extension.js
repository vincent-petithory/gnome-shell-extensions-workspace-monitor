/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * extension.js
 * Copyright (C) 2012 Vincent Petithory <vincent.petithory@gmail.com>
 *
 * workspace-monitor is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * workspace-monitor is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Gtk = imports.gi.Gtk;


let THUMBNAIL_MAX_SIZE = 300;

const WindowClone = new Lang.Class({
    Name: 'WindowClone',

    _init: function(realWindow, maxSize) {
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;
//        this.metaWindow._delegate = this;
        
        this.actor = new St.Bin();
        
        this._texture = realWindow.get_texture();
        let [width, height] = this._texture.get_size();
        let scale = Math.min(1.0, maxSize/width, maxSize/height);
        global.log("creating window with: scale="+scale+", width="+width+", height="+height+", sw="+width*scale+", sh="+height*scale);
        this._windowClone = new Clutter.Clone({
            source: this._texture,
            reactive: true,
            width: width*scale,
            height: height*scale
        });

        // Destroy the clone upon source destruction
        this._windowClone.source.connect('destroy', Lang.bind(this, function() {
            this._windowClone.destroy();
        }));
        this.actor.set_size(maxSize, maxSize);
        this.actor.add_actor(this._windowClone);
    }

});

const DockPanel = new Lang.Class({
    Name: 'DockPanel',

    _init: function() {
        let index = 0;
        this.monitorIndex = Main.layoutManager.primaryIndex;
        this.request_display = false;

        this.metaWorkspace = global.screen.get_workspace_by_index(index);
//        this._windowAddedId = this.metaWorkspace.connect('window-added',
//                                                          Lang.bind(this, this._windowAdded));
//        this._windowRemovedId = this.metaWorkspace.connect('window-removed',
//                                                           Lang.bind(this, this._windowRemoved));
        this.actor = new St.Bin({ style_class: 'dock-panel' });


        this._box = new St.BoxLayout({ vertical: true });
        this.actor.add_actor(this._box);

        let monitor = Main.layoutManager.primaryMonitor;

        // Listen to hide / show events of the Overview, to hide / show our panel accordingly
        this._overviewShowingId = Main.overview.connect('showing', Lang.bind(this, function() {
            if (this.request_display) {
                this.actor.hide();
            }
        }));
        this._overviewHiddenId = Main.overview.connect('hidden', Lang.bind(this, function() {
            if (this.request_display) {
                this.actor.show();
            }
        }));
    },

    // Tests if @win is interesting
    _isWindowInteresting: function (win) {
        let tracker = Shell.WindowTracker.get_default();
        return tracker.is_window_interesting(win.get_meta_window()) &&
               win.get_meta_window().showing_on_its_workspace() &&
               Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index());
    },

    update: function() {
        // Empty container
        this.actor.foreach(function (child) {
            this.remove(child);
        });
        let windows = global.get_window_actors().filter(this._isWindowInteresting, this);
        
        let monitor = Main.layoutManager.primaryMonitor;
        let maxHeight = (monitor.height - 2*(monitor.y + Panel.PANEL_ICON_SIZE + 10)) / windows.length;
        let maxSize = Math.max(THUMBNAIL_MAX_SIZE, maxHeight);
        global.log('windows = '+String(windows.length)+', maxSize='+maxSize);
        
        this.actor.x = monitor.x + monitor.width - maxSize;
        this.actor.y = monitor.y + Panel.PANEL_ICON_SIZE + 10;
        
        for (let i = 0; i < windows.length; i++) {
            // TODO Calculate the global available height.
            // TODO Calculate the available height for each window
            // TODO Calculate the corresponding width for a window
//            global.log('Window '+i.toString()+': '+windows[i].meta_window.get_wm_class().toString()+ ", "+windows[i].meta_window.get_window_type().toString());
            let windowClone = new WindowClone(windows[i], maxSize);
//            global.log('created clone '+i.toString()+': '+windows[i].meta_window.get_wm_class().toString()+ ", "+windows[i].meta_window.get_window_type().toString());
            this._box.add_actor(windowClone.actor);
//            global.log('added clone '+i.toString()+': '+windows[i].meta_window.get_wm_class().toString()+ ", "+windows[i].meta_window.get_window_type().toString());
        }
    },

    show: function() {
        this.request_display = true;
        this.update();
        this.actor.show();
    },

    hide: function() {
        this.request_display = false;
        this.actor.hide();
    },

    destroy: function() {
        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = 0;
        }

        if (this._overviewHiddenId) {
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = 0;
        }

        this.actor.destroy();
    }

});



function PopupMenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

PopupMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.icon = new St.Icon({ icon_name: icon,
                                  icon_type: St.IconType.FULLCOLOR,
                                  style_class: 'popup-menu-icon' });
        this.addActor(this.icon);
        this.label = new St.Label({ text: text });
        this.addActor(this.label);

        this.connect('activate', callback);
    }
};

function StatusButton(view) {
    this._init(view);
}

StatusButton.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function(view) {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'view-list');
        this._view = view;
        this.show_workspace_item = new PopupMenuItem(('Show'),
                                            Gtk.STOCK_REMOVE,
                                            Lang.bind(this, this._onShowWorkspace));
        this.menu.addMenuItem(this.show_workspace_item);
        Main.uiGroup.add_actor(this._view.actor);
        this._view.actor.hide();

    },

    _onShowWorkspace: function() {
        this._view.show()
    },

    destroy: function() {
        if (this._view != null) {
            Main.uiGroup.remove_actor(this._view.actor);
            this._view.destroy();
            this._view = null;
        }
    }

}


let status_button, dock_panel;

function init() {
    // Nothing
}

function enable() {
    if (dock_panel == null) {
        dock_panel = new DockPanel();
    }
    if (status_button == null) {
        status_button = new StatusButton(dock_panel);
        Main.panel.addToStatusArea('activator_button', status_button);
    }
}

function disable() {
    status_button.destroy();
    dock_panel.destroy();
}
