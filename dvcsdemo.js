// Copyright (c) 2008 Tony Garnock-Jones <tonyg@lshift.net>
// Copyright (c) 2008 LShift Ltd. <query@lshift.net>
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
// BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

var repo = new Dvcs.Repository();
var fs = repo.update(null);
var dirty = false;
var mergeAncestor = null;

Dvcs._debugMode = true;

function redisplay_repository_history() {
    var ordering = DrawDvcs.renderRepository(repo);
    var html = "";
    for (var i = 0; i < ordering.length; i++) {
	var item = ordering[i];
	var pictures = item.pictures;
	for (var j = 0; j < pictures.length; j++) {
	    html = html + "<img src='img/" + pictures[j] + "' />";
	}
	html = html + "<span class='historyline'><span id='" + item.revId +
	    "' class='nonselected'>" +
	    "<span onclick='maybeSelectRev(\"" + item.revId + "\")'>" + item.revId + "</span>" +
	    " <span class='mergecommand" +
	    "' onclick='maybeMergeRev(\"" + item.revId + "\")'>(m)</span></span></span><br />\n";
    }
    document.getElementById("historyContainer").innerHTML =
	"<p style='line-height: 0px; white-space: nowrap;'>" + html + "</p>";
}

function set_rev_span(className, revId) {
    var revSpan = document.getElementById(revId || fs.directParent);
    if (revSpan) {
	revSpan.className = className;
    }
}

function mark_dirty(newValue, comment) {
    if (newValue && !dirty) { set_rev_span("dirty"); }
    dirty = newValue;
    document.getElementById("revertbutton").disabled = newValue ? "" : "disabled";
    document.getElementById("commitbutton").disabled = newValue ? "" : "disabled";
    var stateSpan = document.getElementById("statespan");
    if (dirty) {
	if (comment != undefined || stateSpan.innerHTML === "")  {
	    stateSpan.innerHTML = comment ? comment : "Files changed";
	}
    } else {
	stateSpan.innerHTML = "";
    }
}

function sync_view_of_fs() {
    var workspace = document.getElementById("workspace");
    workspace.innerHTML = "";
    for (var inode in fs.inodes) {
	var inodeDiv = document.createElement("div");
	workspace.appendChild(inodeDiv);
	var filename = document.createElement("input");
	filename.value = fs.getProp(inode, "name");
	filename.size = 70;
	filename.onkeyup = function () {
	    fs.setProp(inode, "name", filename.value);
	    mark_dirty(true);
	};
	inodeDiv.appendChild(filename);
	var deleteButton = document.createElement("button");
	deleteButton.innerHTML = "Delete";
	deleteButton.onclick = function () {
	    fs.deleteFile(inode);
	    mark_dirty(true);
	    inodeDiv.className = "deletedFile";
	};
	inodeDiv.appendChild(deleteButton);
	inodeDiv.appendChild(document.createElement("br"));
	var contents = document.createElement("textarea");
	contents.cols = 80;
	contents.rows = 10;
	contents.value = fs.getProp(inode, "text").join("\n");
	contents.onkeyup = function () {
	    fs.setProp(inode, "text", contents.value.split(/\n/));
	    mark_dirty(true);
	};
	inodeDiv.appendChild(contents);
    }
    set_rev_span(dirty ? "dirty" : "clean");

    //document.getElementById("log").innerHTML = "";
    dumpRepo();
}

function maybeSelectRev(revId) {
    if (!dirty) {
	selectRev(revId);
    }
}

function maybeMergeRev(revId) {
    if (!dirty) {
	var m = repo.merge(fs.directParent, revId);
	fs = m.files;
	for (var i = 0; i < m.conflicts.length; i++) {
	    var conflictRecord = m.conflicts[i];
	    var inode = conflictRecord.inode;
	    for (var okProp in conflictRecord.partialResult) {
		fs.setProp(inode, okProp, conflictRecord.partialResult[okProp]);
	    }
	    for (var badProp in conflictRecord.conflictDetails) {
		var merger = conflictRecord.conflictDetails[badProp];
		if (badProp == "name") {
		    fs.setProp(inode, "name", merger[0].conflict.a + " / " + merger[0].conflict.b);
		} else if (badProp == "text") {
		    fs.setProp(inode, "text", build_conflict_markers(merger));
		}
	    }
	}
	set_rev_span("ancestor", m.ancestor);
	mergeAncestor = m.ancestor;
	mark_dirty(true, "Merge in progress (merging "+revId+" into "+fs.directParent+")");
	sync_view_of_fs();
    }
}

function build_conflict_markers(merger) {
    var lines = [];
    for (var i = 0; i < merger.length; i++) {
	var item = merger[i];
	if (item.ok) {
	    lines = lines.concat(item.ok);
	} else {
	    lines = lines.concat(["<<<<<<<<<"], item.conflict.a,
				 ["========="], item.conflict.b,
				 [">>>>>>>>>"]);
	}
    }
    return lines;
}

function selectRev(revId) {
    set_rev_span("nonselected");
    if (mergeAncestor) {
	set_rev_span("nonselected", mergeAncestor);
	mergeAncestor = null;
    }
    fs = repo.update(revId);
    mark_dirty(false);
    sync_view_of_fs();
}

function revert() {
    selectRev(fs.directParent);
}

function commit() {
    if (dirty) {
	var newRevId = repo.commit(fs);
	redisplay_repository_history();
	selectRev(newRevId);
    }
}

function newfile() {
    var inode = fs.createFile();
    fs.setProp(inode, "name", inode);
    fs.setProp(inode, "text", []);
    mark_dirty(true);
    sync_view_of_fs();
}

function dvcsdemo_main() {
    selectPresetNamed("clear");
}

function dumpRepo() {
    log(JSON.stringify(repo, null, 2));
}

function toggleLogVisible() {
    var e = document.getElementById("log");
    e.className = (e.className == "invisible") ? "" : "invisible";
}

var presets = {};
presets.clear = function () {
    repo = new Dvcs.Repository();
    fs = repo.update(null);
};

presets.preset1 = function () {
    presets.clear();
    var fileA = fs.createFile();
    fs.setProp(fileA, "name", "File A");
    fs.setProp(fileA, "text", "A B C D E".split(/ /));
    var rA = repo.commit(fs);
    fs.setBranch("BBB");
    fs.setProp(fileA, "text", "G G G A B C D E".split(/ /));
    var rB1 = repo.commit(fs);
    fs.setProp(fileA, "text", "A B C D E G G G A B C D E".split(/ /));
    var rB2 = repo.commit(fs);
    fs = repo.update(rA);
    fs.setProp(fileA, "name", "File A, renamed");
    fs.setProp(fileA, "text", "A B X D E".split(/ /));
    var rC = repo.commit(fs);
};

presets.preset2 = function () {
    presets.clear();
    var fileA = fs.createFile();
    fs.setProp(fileA, "name", "File A");
    fs.setProp(fileA, "text", "A B C D E".split(/ /));
    var rA = repo.commit(fs);
    fs.setBranch("BBB");
    fs.setProp(fileA, "text", "G G G A B C D E".split(/ /));
    var rB1 = repo.commit(fs);
    fs.setProp(fileA, "text", "A B C D E G G G A B C D E".split(/ /));
    var rB2 = repo.commit(fs);
    fs = repo.update(rA);
    fs.setProp(fileA, "name", "File A, renamed");
    fs.setProp(fileA, "text", "A B X D E".split(/ /));
    var rC = repo.commit(fs);

    fs = repo.update(rB2);
    fs.setProp(fileA, "text", "A B Z D E G G G A B C D E".split(/ /));
    var rB3 = repo.commit(fs);
};

presets.preset3 = function () {
    presets.clear();
    var fileA = fs.createFile();
    fs.setProp(fileA, "name", "File A");
    fs.setProp(fileA, "text", "A B C D E".split(/ /));
    var rA = repo.commit(fs);
    fs.setBranch("BBB");
    fs.setProp(fileA, "text", "G G G A B C D E".split(/ /));
    var rB1 = repo.commit(fs);
    fs.setProp(fileA, "text", "A B C D E G G G A B C D E".split(/ /));
    var rB2 = repo.commit(fs);
    fs = repo.update(rA);
    fs.setProp(fileA, "name", "File A, renamed");
    fs.setProp(fileA, "text", "A B X D E".split(/ /));
    var rC = repo.commit(fs);

    var mergeResult = repo.merge(rC, rB2);
    var rMerger = repo.commit(mergeResult.files);
    fs = repo.update(rMerger);
    fs = repo.update("BBB");
    fs.deleteFile(fileA);
    var rB3 = repo.commit(fs);
    var rMerger2 = repo.commit(repo.merge(rB3, rMerger).files);
    fs = repo.update(rMerger2);
};

presets.ambiguousLCA = function () {
    var repoExt = {
	"bodies": {
	    "46c316ca-5c4f-4474-a7ea-cfcea3b2ca0f": {
		"name": "The File",
		"text": ["a"]
	    },
	    "8e184218-c4d8-426b-b190-916e47249ec6": {
		"name": "The File",
		"text": ["b"]
	    },
	    "2f1dd5b6-271b-4adc-a3ea-cbd11588e95d": {
		"name": "The File",
		"text": ["c"]
	    },
	    "6a28a74c-727b-4ea0-bda0-aa88c53c730c": {
		"name": "The File",
		"text": ["g"]
	    },
	    "50a9df9e-e1c9-4138-a7d4-042d6b0e1e1d": {
		"name": "The File",
		"text": ["d"]
	    },
	    "98a26661-3cc4-42bc-9cac-1d01dd64b7f3": {
		"name": "The File",
		"text": ["h"]
	    },
	    "c8a089a0-abf3-4940-935f-6a039fdb32ed": {
		"name": "The File",
		"text": ["i"]
	    },
	    "3e805399-d30b-4cd8-8e29-52d98650de77": {
		"name": "The File",
		"text": ["e"]
	    }
	},
	"revisions": {
	    "814f45c3-916d-4a51-8f91-f8c8ed24c598": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "46c316ca-5c4f-4474-a7ea-cfcea3b2ca0f"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662063125,
		"directParent": null,
		"additionalParent": null
	    },
	    "ff9b6da5-b759-4c8c-8c5d-8497504f4529": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "8e184218-c4d8-426b-b190-916e47249ec6"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662070767,
		"directParent": "814f45c3-916d-4a51-8f91-f8c8ed24c598",
		"additionalParent": null
	    },
	    "d092f83a-5e91-42aa-bd6e-d86e8aaeeffd": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "2f1dd5b6-271b-4adc-a3ea-cbd11588e95d"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662073640,
		"directParent": "ff9b6da5-b759-4c8c-8c5d-8497504f4529",
		"additionalParent": null
	    },
	    "737f2636-9db0-4369-8521-a9b9d64d8fc6": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "6a28a74c-727b-4ea0-bda0-aa88c53c730c"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662085012,
		"directParent": "814f45c3-916d-4a51-8f91-f8c8ed24c598",
		"additionalParent": null
	    },
	    "f5a7d71d-41d0-4d69-8434-c0fb68ba1bde": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "50a9df9e-e1c9-4138-a7d4-042d6b0e1e1d"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662096545,
		"directParent": "737f2636-9db0-4369-8521-a9b9d64d8fc6",
		"additionalParent": "d092f83a-5e91-42aa-bd6e-d86e8aaeeffd"
	    },
	    "f06bc572-c234-4a71-980f-4a9d58bea46c": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "98a26661-3cc4-42bc-9cac-1d01dd64b7f3"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662104627,
		"directParent": "737f2636-9db0-4369-8521-a9b9d64d8fc6",
		"additionalParent": null
	    },
	    "33b9c253-9378-4115-9cad-dfa0c81efc57": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "c8a089a0-abf3-4940-935f-6a039fdb32ed"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662119727,
		"directParent": "f06bc572-c234-4a71-980f-4a9d58bea46c",
		"additionalParent": "d092f83a-5e91-42aa-bd6e-d86e8aaeeffd"
	    },
	    "554a6354-f6d5-4033-9fc5-b5b7a4cf5991": {
		"alive": {
		    "d077723c-5169-45dc-a465-0668870979d6": "3e805399-d30b-4cd8-8e29-52d98650de77"
		},
		"dead": {},
		"changed": ["d077723c-5169-45dc-a465-0668870979d6"],
		"branch": null,
		"timestamp": 1212662141759,
		"directParent": "f5a7d71d-41d0-4d69-8434-c0fb68ba1bde",
		"additionalParent": "f06bc572-c234-4a71-980f-4a9d58bea46c"
	    }
	},
	"children": {
	    "814f45c3-916d-4a51-8f91-f8c8ed24c598": [
		"ff9b6da5-b759-4c8c-8c5d-8497504f4529",
		"737f2636-9db0-4369-8521-a9b9d64d8fc6"
	    ],
	    "ff9b6da5-b759-4c8c-8c5d-8497504f4529": [
		"d092f83a-5e91-42aa-bd6e-d86e8aaeeffd"
	    ],
	    "737f2636-9db0-4369-8521-a9b9d64d8fc6": [
		"f5a7d71d-41d0-4d69-8434-c0fb68ba1bde",
		"f06bc572-c234-4a71-980f-4a9d58bea46c"
	    ],
	    "d092f83a-5e91-42aa-bd6e-d86e8aaeeffd": [
		"f5a7d71d-41d0-4d69-8434-c0fb68ba1bde",
		"33b9c253-9378-4115-9cad-dfa0c81efc57"
	    ],
	    "f06bc572-c234-4a71-980f-4a9d58bea46c": [
		"33b9c253-9378-4115-9cad-dfa0c81efc57",
		"554a6354-f6d5-4033-9fc5-b5b7a4cf5991"
	    ],
	    "f5a7d71d-41d0-4d69-8434-c0fb68ba1bde": [
		"554a6354-f6d5-4033-9fc5-b5b7a4cf5991"
	    ]
	}
    };

    presets.clear();
    repo.importRevisions(repoExt);
    fs = repo.update(repo.branchTip(null)); // null -> default branch
};

function selectPreset() {
    selectPresetNamed(document.getElementById("presetSelect").value);
}

function selectPresetNamed(name) {
    presets[name]();
    redisplay_repository_history();
    sync_view_of_fs();
}

function log() {
    for (var i = 0; i < arguments.length; i++) {
	var arg = arguments[i];
	if (typeof(arg) == 'string') {
	    document.getElementById("log").appendChild(document.createTextNode(arg + "\n"));
	} else {
	    document.getElementById("log").appendChild(document .createTextNode(uneval(arg) + "\n"));
	}
    }
}
