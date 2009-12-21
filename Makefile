INDEX_MODFILES=demomod io jquery-1.3.2.min module boot sha1 objmem mc json2 graph
INDEX_MODSOURCES=$(patsubst %,%.js,$(INDEX_MODFILES))
INDEX_MODSPECS=$(patsubst %,%.modspec.js,$(INDEX_MODFILES))
INDEX_BOOTMOD=net.lshift.synchrotron.demo

all: index.html

clean:
	rm -f index.html

index.html: bootimage.py $(INDEX_MODSOURCES) $(INDEX_MODSPECS)
	./bootimage.py $(INDEX_BOOTMOD) $(INDEX_MODFILES) > $@
