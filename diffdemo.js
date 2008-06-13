function make_getter_setter(id, should_splitjoin) {
    return function (maybe_newval) {
        var elt = document.getElementById(id);
        if (maybe_newval) {
            elt.value = should_splitjoin ? maybe_newval.join(" ") : maybe_newval;
            return undefined;
        } else {
            return should_splitjoin ? elt.value.split(/ +/) : elt.value;
        }
    };
}

var f0 = make_getter_setter("f0", true);
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

function demo_diff1() {
    f3(uneval(Diff.diff_patch(f0(), f1())));
}

function demo_diff2() {
    f3(uneval(Diff.diff_patch(f0(), f2())));
}

function demo_diff3(excludeFalseConflicts) {
    f3(uneval(Diff.diff3_merge(f1(), f0(), f2(), excludeFalseConflicts)));
}

function demo_diff3_cooked(excludeFalseConflicts) {
    var merger = Diff.diff3_merge(f1(), f0(), f2(), excludeFalseConflicts);
    var lines = [];
    for (var i = 0; i < merger.length; i++) {
        var item = merger[i];
        if (item.ok) {
            lines = lines.concat(item.ok);
        } else {
            lines = lines.concat(["\n<<<<<<<<<\n"], item.conflict.a,
                                 ["\n=========\n"], item.conflict.b,
                                 ["\n>>>>>>>>>\n"]);
        }
    }
    f3(lines.join(" "));
}

function demo_diff3_dig_in() {
    var merger = Diff.diff3_merge(f1(), f0(), f2(), false);
    var lines = [];
    for (var i = 0; i < merger.length; i++) {
        var item = merger[i];
        if (item.ok) {
            lines = lines.concat(item.ok);
        } else {
            var c = Diff.diff_comm(item.conflict.a, item.conflict.b);
            for (var j = 0; j < c.length; j++) {
                var inner = c[j];
                if (inner.common) {
                    lines = lines.concat(inner.common);
                } else {
                    lines = lines.concat(["\n<<<<<<<<<\n"], inner.file1,
                                         ["\n=========\n"], inner.file2,
                                         ["\n>>>>>>>>>\n"]);
                }
            }
        }
    }
    f3(lines.join(" "));
}
