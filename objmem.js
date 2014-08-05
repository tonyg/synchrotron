var repo = new Mc.Repository();
if (__$_exported_repo.repoId) {
    repo.repoId = __$_exported_repo.repoId;
    repo.blobs = __$_exported_repo.blobs;
    repo.tags = __$_exported_repo.tags;
    repo.remotes = __$_exported_repo.remotes;
    function cleanBlobs() {
	for (var blobId in repo.blobs) {
	    delete repo.blobs[blobId]._boot_full;
	}
    }
    cleanBlobs();
}
var checkout = new Mc.Checkout(repo);
if (__$_exported_reflog) {
    checkout.reflog = __$_exported_reflog;
}

Mc.TypeDirectory["moduleDefinition"] =
    new Mc.SimpleObjectType({ name: "",
			      exports: [],
			      imports: [],
			      bodyText: ""
			    },
			    { bodyText: Mc.ObjectTypes.paragraphString });

Mc.TypeDirectory["cssStyleSheet"] =
    new Mc.SimpleObjectType({ name: "",
			      bodyText: "",
			      enabled: false
			    },
			    { bodyText: Mc.ObjectTypes.paragraphString });

if (__$_new_instances.length) {
    for (var i = 0; i < __$_new_instances.length; i++) {
	var instance = __$_new_instances[i];
	var objectType = instance.objectType;
	delete instance.objectType;
	checkout.writeFile(instance.name, instance, objectType);
    }
    checkout.commit({date: +(new Date()),
		     summary: "Bootstrapping new instances"});
}

function getDirName() {
    var dirName = TiddlyFox.documentLocationPath().split('/');
    dirName.pop();
    return dirName.join('/');
}

function loadChangesFrom(path, repoName) {
    return loadChangesFromString(TiddlyFox.loadFile(path), repoName);
}

function loadChangesFromString(docText, repoName) {
    var repoText = splitAtMarker(docText, 'exported_repo')[1];
    if (!repoText) throw {message: "Could not find exported_repo text in loaded file"};
    repoText = repoText.trim();
    repoText =
	repoText.replace(/<\/scr"\+"ipt>/gi,
			 function (match) { return match.substring(0, 5) + match.substring(8); });
    while (repoText[0] == "(") {
	repoText = repoText.substring(1);
    }
    while (repoText[repoText.length - 1] == ")") {
	repoText = repoText.substring(0, repoText.length - 1);
    }
    window.ttttt = repoText;
    var exportedData = JSON.parse(repoText);
    var shouldRemoveOldTags = false;
    if (exportedData.repoId === repo.repoId) {
	// We're importing from a repository that thinks it is the
	// same as us. Since this is usually not what we want, we
	// pretend it's some completely new repository.
	//
	// This is gross. TODO: what's better?
	var oldId = exportedData.repoId;
	var newId = Mc.Util.random_uuid();
	var newTags = {};
	for (var tag in exportedData.tags) {
	    if (tag.substring(0, oldId.length) == oldId) {
		newTags[newId + tag.substring(oldId.length)] = exportedData.tags[tag];
	    }
	}
	exportedData.repoId = newId;
	exportedData.tags = newTags;
	shouldRemoveOldTags = true;
    }
    repo.addRemote(repoName, exportedData.repoId, shouldRemoveOldTags);
    repo.importRevisions(exportedData);
    // TODO: return stats summarising the effect of the import?
}

function saveImage(callback) {
    return saveImageAs(TiddlyFox.documentLocationPath(), callback);
}

function splitAtMarker(what, marker) {
    var fullMarker = '// __$__' + marker + '__$__';
    var pos = what.indexOf(fullMarker + "START\n");
    var prefix = what.substring(0, pos);
    what = what.substring(pos + fullMarker.length + 6);
    pos = what.indexOf(fullMarker + "STOP\n");
    var content = what.substring(0, pos);
    var suffix = what.substring(pos + fullMarker.length + 5);
    return [prefix + fullMarker + "START", content, fullMarker + "STOP\n" + suffix];
}

function forceFull(repo, blobId) {
    var entry = repo.blobs[Mc.Util.blobIdKey(blobId)];
    if (entry && entry.diff) {
	var t = Mc.lookupType(Mc.Util.blobIdType(blobId));
	var patcher = Mc.typeMethod(t, "patch");
	entry._boot_full =
	    JSON.stringify(patcher(Mc.validInstance(t, repo.lookupUnsafe(entry.baseId)),
				   JSON.parse(entry.diff)));
    }
};

function saveImageAs(path, callback) {
    if (path.indexOf('/') == -1) {
	path = getDirName() + '/' + path;
    }

    var originalContent = TiddlyFox.loadFile(TiddlyFox.documentLocationPath());
    if (!originalContent) {
	return false;
    }

    var content = originalContent;
    var accumulator = [];
    function spliceMarker(marker, value, noStringify) {
	var parts = splitAtMarker(content, marker);
	accumulator.push(parts[0]);
	var j = noStringify ? value : '('+JSON.stringify(value, null, 2)+')';
	j = j.replace(/<\/script>/gi,
		      function (match) { return match.substring(0,5)+'"+"'+match.substring(5); });
	accumulator.push(j);
	content = parts[2];
    }

    var exported = repo.exportRevisions();
    checkout.forEachFile(function (name, inodeId) {
			     var blobId = checkout.resolveInode(inodeId).blobId;
			     if (blobId.indexOf('moduleDefinition:') == 0) {
				 forceFull(repo, blobId);
			     }
			 });
    forceFull(repo, checkout.directParentIndexId);
    forceFull(repo, checkout.directParent);

    spliceMarker('exported_repo', repo.exportRevisions());
    spliceMarker('exported_reflog', checkout.reflog);
    spliceMarker('new_instances', []);
    spliceMarker('boot_script',
		 checkout.readFile("net.lshift.synchrotron.boot_old").instance.bodyText,
		 true);
    accumulator.push(content);
    content = accumulator.join('\n');

    if (!TiddlyFox.saveFile(path, content, callback)) {
	return false;
    }

    return true;
}
