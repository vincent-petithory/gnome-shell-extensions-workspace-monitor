include include.mk

ACLOCAL_AMFLAGS = -I m4 ${ACLOCAL_FLAGS}

SUBDIRS = src po

zip-file: all
	-rm -fR $(abs_builddir)/$(uuid).zip
	-rm -fR $(builddir)/_build
	mkdir $(builddir)/_build; \
	$(MAKE) install DESTDIR="$(abs_builddir)/_build"; \
	cp -r "$(builddir)/_build$(extensiondir)" "$(builddir)/_build/"; \
	cp -r "$(builddir)/_build$(datadir)/locale" "$(builddir)/_build/$(uuid)"; \
	cp "$(srcdir)/COPYING" -t "$(builddir)/_build/$(uuid)"; \
	if [ -f "$(builddir)/_build$(datadir)/glib-2.0/schemas/$(gschemabase).$(extensionname).gschema.xml" ]; then \
		mkdir "$(builddir)/_build/$(uuid)/schemas"; \
		cp "$(builddir)/_build$(datadir)/glib-2.0/schemas/$(gschemabase).$(extensionname).gschema.xml" "$(builddir)/_build/$(uuid)/schemas"; \
		glib-compile-schemas "$(builddir)/_build/$(uuid)/schemas"; \
	fi; \
	(cd "$(builddir)/_build/$(uuid)"; \
		zip -qr "$(abs_builddir)/$(uuid).zip" .; \
	);
	-rm -fR $(builddir)/_build

local-install: zip-file
	mkdir -p $(localextensiondir) && unzip -o "$(abs_builddir)/$(uuid).zip" -d $(localextensiondir);

local-uninstall: Makefile
	-rm -fR $(localextensiondir)
