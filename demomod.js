$(document).ready(main);

function confirmNoOutstandingEdits() {
    return !viewModel.editorChanged() || confirm("Lose changes currently in editor?");
}

function confirmNoUncommitedWrites() {
    return !viewModel.checkoutDirty() || confirm("Lose uncommited changes currently in checkout?");
}

var repl = null; // initialized in main

var viewModel = {
    checkoutDirty: ko.observable(false),
    fileList: ko.observableArray(),
    fileListSet: null,
    selectedFilename: ko.observable(null),
    editorChanged: ko.observable(false),
    setSelectedFilename: function (newFilename) {
	if (!confirmNoOutstandingEdits()) return;
	viewModel.selectedFilename(newFilename);
    },
    repoRendering: ko.observable([]),
    selectedRevision: ko.observable(null),
    otherParent: ko.observable(null),
    conflicts: ko.observable(null),
    setSelectedRevision: function (newRevision) {
	if (!confirmNoOutstandingEdits()) return;
	if (!confirmNoUncommitedWrites()) return;
	ObjectMemory.checkout.forceCheckout(newRevision);
    }
};

viewModel.commitRepository = function () {
    ObjectMemory.checkout.commit();
    ObjectMemory.saveImage();
};

viewModel.selectedFile = ko.dependentObservable(function () {
    var filename = viewModel.selectedFilename();
    if (!filename) return null;
    viewModel.selectedRevision(); // Dummy read of an observable to make us refresh when it changes
    try {
	return ObjectMemory.checkout.readFile(filename);
    } catch (e) {
	return null;
    }
});

viewModel.activeEditor = ko.dependentObservable(function () {
    var f = viewModel.selectedFile();
    if (!f) return null;

    var instance = f.instance;
    viewModel.editorChanged(false);
    return CodeMirror.CodeMirror($('#fileEditorDiv').empty()[0], {
	value: instance.bodyText,
	mode: instance.mimeType,
	lineNumbers: true,
	matchBrackets: true,
	onChange: function () {
	    viewModel.editorChanged(true);
	}
    });
});

viewModel.revertEdits = function () {
    var e = viewModel.activeEditor();
    if (e) {
	e.setValue(viewModel.selectedFile().instance.bodyText);
	viewModel.editorChanged(false);
    }
};

viewModel.saveEdits = function () {
    var f = viewModel.selectedFile();
    f.instance.bodyText = viewModel.activeEditor().getValue();
    ObjectMemory.checkout.writeFile(viewModel.selectedFilename(), f.instance, f.objectType);
    viewModel.editorChanged(false);
};

CodeMirror.CodeMirror.defineMIME("application/javascript", "javascript");

function main() {
    var filename = "testIndex-"+Mc.Util.random_uuid()+".html";
    //alert(filename);
    $("body").append($((new Showdown.converter()).makeHtml("Hello, *world*!")));

    var r = ObjectMemory.repo;
    var c = ObjectMemory.checkout;

    var f;
    if (c.fileExists("foo")) {
	f = c.readFile("foo").instance;
    } else {
	f = {name: "foo", exports: [], imports: [], bodyText: "alert('hi');"};
    }
    f.bodyText = f.bodyText + "\nalert('there');";
    c.writeFile("foo", f, "moduleDefinition");
    c.commit({summary: "updated foo"});

    Boot.module_namespace.definitionDirectory.registerJsonModuleDefinition(f);
    Boot.module_namespace.instantiateModule('foo');

    //ObjectMemory.saveImageAs(filename);

    $("body").append($((new Showdown.converter()).makeHtml("Done!")));

    setTimeout(function () {
	c.writeFile("bar", {bodyText: "hello"}, "textFile");
	setTimeout(function () {
	    c.commit({summary: "Add bar"});
	}, 500);
	setTimeout(function () {
	    c.deleteFile("bar");
	    setTimeout(function () {
		c.commit();
	    }, 500);
	}, 1000);
    }, 1000);

    c.changeListeners.dirty.push(function (event) {
	viewModel.checkoutDirty(event.dirty);
    });

    function resetFileList() {
	var initialFileNames = [];
	viewModel.fileListSet = {};
	c.forEachFile(function (name) {
	    viewModel.fileListSet[name] = true;
	    initialFileNames.push(name);
	});
	initialFileNames.sort();
	viewModel.fileList(initialFileNames);
    }

    function onCommitUpdateRendering(event) {
	viewModel.selectedRevision(event.commit);
	viewModel.otherParent(null);
	viewModel.conflicts(null);
	resetFileList();

	var wrappedRepo = RenderRepo.wrapRepo(ObjectMemory.repo,
					      ObjectMemory.checkout);
	var rawRendering = RenderRepo.renderRepository(wrappedRepo);

	var cookedRendering = [];
	for (var i = 0; i < rawRendering.length; i++) {
	    var rawEntry = rawRendering[i];
	    var revId = rawEntry.revId;
	    var commit = ObjectMemory.repo.lookup(revId);
	    var metadata = commit.metadata || {};
	    var summary = metadata.summary || "(no summary)";
	    var branchNames = wrappedRepo.lookupRev(revId).branches;
	    var cookedEntry = {
		revId: revId,
		commit: commit,
		canMerge: ObjectMemory.checkout.canMerge(revId)
		    ? {mergeClicked: (function (revId) {
			// Javascript's hideous mutated variables bites again
			return function (event) {
			    console.log(ObjectMemory.checkout.merge(revId));
			    viewModel.otherParent(revId);
			    viewModel.conflicts(JSON.stringify(ObjectMemory.checkout.conflicts,
							       null, 2));
			    event.stopPropagation();
			};
		      })(revId)}
		    : null,
		summary: summary,
		branches: [],
		pictures: []
	    };
	    for (var j = 0; j < branchNames.length; j++) {
		cookedEntry.branches.push({branch: branchNames[j]});
	    }
	    for (var j = 0; j < rawEntry.pictures.length; j++) {
		var pictureName = rawEntry.pictures[j];
		var pictureUrl = RenderRepo.images[pictureName];
		cookedEntry.pictures.push({url: pictureUrl});
	    }
	    cookedRendering.push(cookedEntry);
	}
	viewModel.repoRendering(cookedRendering);
    }
    c.changeListeners.commit.push(onCommitUpdateRendering);
    onCommitUpdateRendering({checkout: c, newCommit: false, commit: c.directParent});

    c.changeListeners.name.push(function (event) {
	switch (event.kind) {
	case 'write':
	    if (!(event.name in viewModel.fileListSet)) {
		viewModel.fileListSet[event.name] = true;
		var lst = viewModel.fileList();
		lst.push(event.name);
		lst.sort();
		viewModel.fileList.valueHasMutated();
	    }
	    break;
	case 'delete':
	    if (event.name in viewModel.fileListSet) {
		delete viewModel.fileListSet[event.name];
		var lst = viewModel.fileList();
		lst.splice(lst.indexOf(event.name), 1);
		viewModel.fileList.valueHasMutated();
	    }
	    break;
	default:
	    break;
	}
    });

    Panels.headerDiv.append(Panels.boundSkin("header", viewModel));
    Panels.leftDiv.append(Panels.boundSkin("test", viewModel));
    Panels.panelsDiv.append(Panels.boundSkin("fileEditor", viewModel));
    Panels.footerDiv.append(Panels.boundSkin("footer", viewModel));

    repl = new Repl.Repl("__repl__div__");
    repl.addBinding("ns", Boot.module_namespace);
};
