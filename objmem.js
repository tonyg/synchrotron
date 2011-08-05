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
    checkout.commit({summary: "Bootstrapping new instances"});
}

function getLocalPath(originalUri)
{
    // This function is based on getLocalPath from Saving.js, extracted
    // from TiddlyWiki, http://www.tiddlywiki.com/.
    //
    // TiddlyWiki created by Jeremy Ruston, (jeremy [at] osmosoft [dot] com)
    //
    // Copyright (c) UnaMesa Association 2004-2009
    //
    // Redistribution and use in source and binary forms, with or without modification,
    // are permitted provided that the following conditions are met:
    //
    // Redistributions of source code must retain the above copyright notice, this
    // list of conditions and the following disclaimer.
    //
    // Redistributions in binary form must reproduce the above copyright notice, this
    // list of conditions and the following disclaimer in the documentation and/or other
    // materials provided with the distribution.
    //
    // Neither the name of the UnaMesa Association nor the names of its contributors may be
    // used to endorse or promote products derived from this software without specific
    // prior written permission.
    //
    // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND ANY
    // EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
    // OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
    // SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
    // INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
    // TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
    // BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
    // CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
    // ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
    // DAMAGE.

    if (!originalUri) {
	originalUri = document.location.toString();
    }

    var originalPath = FileSystem.convertUriToUTF8(originalUri, "UTF-8");

    // Remove any location or query part of the URL
    var argPos = originalPath.indexOf("?");
    if(argPos != -1) originalPath = originalPath.substr(0,argPos);

    var hashPos = originalPath.indexOf("#");
    if(hashPos != -1) originalPath = originalPath.substr(0,hashPos);

    // Convert file://localhost/ to file:///
    if(originalPath.indexOf("file://localhost/") == 0)
	originalPath = "file://" + originalPath.substr(16);

    // Convert to a native file format
    //# "file:///x:/path/path/path..." - pc local file --> "x:\path\path\path..."
    //# "file://///server/share/path/path/path..." - FireFox pc network file --> "\\server\share\path\path\path..."
    //# "file:///path/path/path..." - mac/unix local file --> "/path/path/path..."
    //# "file://server/share/path/path/path..." - pc network file --> "\\server\share\path\path\path..."
    var localPath;
    if(originalPath.charAt(9) == ":") // pc local file
	localPath = unescape(originalPath.substr(8)).replace(new RegExp("/","g"),"\\");
    else if(originalPath.indexOf("file://///") == 0) // FireFox pc network file
        localPath = "\\\\" + unescape(originalPath.substr(10)).replace(new RegExp("/","g"),"\\");
    else if(originalPath.indexOf("file:///") == 0) // mac/unix local file
        localPath = unescape(originalPath.substr(7));
    else if(originalPath.indexOf("file:/") == 0) // mac/unix local file
        localPath = unescape(originalPath.substr(5));
    else // pc network file
	localPath = "\\\\" + unescape(originalPath.substr(7)).replace(new RegExp("/","g"),"\\");
    return localPath;
}

function getDirName() {
    var dirName = getLocalPath().split('/');
    dirName.pop();
    return dirName.join('/');
}

function loadChangesFrom(path, repoName) {
    var docText = FileSystem.loadFile(path);
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
    repo.importRevisions(exportedData);
    repo.remotes[repoName] = {repoId: exportedData.repoId};
    // TODO: return stats summarising the effect of the import?
}

function saveImage() {
    return saveImageAs(getLocalPath());
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

function saveImageAs(path) {
    if (path.indexOf('/') == -1) {
	path = getDirName() + '/' + path;
    }

    var originalContent = FileSystem.loadFile(getLocalPath());
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

    if (!FileSystem.saveFile(path, content)) {
	return false;
    }

    return true;
}
