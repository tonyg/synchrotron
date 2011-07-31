// Copyright (c) 2008-2009 Tony Garnock-Jones <tonyg@lshift.net>
// Copyright (c) 2008-2009 LShift Ltd. <query@lshift.net>
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

var Mc = {
    _debugMode: false
};

Mc.Util = (function ()
{
    function random_hex_string(n) {
        var digits = "0123456789abcdef";
        var result = "";
        for (var i = 0; i < n; i++) {
            result = result + digits[Math.floor(Math.random() * 16)];
        }
        return result;
    }

    function random_uuid() {
        if (Mc._debugMode) {
            return random_hex_string(8);
        } else {
            return [random_hex_string(8),
                    random_hex_string(4),
                    "4" + random_hex_string(3),
                    ((Math.floor(Math.random() * 256) & ~64) | 128).toString(16) +
                    random_hex_string(2),
                    random_hex_string(12)].join("-");
        }
    }

    function dict_union(s1, s2) {
        var result = {};
        var k;
        for (k in s2) { result[k] = s2[k]; }
        for (k in s1) { result[k] = s1[k]; }
        return result;
    }

    function dict_difference(s1, s2) {
        var result = {};
        var k;
        for (k in s1) { result[k] = s1[k]; }
        for (k in s2) { delete result[k]; }
        return result;
    }

    function dict_to_set(d) {
	var result = {};
        for (var k in d) { result[k] = 1; }
        return result;
    }

    function dict_to_set_list(d) {
	var result = [];
        for (var k in d) { result.push(k); }
        return result;
    }

    function dict_isempty(d) {
	for (var k in d) { return false; }
	return true;
    }

    function deepCopy(obj) {
        // Courtesy of
        // http://keithdevens.com/weblog/archive/2007/Jun/07/javascript.clone
        //
        // Does not handle recursive structures.

        if (obj === null || typeof(obj) != 'object') {
            return obj;
        }

        var temp = obj.constructor();
        for (var key in obj) {
            temp[key] = deepCopy(obj[key]);
        }
        return temp;
    }

    function scalarsEqual(v0, v1) {
	if (v0 === v1) return true;

	if ((typeof v0 != 'string') &&
	    (typeof v1 != 'string') &&
	    (typeof v0.length === 'number' && !(v0.propertyIsEnumerable('length'))) &&
	    (typeof v1.length === 'number' && !(v1.propertyIsEnumerable('length'))) &&
	    (v0.length == v1.length))
	{
	    for (var i = 0; i < v0.length; i++) {
		if (!scalarsEqual(v0[i], v1[i])) {
		    return false;
		}
	    }
	    return true;
	}

	return false;
    }

    function subclassResponsibility(methodName) {
	throw {message: "Subclass responsibility",
	       methodName: methodName};
    }

    function blobIdType(blobId) {
	if (!blobId) {
	    return blobId;
	}
	var colonPos = blobId.indexOf(":");
	return (colonPos != -1) && blobId.substring(0, colonPos);
    }

    function blobIdKey(blobId) {
	if (!blobId) {
	    return blobId;
	}
	var colonPos = blobId.indexOf(":");
	return (colonPos != -1) && blobId.substring(colonPos + 1);
    }

    var hasSetTimeout;
    try {
	hasSetTimeout = window.setTimeout;
	hasSetTimeout = !!hasSetTimeout;
    } catch (e) {
	hasSetTimeout = false;
    }
    var broadcast;
    if (hasSetTimeout) {
	broadcast = function (receivers, event) {
	    /* In a browser, or somewhere with an event loop. */
	    for (var i = 0; i < receivers.length; i++) {
		var receiver = receivers[i];
		/* Javascript binding dance to work around mutation of outer receiver binding. */
		setTimeout((function (receiver) {
		    return function () {
			receiver(event);
		    };
		})(receiver), 0);
	    }
	};
    } else {
	broadcast = function (receivers, event) {
	    /* Somewhere else. Hope that our event listeners are
	     * carefully enough written that we avoid deadlocks. */
	    for (var i = 0; i < receivers.length; i++) {
		receivers[i](event);
	    }
	};
    }

    return {
	random_uuid: random_uuid,
	dict_union: dict_union,
	dict_difference: dict_difference,
	dict_to_set: dict_to_set,
	dict_to_set_list: dict_to_set_list,
	dict_isempty: dict_isempty,
	deepCopy: deepCopy,
	scalarsEqual: scalarsEqual,
	subclassResponsibility: subclassResponsibility,
	blobIdType: blobIdType,
	blobIdKey: blobIdKey,
	broadcast: broadcast
    };
})();

// A repository is a collection of hash-keyed blobs. When a blob is
// retrieved from the repository, it is revivified, and when it is
// inserted, it is pickled.
//
// Objects stored in a repository need to have a class, called an
// "objectType" below. Object types know how to:
//
//  - emptyInstance :: () -> instance
//  - pickle :: instance -> jsonobject
//  - unpickle :: repository * blobid * jsonobject -> instance
//  - diff :: v0:instance * v1:instance -> diff
//  - patch :: instance * diff -> instance
//  - merge :: v1:instance * v0:instance * v2:instance -> mergeresult
//
// In the Mc.ObjectTypes table below, if a (pseudo-)method is absent, a
// default implementation will be used.
//
// Diffs:
//
//  - if no changes were made, null is returned (so null means empty diff)
//
// Merge results:
//
//  - a totally clean merge results in the data structure itself in "ok":
//    { objectType: "scalar"|"text"|"object", ok: Scalar-or-list-or-dict }
//
//  - a merge with conflicts results in:
//    { objectType: "scalar", conflict: {a: Scalar, o: Scalar, b: Scalar} }
//    { objectType: "text", result: [{ok:}, {conflict:}, ...] }
//    { objectType: "object", partial: dict, conflicts: {key: MergeResult} }
//    etc.
//
// (Note that dicts here are the only things that can have nested merge
// results.)
//
// An index is a record that also maps "filename"s to inodeIds, and
// inodeIds to blobIds. A commit points to a value, some metadata, and
// a (possibly-empty) list of parent commits.
//
// A checkout is a non-version-controlled object that holds a commit
// and an index and which also provides read/write/merge/commit
// services and a cache of unpickled objects.

// TODO: Add a "children" operation for tracing GC of the repository.

Mc.SimpleObjectType = function (emptyInstanceValue, typeTable) {
    this.emptyInstanceValue = emptyInstanceValue;
    this.typeTable = typeTable;
};

Mc.SimpleObjectType.prototype.emptyInstance = function () {
    return this.emptyInstanceValue;
};

Mc.SimpleObjectType.prototype.typeTableFun = function (key) {
    return this.typeTable[key];
};

Mc.SimpleObjectType.prototype.diff = function (v0, v1) {
    var removed = Mc.Util.dict_difference(v0, v1);
    var added = Mc.Util.dict_difference(v1, v0);
    var changed = {};
    var common = Mc.Util.dict_difference(v1, added);
    for (var prop in common) {
	var propType = this.typeTableFun(prop) || Mc.ObjectTypes.simpleScalar;
	var p = propType.diff(v0[prop], v1[prop]);
	if (p !== null) {
	    changed[prop] = p;
	}
    }
    var result = {};
    if (!Mc.Util.dict_isempty(removed)) result.removed = Mc.Util.dict_to_set_list(removed);
    if (!Mc.Util.dict_isempty(added)) result.added = added;
    if (!Mc.Util.dict_isempty(changed)) result.changed = changed;
    if (Mc.Util.dict_isempty(result)) return null;
    return result;
};

Mc.SimpleObjectType.prototype.patch = function (v0, p) {
    var result = Mc.Util.deepCopy(v0);
    if (p === null) return result;
    var k;
    if (p.removed) {
	for (var i = 0; i < p.removed.length; i++) {
	    delete result[p.removed[i]];
	}
    }
    if (p.added) { for (k in p.added) { result[k] = p.added[k]; } }
    if (p.changed) {
	for (k in p.changed) {
	    var propType = this.typeTableFun(k) || Mc.ObjectTypes.simpleScalar;
	    result[k] = propType.patch(result[k], p.changed[k]);
	}
    }
    return result;
};

Mc.SimpleObjectType.prototype.merge = function (v1, v0, v2) {
    var props = Mc.Util.dict_union(v1, v2);
    var bResult = {};
    var failures = {};
    var haveConflicts = false;
    for (var prop in props) {
	var propType = (this.typeTableFun(prop) || Mc.ObjectTypes.simpleScalar);
	var mergedPropValue = propType.merge(Mc.validInstance(propType, v1[prop]),
					     Mc.validInstance(propType, v0[prop]),
					     Mc.validInstance(propType, v2[prop]));
	if ("ok" in mergedPropValue) {
	    bResult[prop] = mergedPropValue.ok;
	} else {
	    failures[prop] = mergedPropValue;
	    haveConflicts = true;
	}
    }

    if (haveConflicts) {
	return {objectType: "object", partial: bResult, conflicts: failures};
    } else {
	return {objectType: "object", ok: bResult};
    }
};

Mc.ObjectTypes = {
    Default: {
	emptyInstance: function () { Mc.Util.subclassResponsibility("emptyInstance"); },
	pickle: function (instance) { return instance; },
	unpickle: function (repo, blobId, jsonobject) { return jsonobject; },
	diff: function (v0, v1) { Mc.Util.subclassResponsibility("diff"); },
	patch: function (v0, p) { Mc.Util.subclassResponsibility("patch"); },
	merge: function (v1, v0, v2) { Mc.Util.subclassResponsibility("merge"); }
    },

    simpleScalar: {
	emptyInstance: function () { return undefined; },
	diff: function (v0, v1) {
	    if (Mc.Util.scalarsEqual(v0, v1)) return null;
	    return {replacement: v1};
	},
	patch: function (v0, p) {
	    if (p === null) return v0;
	    return p.replacement;
	},
	merge: function (v1, v0, v2) {
	    if (v1 == v2) return {objectType: "scalar", ok: v1};
	    if (v1 == v0) return {objectType: "scalar", ok: v2};
	    if (v2 == v0) return {objectType: "scalar", ok: v1};
	    return {objectType: "scalar", conflict: {a: v1, o: v0, b: v2}};
        }
    },

    simpleText: {
	emptyInstance: function () { return []; },
	diff: function (v0, v1) {
	    var p = Diff.strip_patch(Diff.diff_patch(v0, v1));
	    return (p.length === 0) ? null : p;
	},
	patch: function (v0, p) {
	    if (p === null) return v0;
	    return Diff.patch(v0, p);
	},
	merge: function (v1, v0, v2) {
	    var mergeResult = Diff.diff3_merge(v1, v0, v2, true);
	    if (mergeResult.length == 1 && ("ok" in mergeResult[0])) {
		return {objectType: "text", ok: mergeResult[0].ok};
	    } else {
		return {objectType: "text", result: mergeResult};
	    }
        }
    },

    paragraphString: {
	emptyInstance: function () { return ""; },
	diff: function (v0, v1) {
	    return Mc.ObjectTypes.simpleText.diff(v0.split('\n'), v1.split('\n'));
	},
	patch: function (v0, p) {
	    if (p === null) return v0;
	    return Mc.ObjectTypes.simpleText.patch(v0.split('\n'), p).join('\n');
	},
	merge: function (v1, v0, v2) {
	    return Mc.ObjectTypes.simpleText.merge(v1.split('\n'), v0.split('\n'), v2.split('\n'));
	}
    },

    rawObject: new Mc.SimpleObjectType({}, {}),

    index: (function () {
	var t = new Mc.SimpleObjectType({inodes: {}, names: {}},
					{
					    inodes: new Mc.SimpleObjectType({}, {}),
					    names: new Mc.SimpleObjectType({}, {})
					});
	t.merge = function (v1, v0, v2) {
	    // We cannot merge indexes directly for the same reasons
	    // we can't merge commits.
	    throw {message: "Cannot merge indexes", v1: v1, v0: v0, v2: v2};
	};
	return t;
    })(),

    commit: {
	emptyInstance: function () { return {value: null, parents: [], metadata: {}}; },
	diff: function (v0, v1) {
	    throw {message: "Cannot diff commits", v0: v0, v1: v1};
	},
	merge: function (v1, v0, v2) {
	    // We cannot merge commits directly, because it involves
	    // recursive merges which create new blob IDs, and we
	    // don't know our repository. Instead, we construct a
	    // merged commit explicitly, outside of the normal merging
	    // code.
	    throw {message: "Cannot merge commits", v1: v1, v0: v0, v2: v2};
	}
    }
};

Mc.TypeDirectory = {
    "scalar": Mc.ObjectTypes.simpleScalar,
    "text": Mc.ObjectTypes.simpleText,
    "textFile": new Mc.SimpleObjectType({bodyText: ""},
					{bodyText: Mc.ObjectTypes.paragraphString}),
    "object": Mc.ObjectTypes.rawObject,
    "index": Mc.ObjectTypes.index,
    "commit": Mc.ObjectTypes.commit
};

Mc.lookupType = function (typeName) {
    var t = Mc.TypeDirectory[typeName];
    if (!t) {
	throw {message: "ObjectType not found",
	       typeName: typeName};
    }
    return t;
};

Mc.typeMethod = function (t, methodName) {
    if (!t) { t = Mc.ObjectTypes.Default; }
    var method = t[methodName];
    if (method) {
	return function () { return method.apply(t, arguments); };
    } else {
	return Mc.ObjectTypes.Default[methodName];
    }
};

Mc.validInstance = function (t, maybeInstance) {
    if (typeof(maybeInstance) == "undefined") {
	return Mc.typeMethod(t, "emptyInstance")();
    }
    return maybeInstance;
};

Mc.Repository = function () {
    this.repoId = Mc.Util.random_uuid();
    this.blobs = {}; // blobId -> pickledInstanceRecord
    this.tags = {}; // repoid/bookmarkname -> {blobId: blobId, isBranch: boolean}
    this.remotes = {}; // remotename -> {repoId: remote_repoId}
    this.accidentalCleanMerge = true; // set to false to disable

    this.emptyCaches();

    var checkout = new Mc.Checkout(this, null);
    checkout.anyDirty = true; // cheeky
    checkout.activeBranch = "master"; // *very* cheeky
    checkout.commit();
};

Mc.Repository.prototype.emptyCaches = function () {
    this.cache = {}; // blobId -> unpickledInstance
};

Mc.Repository.prototype.lookupTag = function (tagOrBranch) {
    if (!tagOrBranch) {
	tagOrBranch = "master";
    }

    var slashPos = tagOrBranch.indexOf("/");
    var repoName = null;
    var repoId;
    var bookmarkName;
    if (slashPos == -1) {
	repoId = this.repoId;
	bookmarkName = tagOrBranch;
    } else {
	repoName = tagOrBranch.substring(0, slashPos);
	var repoInfo = this.remotes[repoName];
	if (repoInfo) {
	    repoId = repoInfo.repoId;
	} else {
	    repoId = repoName; // deals with a given literal repoId
	}
	bookmarkName = tagOrBranch.substring(slashPos + 1);
    }

    var finalTag = repoId + "/" + bookmarkName;
    var tagInfo = this.tags[finalTag];
    if (tagInfo) {
	return { repoName: repoName,
		 isRemote: (repoName != null),
		 repoId: repoId,
		 bookmarkName: bookmarkName,
		 blobId: tagInfo.blobId,
		 isBranch: tagInfo.isBranch };
    } else {
	return null;
    }
};

Mc.Repository.prototype.prettyTag = function (fullTag) {
    var pieces = fullTag.split("/");
    if (pieces[0] == this.repoId) {
	return pieces[1];
    } else {
	for (var repoName in this.remotes) {
	    if (pieces[0] == this.remotes[repoName].repoId) {
		return repoName + "/" + pieces[1];
	    }
	}
	return fullTag;
    }
};

Mc.Repository.prototype.resolve = function (blobIdOrTag) {
    if (Mc.Util.blobIdKey(blobIdOrTag) in this.blobs) {
	return blobIdOrTag;
    } else {
	var tagInfo = this.lookupTag(blobIdOrTag);
	return tagInfo ? tagInfo.blobId : null;
    }
};

Mc.Repository.prototype.maybeResolve = function (blobIdOrTag, shouldResolve) {
    // shouldResolve is an optional parameter defaulting to true,
    // hence the odd test in the line below
    var resolved = (shouldResolve !== false) ? this.resolve(blobIdOrTag) : blobIdOrTag;
    if (!resolved) return null;
    return resolved;
};

Mc.Repository.prototype.store = function (instance, // a picklable object
					  objectType, // a key into Mc.TypeDirectory
					  baseId)
{
    var t = Mc.lookupType(objectType);
    var jsonInstance = Mc.typeMethod(t, "pickle")(instance);
    var jsonText = JSON.stringify(jsonInstance);
    var blobId = SHA1.hex_sha1(SHA1.encode_utf8(jsonText));
    if (Mc._debugMode) { blobId = "blob-" + blobId.substring(0, 8); }

    var entry;
    if (baseId) {
	var differ = Mc.typeMethod(t, "diff");
	var diffJson = differ(Mc.validInstance(t, this.lookupUnsafe(baseId)), instance);
	if (diffJson === null) {
	    // No changes to the data? Then claim we're identical to
	    // our base object.
	    return objectType + ":" + Mc.Util.blobIdKey(baseId);
	}
	entry = {baseId: baseId, diff: JSON.stringify(diffJson)};
    } else {
	entry = {full: jsonText};
    }
    this.blobs[blobId] = entry;

    return objectType + ":" + blobId;
};

Mc.Repository.prototype.lookup = function (blobId, shouldResolve) {
    return Mc.Util.deepCopy(this.lookupUnsafe(blobId, shouldResolve));
};

Mc.Repository.prototype.lookupUnsafe = function (blobId, shouldResolve) {
    var resolved = this.maybeResolve(blobId, shouldResolve);

    if (!(resolved in this.cache)) {
	var k = Mc.Util.blobIdKey(resolved);
	if (!(k in this.blobs)) {
	    return null;
	}
	var entry = this.blobs[k];

	var t = Mc.lookupType(Mc.Util.blobIdType(resolved));


	if (entry.diff) {
	    // We don't use unpickle(patch(base, diff)) here because
	    // the base object is the result of lookupUnsafe and
	    // therefore is already unpickled. The contract of patch
	    // is to adjust an already-unpickled instance to take into
	    // account the given patch data.
	    var patcher = Mc.typeMethod(t, "patch");
	    this.cache[resolved] =
		patcher(Mc.validInstance(t, this.lookupUnsafe(entry.baseId)),
			JSON.parse(entry.diff));
	} else {
	    var unpickler = Mc.typeMethod(t, "unpickle");
	    this.cache[resolved] = unpickler(this, resolved, JSON.parse(entry.full));
	}
    }
    return this.cache[resolved];
};

Mc.Repository.prototype.merge = function (b1, b0, b2) {
    b1 = this.resolve(b1);
    b2 = this.resolve(b2);

    var objectType = Mc.Util.blobIdType(b1);
    var ancestorObjectType = Mc.Util.blobIdType(b0);
    if ((objectType != Mc.Util.blobIdType(b2)) || ((ancestorObjectType !== null) &&
						   (objectType != Mc.Util.blobIdType(b0))))
    {
	throw {message: "Object type mismatch",
	       blobIds: [b1, b0, b2]};
    }

    var t = Mc.lookupType(objectType);
    if (!t) {
	throw {message: "Invalid object type",
	       objectType: objectType};
    }

    var inst1 = this.lookupUnsafe(b1);
    var inst2 = this.lookupUnsafe(b2);
    var inst0;

    if (b0) {
	inst0 = this.lookupUnsafe(b0, false); // note: not resolved further!
    } else {
	inst0 = undefined;
    }

    if (this.accidentalCleanMerge && (b1 == b2)) {
	return {objectType: objectType, ok: inst1, mergeBlobId: b1};
    }

    if (b2 == b0) {
	return {objectType: objectType, ok: inst1, mergeBlobId: b1};
    }
    if (b1 == b0) {
	return {objectType: objectType, ok: inst2, mergeBlobId: b2};
    }

    var result = Mc.typeMethod(t, "merge")(inst1, Mc.validInstance(t, inst0), inst2);
    return result;
};

Mc.Repository.prototype.tag = function (blobId, tagName, isBranch) {
    this.tags[this.repoId + "/" + tagName] = {blobId: blobId, isBranch: isBranch || false};
};

Mc.Repository.prototype.allBranches = function () {
    var result = {};
    for (var tag in this.tags) {
	if (this.tags[tag].isBranch) {
	    result[tag] = this.tags[tag].blobId;
	}
    }
    return result;
};

Mc.Repository.prototype.exportRevisions = function () {
    return {repoId: this.repoId,
	    blobs: this.blobs,
	    tags: this.tags,
	    remotes: this.remotes};
};

Mc.Repository.prototype.importRevisions = function (exportedData) {
    for (var blobId in exportedData.blobs) {
	if (!(blobId in this.blobs)) {
	    this.blobs[blobId] = exportedData.blobs[blobId];
	}
    }
    for (var tag in exportedData.tags) {
	if (tag.substring(0, exportedData.repoId.length) == exportedData.repoId) {
	    this.tags[tag] = exportedData.tags[tag];
	}
    }
};

Mc.Checkout = function (repo, blobIdOrTag) {
    this.repo = repo;

    this.changeListeners = {
	inode: [],
	name: [],
	commit: []
    };

    var tagInfo = repo.lookupTag(blobIdOrTag);
    this.activeBranch = (tagInfo && !tagInfo.isRemote) ? tagInfo.bookmarkName : null;
    this.forceCheckout(blobIdOrTag);
};

Mc.Checkout.prototype.forceCheckout = function (blobIdOrTag) {
    var resolved = this.repo.resolve(blobIdOrTag);
    var commit = this.repo.lookup(resolved, false);
    if (commit) {
	var index = this.repo.lookup(commit.value);
	if (!index) { throw {message: "Checkout's parent's index not found", commitId: resolved}; }
	this.inodes = index.inodes;
	this.names = index.names;
	this.directParentIndexId = commit.value;
	this.directParent = resolved;
    } else {
	this.inodes = {};
	this.names = {};
	this.directParentIndexId = undefined;
	this.directParent = undefined;
    }
    this.resetTemporaryState();
    Mc.Util.broadcast(this.changeListeners.commit,
		      {checkout: this, checkout: this.directParent});
};

Mc.Checkout.prototype.resetTemporaryState = function () {
    this.unmodifiedInodes = Mc.Util.deepCopy(this.inodes);
    this.newInstances = []; // list of {instance:, objectType:, baseId:}
    this.dirtyInodes = {}; // inodeId -> ({instanceIndex:instanceIndex} | {blobId:blobId})
    this.conflicts = null;
    this.anyDirty = false;
    this.additionalParent = undefined;
};

Mc.Checkout.prototype.ensureClean = function (what) {
    if (this.anyDirty) {
	throw {message: ("Cannot "+what+" dirty checkout")};
    }
};

Mc.Checkout.prototype.tag = function (tagName, force, isBranch) {
    var existing = this.repo.lookupTag(tagName);
    if (existing && !force) {
	return false;
    } else {
	if (!this.directParent) {
	    throw {message: "Cannot tag checkout with no parent commit"};
	}
	this.repo.tag(this.directParent, tagName, isBranch || false);
	if (isBranch) {
	    this.activeBranch = tagName;
	}
	return true;
    }
};

Mc.Checkout.prototype.lookupFile = function (fileName, createIfAbsent) {
    if (fileName in this.names) {
	return this.names[fileName];
    } else {
	createIfAbsent = createIfAbsent || false;
	if (createIfAbsent) {
	    var newInodeId = Mc.Util.random_uuid();
	    if (Mc._debugMode) { newInodeId = "inode-" + newInodeId; }
	    this.names[fileName] = newInodeId;
	    this.anyDirty = true;
	    return newInodeId;
	} else {
	    throw {message: "File not found", fileName: fileName};
	}
    }
};

Mc.Checkout.prototype.resolveInode = function (inodeId) {
    if (inodeId in this.dirtyInodes) {
	return this.dirtyInodes[inodeId];
    }
    if (inodeId in this.inodes) {
	return {blobId: this.inodes[inodeId]};
    }
    throw {message: "Internal error: missing inode", inodeId: inodeId};
};

Mc.Checkout.prototype.writeFile = function (fileName, instance, objectType) {
    objectType = objectType || "object";
    var inodeId = this.lookupFile(fileName, true);
    this.writeInode(inodeId, instance, objectType, this.unmodifiedInodes[inodeId]);
    Mc.Util.broadcast(this.changeListeners.name,
		      {checkout: this, name: fileName, kind: 'write'});
};

Mc.Checkout.prototype.writeInode = function (inodeId,
					     instance,
					     objectType,
					     baseId)
{
    this.newInstances.push({instance: Mc.Util.deepCopy(instance),
			    objectType: objectType,
			    baseId: baseId});
    this.dirtyInodes[inodeId] = {instanceIndex: (this.newInstances.length - 1)};
    this.anyDirty = true;
    Mc.Util.broadcast(this.changeListeners.inode, {checkout: this, inode: inodeId});
};

Mc.Checkout.prototype.copyFile = function (sourceName, targetName) {
    var inodeId = this.lookupFile(sourceName);
    var instanceLocation = this.resolveInode(inodeId);
    var newInodeId = this.lookupFile(targetName, true);
    this.dirtyInodes[newInodeId] = instanceLocation;
    this.anyDirty = true;
    Mc.Util.broadcast(this.changeListeners.inode, {checkout: this, inode: newInodeId});
    Mc.Util.broadcast(this.changeListeners.name,
		      {checkout: this, name: targetName, kind: 'write'});
};

Mc.Checkout.prototype.renameFile = function (sourceName, targetName) {
    var inodeId = this.lookupFile(sourceName);
    this.names[targetName] = inodeId;
    delete this.names[sourceName];
    this.anyDirty = true;
    Mc.Util.broadcast(this.changeListeners.name,
		      {checkout: this, name: sourceName, kind: 'delete'});
    Mc.Util.broadcast(this.changeListeners.name,
		      {checkout: this, name: targetName, kind: 'write'});
};

Mc.Checkout.prototype.getInstance = function (blobId) {
    var instance = this.repo.lookup(blobId, false);
    if (!instance) {
	throw {message: "Missing blob", blobId: blobId};
    }
    return instance;
};

Mc.Checkout.prototype.readFile = function (fileName) {
    var inodeId = this.lookupFile(fileName);
    var instanceLocation = this.resolveInode(inodeId);
    var result;
    if (instanceLocation.blobId) {
	result = {instance: this.getInstance(instanceLocation.blobId),
		  objectType: Mc.Util.blobIdType(instanceLocation.blobId)};
    } else {
	result = this.newInstances[instanceLocation.instanceIndex];
    }
    return Mc.Util.deepCopy(result);
};

Mc.Checkout.prototype.deleteFile = function (fileName) {
    if (fileName in this.names) {
	delete this.names[fileName];
	this.anyDirty = true;
	Mc.Util.broadcast(this.changeListeners.name,
			  {checkout: this, name: fileName, kind: 'delete'});
	return true;
    } else {
	return false;
    }
};

Mc.Checkout.prototype.fileExists = function (fileName) {
    return (fileName in this.names);
};

Mc.Checkout.prototype.forEachFile = function (f) {
    for (var name in this.names) {
	var inodeId = this.names[name];
	f(name, inodeId, inodeId in this.dirtyInodes);
    }
};

Mc.Checkout.prototype.forEachFileOfType = function (typeNameOrFilter, f) {
    var typeFilter;
    if (typeof(typeNameOrFilter) === "string") {
	typeFilter = function (typeName) { return typeName === typeNameOrFilter; };
    } else {
	typeFilter = typeNameOrFilter;
    }

    for (var name in this.names) {
	var inodeId = this.names[name];
	var instanceLocation = this.resolveInode(inodeId);
	var type;
	if (instanceLocation.blobId) {
	    type = Mc.Util.blobIdType(instanceLocation.blobId);
	} else {
	    type = this.newInstances[instanceLocation.instanceIndex].objectType;
	}
	if (typeFilter(type)) {
	    f(name, inodeId, inodeId in this.dirtyInodes);
	}
    }
};

Mc.Checkout.prototype.isDirty = function () {
    return this.anyDirty;
};

Mc.Checkout.prototype.leastCommonAncestor = function (otherCommitId) {
    var repo = this.repo;
    function lookupParents(blobId) { return repo.lookup(blobId).parents; }
    return Graph.least_common_ancestor(lookupParents, this.directParent, otherCommitId);
};

Mc.Checkout.prototype.canMerge = function (otherCommitId) {
    var ancestorBlobId = this.leastCommonAncestor(otherCommitId);
    return !(b1 == ancestorBlobId || b2 == ancestorBlobId);
};

Mc.Checkout.prototype.merge = function (otherBlobIdOrTag) {
    this.ensureClean("merge into");

    var $elf = this;
    var repo = this.repo;

    var b1 = this.directParent;
    var b2 = repo.resolve(otherBlobIdOrTag);
    if (!b2) {
	throw {message: "Could not resolve revision name", blobIdOrTag: otherBlobIdOrTag};
    }

    var b0 = this.leastCommonAncestor(b2);
    if (b0 == b1) {
	// Fast-forward to b2.
	this.forceCheckout(b2);
	return false;
    }
    if (b0 == b2) {
	// Fast-forward to b1, but we're already *at* b1.
	return false;
    }

    var commit1 = repo.lookupUnsafe(b1, false);
    var commit2 = repo.lookupUnsafe(b2, false);
    var commit0 = b0 ? repo.lookupUnsafe(b0, false) : Mc.ObjectTypes.commit.emptyInstance();

    var index1 = repo.lookupUnsafe(this.directParentIndexId, false);
    var index2 = repo.lookupUnsafe(commit2.value, false);
    var index0 = repo.lookupUnsafe(commit0.value, false);

    if (!index1) { throw {message: "Parent's index not found", commitId: b1}; }
    if (!index2) { throw {message: "Other branch's index not found", commitId: b2}; }
    if (!index0) { throw {message: "Ancestor's index not found", commitId: b0}; }

    function inodeTableEntryMerger(v1, v0, v2) {
	var mr;
	mr = Mc.ObjectTypes.simpleScalar.merge(v1, v0, v2);
	if (mr.conflict) {
	    if (typeof(v1) == "undefined" || typeof(v2) == "undefined") {
		// DieDieDieMerge for deleted entries.
		return {objectType: "inodeTable", ok: {deleted: true}};
	    }
	    mr = repo.merge(v1, v0, v2);
	    if ("ok" in mr) {
		if (mr.mergeBlobId) {
		    return {objectType: "inodeTable", ok: {blobId: mr.mergeBlobId}};
		} else {
		    return {objectType: "inodeTable", ok: {instance: mr.ok,
							   objectType: mr.objectType}};
		}
	    } else {
		return mr;
	    }
	} else {
	    return {objectType: "inodeTable", ok: {blobId: mr.ok}};
	}
    }

    var inodeTableType = new Mc.SimpleObjectType({}, {});
    inodeTableType.typeTableFun = function (key) {
	return {
	    merge: inodeTableEntryMerger,
	    emptyInstance: function () {
		return undefined;
	    }
	};
    };

    var mergeResult;
    mergeResult = inodeTableType.merge(index1.inodes, index0.inodes, index2.inodes);

    var conflicts = {};
    var haveConflicts = false;

    this.inodes = {};

    function updateInodes(tab) {
	for (var inodeId in tab) {
	    var r = tab[inodeId];
	    if (r.deleted) {
		delete $elf.inodes[inodeId];
	    } else if (r.blobId) {
		$elf.inodes[inodeId] = r.blobId;
	    } else {
		$elf.writeInode(inodeId,
				r.instance,
				r.objectType,
				index1.inodes[inodeId]);
		// TODO: possibly diff it against v2.inodes[inodeId]
		// to see if the diff is any shorter.
	    }
	}
    }

    if ("ok" in mergeResult) {
	updateInodes(mergeResult.ok);
    } else {
	haveConflicts = true;
	updateInodes(mergeResult.partial);
	conflicts.inodes = mergeResult.conflicts;
    }

    mergeResult = Mc.ObjectTypes.rawObject.merge(index1.names, index0.names, index2.names);
    this.names = {};

    function updateNames(tab) {
	for (var name in tab) {
	    if ($elf.dirtyInodes[tab[name]] || $elf.inodes[tab[name]]) {
		$elf.names[name] = tab[name];
	    }
	}
    }

    if ("ok" in mergeResult) {
	updateNames(mergeResult.ok);
    } else {
	haveConflicts = true;
	updateNames(mergeResult.partial);
	conflicts.names = mergeResult.conflicts;
    }

    this.conflicts = haveConflicts ? conflicts : null;
    this.additionalParent = b2;
    this.anyDirty = true;
    return true;
};

Mc.Checkout.prototype.commit = function (metadata) {
    var repo = this.repo;

    if (this.conflicts !== null) {
	throw {message: "Cannot commit with outstanding conflicts"};
    }

    if (!this.activeBranch) {
	throw {message: "Cannot commit; no branch specified"};
    }

    if (this.anyDirty) {
	for (var inodeId in this.dirtyInodes) {
	    var instanceLocation = this.dirtyInodes[inodeId];
	    if (instanceLocation.blobId) {
		this.inodes[inodeId] = instanceLocation.blobId;
	    } else {
		var x = this.newInstances[instanceLocation.instanceIndex];
		this.inodes[inodeId] = repo.store(x.instance,
						  x.objectType,
						  x.baseId);
	    }
	}

	var inodesInUse = {};
	for (var name in this.names) {
	    inodesInUse[this.names[name]] = 1;
	}

	var inodesToRemove = Mc.Util.dict_difference(this.inodes, inodesInUse);
	this.inodes = Mc.Util.dict_difference(this.inodes, inodesToRemove);

	var indexId = repo.store({ inodes: this.inodes, names: this.names },
				 "index",
				 this.directParentIndexId);

	var parents = [];
	if (this.directParent) { parents.push(this.directParent); }
	if (this.additionalParent) { parents.push(this.additionalParent); }

	var commitId = repo.store({ value: indexId,
				    parents: parents,
				    metadata: metadata || ({}) },
				  "commit",
				  null);

	this.resetTemporaryState();
	this.directParentIndexId = indexId;
	this.directParent = commitId;
    }

    repo.tag(this.directParent, this.activeBranch, true);
    Mc.Util.broadcast(this.changeListeners.commit,
		      {checkout: this, commit: this.directParent});
    Mc.Util.broadcast(this.changeListeners.commit,
		      {checkout: this, checkout: this.directParent});
    return this.directParent;
};
