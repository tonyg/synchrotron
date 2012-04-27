INDEX_MODFILES=\
	demomod io jquery-1.6.2.min \
	module boot_new boot_old \
	sha1 objmem mc diff json2 graph showdown \
	panels knockout-1.2.1.debug mustache \
	codemirror codemirror-javascript \
	renderrepo repl
INDEX_STYLES=\
	synchrotron.css panels.css \
	codemirror.css codemirror-theme-default.css
INDEX_SKINS=$(wildcard skins/*)
INDEX_TEXTFILES=FrontPage.txt

INDEX_BOOTMOD=net.lshift.synchrotron.demo

INDEX_MODSOURCES=$(patsubst %,%.js,$(INDEX_MODFILES))
INDEX_MODSPECS=$(patsubst %,%.modspec.js,$(INDEX_MODFILES))

all: index.html

clean:
	rm -f index.html testIndex-*.html

index.html: bootimage.py $(INDEX_MODSOURCES) $(INDEX_MODSPECS) $(INDEX_STYLES) $(INDEX_SKINS)
	./bootimage.py $(INDEX_BOOTMOD) \
		--skins $(INDEX_SKINS) \
		--styles $(INDEX_STYLES) \
		--modules $(INDEX_MODFILES) \
		--textfiles $(INDEX_TEXTFILES) \
	> $@
