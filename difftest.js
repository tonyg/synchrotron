try {

    function noisyLoad(filename) {
	print("Loading "+filename+"...");
	load(filename);
    }

    /* NOTE: condition should return null for success */
    function assert(condition, explanation) {
	if (condition !== null) {
	    throw {message: "Assertion failure",
		   explanation: explanation,
		   witness: condition};
	}
    }

    noisyLoad("json2.js");
    noisyLoad("diff.js");

    function testRenderEqual(actual, expected) {
	var r1 = JSON.stringify(actual);
	var r2 = JSON.stringify(expected);
	if (r1 === r2) return null;
	return {actual: actual, expected: expected};
    }

    function flatLcs(f1, f2) {
	var result = [];
	for (var chain = Diff.longest_common_subsequence(f1, f2);
	     chain.chain !== null;
	     chain = chain.chain) {
	    result.push([chain.file1index, chain.file2index]);
	}
	result.reverse();
	return result;
    }

    function assertLcs(f1, f2, expected) {
	assert(testRenderEqual(flatLcs(f1, f2), expected),
	       {operation: "lcs", f1: f1, f2: f2});
    }

    var str1 = "The red brown fox jumped over the rolling log";
    var str2 = "The brown spotted fox leaped over the rolling log";

    var f1 = str1.split(/ /);
    var f2 = str2.split(/ /);

    assert(testRenderEqual(Diff.diff_comm(f1, f2),
			   [{common:["The"]},
			    {file1:["red"], file2:[]},
			    {common:["brown"]},
			    {file1:[], file2:["spotted"]},
			    {common:["fox"]},
			    {file1:["jumped"], file2:["leaped"]},
			    {common:["over", "the", "rolling", "log"]}]),
	   "Comm test failure");

    assertLcs(f1, f2, [[0,0],[2,1],[3,3],[5,5],[6,6],[7,7],[8,8]]);

    assertLcs('acbcaca', 'bcbcacb', [[1,1],[2,2],[3,3],[4,4],[5,5]]);
    assertLcs('bcbcacb', 'acbcaca', [[1,1],[2,2],[3,3],[4,4],[5,5]]);

    assertLcs('acba', 'bcbb', [[1,1],[2,2]]);

    assertLcs('abcabba', 'cbabac', [[2,0],[3,2],[4,3],[6,4]]);
    assertLcs('cbabac', 'abcabba', [[1,1],[2,3],[3,4],[4,6]]);

    assert(testRenderEqual(Diff.diff_comm(str1, str2),
			   [{common:["T", "h", "e", " "]},
			    {file1:["r", "e", "d", " "], file2:[]},
			    {common:["b", "r", "o", "w", "n", " "]},
			    {file1:[], file2:["s", "p", "o", "t", "t", "e", "d", " "]},
			    {common:["f", "o", "x", " "]},
			    {file1:["j", "u", "m"], file2:["l", "e", "a"]},
			    {common:["p", "e", "d", " ", "o", "v", "e", "r", " ",
				     "t", "h", "e", " ", "r", "o", "l", "l", "i", "n", "g", " ",
				     "l", "o", "g"]}]));

} catch (e) {
    print(JSON.stringify(e));
    quit(1);
}
