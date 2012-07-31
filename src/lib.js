/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * lib.js
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


const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const GETTEXT_DOMAIN = 'gnome-shell-extensions-workspace-monitor';
const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.workspace-monitor';
const Settings = {
    DISPLAY_MODE_KEY: 'display-mode',
    THUMBNAIL_MAX_SIZE_KEY: 'thumbnail-max-size',
    USE_MOUSE_WHEEL_KEY: 'use-mouse-wheel',
    ALWAYS_SHOW_ACTIVE_WORKSPACE: 'always-show-active-workspace',
    TOGGLE_WORKSPACE_MONITOR_PANEL_KEYBINDING: 'toggle-workspace-monitor-panel-keybinding'
}

function getSettings(extension) {
    let schemaDir = extension.dir.get_child('schemas').get_path();

    // Extension installed in .local
    if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
        let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir,
                                  Gio.SettingsSchemaSource.get_default(),
                                  false);
        let schema = schemaSource.lookup(SETTINGS_SCHEMA, false);

        return new Gio.Settings({settings_schema: schema});
    }
    // Extension installed system-wide
    else {
        if (Gio.Settings.list_schemas().indexOf(SETTINGS_SCHEMA) == -1)
            throw "Schema \"%s\" not found.".format(SETTINGS_SCHEMA);
        return new Gio.Settings({schema: SETTINGS_SCHEMA});
    }
}

function initTranslations(extension) {
    let localeDir = extension.dir.get_child('locale').get_path();

    // Extension installed in .local
    if (GLib.file_test(localeDir, GLib.FileTest.EXISTS)) {
        Gettext.bindtextdomain(GETTEXT_DOMAIN, localeDir);
    }
    // Extension installed system-wide
    else {
        Gettext.bindtextdomain(GETTEXT_DOMAIN, extension.metadata.locale);
    }
}
