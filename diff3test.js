try {

function noisyLoad(filename) {
    print("Loading "+filename+"...");
    load(filename);
}

function assert(condition, explanation) {
    if (!condition) {
	throw {message: "Assertion failure", explanation: explanation};
    }
}

noisyLoad("json2.js");
noisyLoad("diff.js");

function DumpDiff3(o, a, b) {
    o = o ? o.split(/ /) : [];
    a = a ? a.split(/ /) : [];
    b = b ? b.split(/ /) : [];
    print(uneval(Diff.diff3_merge(a, o, b)));
}

DumpDiff3("AA ZZ 00 M 99",
	  "AA a b c ZZ new 00 a a M 99",
	  "AA a d c ZZ 11 M z z 99");

DumpDiff3("",
	  "A B C",
	  "A D C");

} catch (e) {
    print(uneval(e));
    quit(1);
}
