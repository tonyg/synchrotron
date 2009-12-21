var repo = new Mc.Repository();
if (__$_exported_repo.repoId) {
    repo.repoId = __$_exported_repo.repoId;
    repo.blobs = __$_exported_repo.blobs;
    repo.tags = __$_exported_repo.tags;
    repo.remotes = __$_exported_repo.remotes;
}

var moduleDefinitionTypeTable = Mc.typeTableFun(
    {
	"bodyText": Mc.ObjectTypes.paragraphString
    }
);

Mc.TypeDirectory["moduleDefinition"] = {
    emptyInstance: function () {
	return {name: "",
		exports: [],
		imports: [],
		bodyText: ""};
    },
    pickle: function (instance) {
	return instance.toJSON();
    },
    unpickle: function (repo, blobId, instanceJson) {
	return ModuleDefinition.fromJsonObject(instanceJson);
    },
    diff: function (v0, v1) {
	return Mc.ObjectTypes.simpleObject.diff(v0, v1, moduleDefinitionTypeTable);
    },
    patch: function (v0, p) {
	return Mc.ObjectTypes.simpleObject.patch(v0, p, moduleDefinitionTypeTable);
    },
    merge: function (v1, v0, v2) {
	return Mc.ObjectTypes.simpleObject.merge(v1, v0, v2, moduleDefinitionTypeTable);
    }
};

if (__$_new_instances.length) {
    for (var i = 0; i < __$_new_instances.length; i++) {
	var instance = __$_new_instances[i];
	var objectType = instance.objectType;
	delete instance.objectType;
	var t = Mc.lookupType(objectType);
	repo.store(Mc.typeMethod(t, "unpickle")(repo, null, instance), objectType, null, null);
    }
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

function saveImage() {
    saveImageAs(getLocalPath());
}

function splitAtMarker(what, marker) {
    var pos = what.indexOf(marker + "START\n");
    var prefix = what.substring(0, pos);
    what = what.substring(pos + marker.length + 6);
    pos = what.indexOf(marker + "STOP\n");
    var suffix = what.substring(pos + marker.length + 5);
    return [prefix + marker + "START", "// " + marker + "STOP\n" + suffix];
}

function saveImageAs(path) {
    if (path.indexOf('/') == -1) {
	path = getDirName() + '/' + path;
    }

    var originalContent = FileSystem.loadFile(getLocalPath());

    var content = originalContent;
    var accumulator = [];
    function spliceMarker(marker, value) {
	marker = '__$__' + marker + '__$__';
	var parts = splitAtMarker(content, marker);
	accumulator.push(parts[0]);
	var j = JSON.stringify(value, null, 2);
	j = j.replace('</script>', '</scr"+"ipt>', 'g'); // TODO: case-insensitive
	accumulator.push('('+j+')');
	content = parts[1];
    }

    spliceMarker('exported_repo', repo.exportRevisions());
    spliceMarker('new_instances', []);
    accumulator.push(content);
    content = accumulator.join('\n');
    FileSystem.saveFile(path, content);
}
