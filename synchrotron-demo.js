var channel;
var tron;

function demoMain() {
    log("Starting.");

    openRabbitChannel(on_open, { debug: true, debugLogger: log });
    function on_open(c) {
	channel = c;
	log("on_open");
	tron = new Synchrotron(channel, "synchrotron");

	try {
	    try_patch();
	} catch (e) {
	    alert(e);
	}
    }
}

function try_patch() {
    var base = "the quick brown fox jumped over a dog".split(/\s+/);
    var derived1 = "the quick fox jumps over some lazy dog".split(/\s+/);
    var derived2 = "the quick brown fox jumps over some record dog".split(/\s+/);
    
    log({a: derived1});
    log({o: base});
    log({b: derived2});

    log({result1: Diff.diff3_merge(derived1, base, derived2)});
    log({result2: Diff.diff3_merge(derived1, base, derived2, true)});

    for (var i = 0; i < 16; i++) {
	log(random_uuid());
    }
}