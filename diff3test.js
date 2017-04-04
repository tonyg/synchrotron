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

/*
AA
<<<<<<< a
a
b
c
||||||| o
=======
a
d
c
>>>>>>> b
ZZ
<<<<<<< a
new
00
a
a
||||||| o
00
=======
11
>>>>>>> b
M
z
z
99
*/

DumpDiff3("",
	  "A B C",
	  "A D C");

DumpDiff3("0 1 2 A X DD C Y E",
	  "0 1 2 A X DD op BB Y E",
	  "0 1 2 A AA C Y E");
/*
Output from immediately previous should, but doesn't, match what
diff3 -m says:

0
1
2
A
<<<<<<< a
X
DD
op
BB
||||||| o
X
DD
C
=======
AA
C
>>>>>>> b
Y
E

2017-04-04 12:07:27 Actually that seems no longer to be true -- the
output looks logically identical to the diff3 output just above.

*/

DumpDiff3("0 1 2 A X DD C Y E",
	  "0 1 2 A op BB X DD C Y E",
	  "0 1 2 A AA C Y E");

/*
0
1
2
A
<<<<<<< a
op
BB
X
DD
||||||| o
X
DD
=======
AA
>>>>>>> b
C
Y
E
*/

DumpDiff3("a b c", "A b c", "a B c");
/*

<<<<<<< a
A
b
||||||| o
a
b
=======
a
B
>>>>>>> b
c

*/

} catch (e) {
    print(uneval(e));
    quit(1);
}
