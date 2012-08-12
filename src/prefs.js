/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * prefs.js
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
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;

let extension = imports.misc.extensionUtils.getCurrentExtension();
let Lib = extension.imports.lib;

const Gettext = imports.gettext.domain(Lib.GETTEXT_DOMAIN);
const _ = Gettext.gettext;

let settings;

const PrefsWidget = new Lang.Class({
    Name: 'PrefsWidget',
    
    _init: function(settings) {
        this._settings = settings;
    },
    
    create: function() {
        let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, border_width: 10});

        let box;

        box = this._createDisplaySettings();
        frame.add(box);

        box = this._createDisplayModeSetting();
        frame.add(box);

        box = this._createBehaviorSettings();
        frame.add(box);
        
        box = this._createWindowFilterSetting();
        frame.add(box);

        box = this._createActionSettings();
        frame.add(box);

        frame.show_all();

        return frame;
    },
    
    _createDisplaySettings: function() {
        let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_top: 5, margin_bottom: 5});

        let settingLabel = new Gtk.Label({label: "<b>"+_("Display")+"</b>",
                                           use_markup: true,
                                           xalign: 0});
        container.add(settingLabel);
        
        let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                                 margin_left: 20, margin_top: 5});
        container.add(vbox);
        
        // Panel Max width setting
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        let label = new Gtk.Label({label: _("Panel width"), margin_right: 5, xalign: 0});
        
        let spinButton = new Gtk.SpinButton({adjustment:
            new Gtk.Adjustment ({
                lower: 50,
                upper: Gdk.Screen.get_default().get_width()*0.5,
                step_increment: 1,
                page_increment: 10})
        });
        this._settings.bind(Lib.Settings.THUMBNAIL_MAX_SIZE_KEY, spinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        
        hbox.pack_start(label, true, true, 0);
        hbox.add(spinButton);
        
        vbox.add(hbox);
        
        // Display Icon setting
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        
        let label = new Gtk.Label({label: _("Show the window's application icon"), xalign: 0});
        let showAppIcon = new Gtk.Switch();
        this._settings.bind(Lib.Settings.SHOW_APP_ICON_KEY, showAppIcon, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        hbox.pack_start(label, true, true, 0);
        hbox.add(showAppIcon);
        
        vbox.add(hbox);
        
        // Dim unfocused windows setting
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        
        let label = new Gtk.Label({label: _("Dim unfocused windows"), xalign: 0});
        let dimUnfocusedWindows = new Gtk.Switch();
        this._settings.bind(Lib.Settings.DIM_UNFOCUSED_WINDOWS_KEY, dimUnfocusedWindows, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        hbox.pack_start(label, true, true, 0);
        hbox.add(dimUnfocusedWindows);
        
        vbox.add(hbox);

        return container;
    },

    _createDisplayModeSetting: function() {
        let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_top: 5, margin_bottom: 5});

        let settingLabel = new Gtk.Label({label: "<b>"+_("Display mode")+"</b>",
                                    use_markup: true,
                                    xalign: 0});
        
        let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                                 margin_left: 20, margin_top: 5});
        
        let dock = new Gtk.RadioButton({label: _("Dock")});
        let overlay = new Gtk.RadioButton({label: _("Overlay"),
                                                   group: dock});

        let displayMode = this._settings.get_string(Lib.Settings.DISPLAY_MODE_KEY);

        if (displayMode == 'dock')
            dock.set_active(true);
        else if (displayMode == 'overlay')
            overlay.set_active(true);

        dock.connect('toggled', Lang.bind(this, function(button) {
            if (button.get_active()) {
                hbox.set_no_show_all(false);
                this._settings.set_string(Lib.Settings.DISPLAY_MODE_KEY, 'dock');
                hbox.hide();
            }
        }));
        overlay.connect('toggled', Lang.bind(this, function(button) {
            if (button.get_active()) {
                hbox.set_no_show_all(false);
                this._settings.set_string(Lib.Settings.DISPLAY_MODE_KEY, 'overlay');
                hbox.show();
            }
        }));
        
        
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                                 margin_left: 20, margin_top: 5});
                                
        let settingLabel2 = new Gtk.Label({label:_("Visibility:"), margin_right: 5});
        let visibilityComboBoxText = new Gtk.ComboBoxText();
        visibilityComboBoxText.append('alwaysvisible', _("Always visible"));
        visibilityComboBoxText.append('intellihide', _("Intellihide"));
        visibilityComboBoxText.set_active_id(this._settings.get_string(Lib.Settings.PANEL_VISIBILITY_KEY));
        visibilityComboBoxText.connect('changed', Lang.bind(this, function() {
            this._settings.set_string(Lib.Settings.PANEL_VISIBILITY_KEY, visibilityComboBoxText.get_active_id());
        }));
        
        hbox.add(settingLabel2);
        hbox.add(visibilityComboBoxText);

        vbox.add(dock);
        vbox.add(overlay);
        vbox.add(hbox);
        
        hbox.show_all();
        if (this._settings.get_string(Lib.Settings.DISPLAY_MODE_KEY) == 'dock') {
            hbox.set_no_show_all(true);
            hbox.hide();
        }

        container.add(settingLabel);
        container.add(vbox);

        return container;
    },

    _createActionSettings: function() {
        let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_top: 5, margin_bottom: 5});

        let settingLabel = new Gtk.Label({label: "<b>"+_("Actions")+"</b>",
                                    use_markup: true,
                                    xalign: 0});
        container.add(settingLabel);
        
        let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                                 margin_left: 20, margin_top: 5});
        container.add(vbox);
        
        // Mouse wheel setting
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        
        let label = new Gtk.Label({label: _("Use the mouse wheel to switch of workspace"), xalign: 0});
        let useMouseWheelItem = new Gtk.Switch();
        this._settings.bind(Lib.Settings.USE_MOUSE_WHEEL_KEY, useMouseWheelItem, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        hbox.pack_start(label, true, true, 0);
        hbox.add(useMouseWheelItem);
        
        vbox.add(hbox);
        
        // Keybinding setting
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        
        let label = new Gtk.Label({label: _("Shortcut to show or hide the panel"), xalign: 0});
        let entry = new Gtk.Entry();
        let keybindings = this._settings.get_strv(Lib.Settings.TOGGLE_WORKSPACE_MONITOR_PANEL_KEYBINDING_KEY);
        if (keybindings && keybindings.length > 0) {
            entry.set_text(keybindings[0]);
        }
        entry.connect('changed', Lang.bind(this, function() {
             this._settings.set_strv(Lib.Settings.TOGGLE_WORKSPACE_MONITOR_PANEL_KEYBINDING_KEY, [entry.get_text()]);
        }));
        
        hbox.pack_start(label, true, true, 0);
        hbox.add(entry);
        
        vbox.add(hbox);
        
        return container;
    },

    _createBehaviorSettings: function() {
        let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_top: 5, margin_bottom: 5});

        let settingLabel = new Gtk.Label({label: "<b>"+_("Behavior")+"</b>",
                                    use_markup: true,
                                    xalign: 0});
        container.add(settingLabel);
        
        let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                                 margin_left: 20, margin_top: 5});
        container.add(vbox);
        
        // track active workspace
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        
        let label = new Gtk.Label({label: _("Always show the active workspace"), xalign: 0});
        let alwaysShowActiveWorkspace = new Gtk.Switch();
        this._settings.bind(Lib.Settings.ALWAYS_TRACK_ACTIVE_WORKSPACE_KEY, alwaysShowActiveWorkspace, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        hbox.pack_start(label, true, true, 0);
        hbox.add(alwaysShowActiveWorkspace);
        
        vbox.add(hbox);
        
        return container;
    },

    _createWindowFilterSetting: function() {
        let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, margin_top: 5, margin_bottom: 5});

        let settingLabel = new Gtk.Label({label: "<b>"+_("List of windows")+"</b>",
                                    use_markup: true,
                                    xalign: 0});
        
        let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                                 margin_left: 20, margin_top: 5});
        
        let onworkspaceFilterButton = new Gtk.RadioButton({label: _("Show all the windows of the selected workspace")});
        let notonworkspaceFilterButton = new Gtk.RadioButton({label: _("Show all the windows except those of the selected workspace"),
                                                   group: onworkspaceFilterButton});
        let customFilterButton = new Gtk.RadioButton({label: _("Custom window filtering"),
                                                   group: onworkspaceFilterButton});
        let customFilterExpander = new Gtk.Expander({label: _("Edit filter rules") ,margin_left: 20, margin_top: 5});
        let customWindowFilterEditor = new CustomWindowFilterEditor(this._settings);
        customFilterExpander.add(customWindowFilterEditor.widget);
        
        let windowFilter = this._settings.get_string(Lib.Settings.WINDOW_FILTER_KEY);
        if (windowFilter == 'WindowOnWorkspaceFilter') {
            onworkspaceFilterButton.set_active(true);
            customFilterExpander.set_sensitive(false);
        }
        else if (windowFilter == 'WindowNotOnWorkspaceFilter') {
            notonworkspaceFilterButton.set_active(true);
            customFilterExpander.set_sensitive(false);
        }
        else if (windowFilter == 'CustomWindowFilter') {
            customFilterButton.set_active(true);
            customFilterExpander.set_sensitive(true);
        }
        else {
            customFilterExpander.set_sensitive(false);
            onworkspaceFilterButton.set_active(true);
        }

        onworkspaceFilterButton.connect('toggled', Lang.bind(this, function(button) {
            if (button.get_active()) {
                this._settings.set_string(Lib.Settings.WINDOW_FILTER_KEY, 'WindowOnWorkspaceFilter');
                customFilterExpander.set_expanded(false);
                customFilterExpander.set_sensitive(false);
            }
        }, onworkspaceFilterButton));
        
        notonworkspaceFilterButton.connect('toggled', Lang.bind(this, function(button) {
            if (button.get_active()) {
                this._settings.set_string(Lib.Settings.WINDOW_FILTER_KEY, 'WindowNotOnWorkspaceFilter');
                customFilterExpander.set_expanded(false);
                customFilterExpander.set_sensitive(false);
            }
        }, notonworkspaceFilterButton));
        
        customFilterButton.connect('toggled', Lang.bind(this, function(button) {
            if (button.get_active()) {
                this._settings.set_string(Lib.Settings.WINDOW_FILTER_KEY, 'CustomWindowFilter');
                customFilterExpander.set_sensitive(true);
            }
        }, customFilterButton));
        
        
        vbox.add(onworkspaceFilterButton);
        vbox.add(notonworkspaceFilterButton);
        vbox.add(customFilterButton);
        vbox.add(customFilterExpander);

        container.add(settingLabel);
        container.add(vbox);

        return container;
    }
    
});

const CustomWindowFilterEditor = new Lang.Class({
    Name: 'CustomWindowFilterEditor',
    
    _init: function(settings) {
        this._settings = settings;
    },
    
    get widget() {
        if (!this._widget) {
            this._widget = new Gtk.Label({label: "WIP"});
        }
        return this._widget;
    },
    
    _widget: undefined

});

/*
   Shell-extensions handlers
*/

function init() {
    settings = Lib.getSettings(extension, 'workspace-monitor');
    Lib.initTranslations(extension);
}

function buildPrefsWidget() {
    let prefsWidget = new PrefsWidget(settings);
    return prefsWidget.create();
}
