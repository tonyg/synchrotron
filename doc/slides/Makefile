TARGETS=lca.png crisscross.png tricky.png history.png

all: $(TARGETS)

clean:
	rm -f $(TARGETS)

%.png: %.dot
	dot -Tpng $< > $@
