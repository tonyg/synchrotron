var repo = new Dvcs.Repository();
var fs = repo.update(null);
var dirty = false;

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

function set_rev_span(className) {
    var revSpan = document.getElementById(fs.directParent);
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
	if (comment != undefined || stateSpan.innerHTML == "")  {
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
	}
	inodeDiv.appendChild(filename);
	var deleteButton = document.createElement("button");
	deleteButton.innerHTML = "Delete";
	deleteButton.onclick = function () {
	    fs.deleteFile(inode);
	    mark_dirty(true);
	    inodeDiv.className = "deletedFile";
	}
	inodeDiv.appendChild(deleteButton);
	inodeDiv.appendChild(document.createElement("br"));
	var contents = document.createElement("textarea");
	contents.cols = 80;
	contents.rows = 10;
	contents.value = fs.getProp(inode, "text").join("\n");
	contents.onkeyup = function () {
	    fs.setProp(inode, "text", contents.value.split(/\n/));
	    mark_dirty(true);
	}
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
/*
    fs = repo.update(rB2);
    fs.setProp(fileA, "text", "A B Z D E G G G A B C D E".split(/ /));
    var rB3 = repo.commit(fs);

// -------
    var mergeResult = repo.merge(rC, rB2);
    var rMerger = repo.commit(mergeResult.files);
    fs = repo.update(rMerger);
    fs = repo.update("BBB");
    fs.deleteFile(fileA);
    var rB3 = repo.commit(fs);
    var rMerger2 = repo.commit(repo.merge(rB3, rMerger).files);
    fs = repo.update(rMerger2);
*/
    redisplay_repository_history();
    sync_view_of_fs();
}

function dumpRepo() {
    log(JSON.stringify(repo, null, 2));
}

function toggleLogVisible() {
    var e = document.getElementById("log");
    e.className = (e.className == "invisible") ? "" : "invisible";
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
