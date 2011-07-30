INDEX_MODFILES=demomod io jquery-1.6.2.min module boot_new boot_old sha1 objmem mc diff json2 graph showdown
INDEX_MODSOURCES=$(patsubst %,%.js,$(INDEX_MODFILES))
INDEX_MODSPECS=$(patsubst %,%.modspec.js,$(INDEX_MODFILES))
INDEX_BOOTMOD=net.lshift.synchrotron.demo

all: index.html

clean:
	rm -f index.html testIndex-*.html

index.html: bootimage.py $(INDEX_MODSOURCES) $(INDEX_MODSPECS)
	./bootimage.py $(INDEX_BOOTMOD) $(INDEX_MODFILES) > $@
