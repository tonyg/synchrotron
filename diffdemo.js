function make_getter_setter(id, should_splitjoin) {
    return function (maybe_newval) {
	var elt = document.getElementById(id);
	if (maybe_newval) {
	    elt.value = should_splitjoin ? maybe_newval.join(" ") : maybe_newval;
	} else {
	    return should_splitjoin ? elt.value.split(/ +/) : elt.value;
	}
    }
}

var f1 = make_getter_setter("f1", true);
var f2 = make_getter_setter("f2", true);
var f3 = make_getter_setter("f3", false);

function demo_lcs() {
    f3(uneval(Diff.longest_common_subsequence(f1(), f2())));
}

function demo_comm() {
    f3(uneval(Diff.diff_comm(f1(), f2())));
}

function demo_diff_patch() {
    f3(uneval(Diff.diff_patch(f1(), f2())));
}

function demo_invert() {
    p = eval(f3());
    Diff.invert_patch(p);
    f3(uneval(p));
}

function demo_apply_patch() {
    f2(Diff.patch(f1(), eval(f3())));
}
