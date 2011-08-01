$(document).ready(main);

var viewModel = {
    checkoutDirty: ko.observable(false),
    fileList: ko.observableArray(),
    fileListSet: {},
    selectedFilename: ko.observable(null),
    editorChanged: ko.observable(false),
    setSelectedFilename: function (newFilename) {
	if (viewModel.editorChanged()) {
	    if (!confirm("Lose changes currently in editor?")) return;
	}
	viewModel.selectedFilename(newFilename);
    }
};

viewModel.commitRepository = function () {
    ObjectMemory.checkout.commit();
    ObjectMemory.saveImage();
};

viewModel.selectedFile = ko.dependentObservable(function () {
    var filename = viewModel.selectedFilename();
    if (!filename) return null;
    return ObjectMemory.checkout.readFile(filename);
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
    ObjectMemory.saveImage();

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

    var initialFileNames = [];
    c.forEachFile(function (name) {
	viewModel.fileListSet[name] = true;
	initialFileNames.push(name);
    });
    initialFileNames.sort();
    viewModel.fileList(initialFileNames);

    c.changeListeners.dirty.push(function (event) {
	viewModel.checkoutDirty(event.dirty);
    });

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
};
