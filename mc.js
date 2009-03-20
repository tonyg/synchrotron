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

var Mc = {
    _debugMode: false
};

Mc.Util = (function()
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

    return {
	random_uuid: random_uuid,
	dict_union: dict_union,
	dict_difference: dict_difference,
	dict_to_set: dict_to_set,
	dict_to_set_list: dict_to_set_list,
	dict_isempty: dict_isempty,
	deepCopy: deepCopy,
	subclassResponsibility: subclassResponsibility,
	blobIdType: blobIdType,
	blobIdKey: blobIdKey
    };
})();

// A repository is a collection of hash-keyed blobs. When a blob is
// retrieved from the repository, it is revivified, and when it is
// inserted, it is pickled.
//
// Objects stored in a repository need to have a class, called an
// "objectType" below. Object types know how to:
//
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
// An index is a commit-record that also maps "filename"s to inodeIds,
// and inodeIds to blobIds.
//
// A checkout is a non-version-controlled object that holds an index and
// also provides read/write/merge/commit services and a cache of
// unpickled objects.

Mc.ObjectTypes = {
    Default: {
	pickle: function (instance) { return instance; },
	unpickle: function (repo, blobId, jsonobject) { return jsonobject; },
	diff: function (v0, v1) { Mc.Util.subclassResponsibility("diff"); },
	patch: function (v0, p) { Mc.Util.subclassResponsibility("patch"); },
	merge: function (v1, v0, v2) { Mc.Util.subclassResponsibility("merge"); }
    },

    simpleScalar: {
	diff: function (v0, v1) {
	    if (v0 == v1) return null;
	    return {replacement: v1};
	},
	patch: function (v0, p) {
	    if (p === null) return v0;
	    return p.replacement;
	},
	merge: function(v1, v0, v2) {
	    if (v1 == v2) return {objectType: "scalar", ok: v1};
	    if (v1 == v0) return {objectType: "scalar", ok: v2};
	    if (v2 == v0) return {objectType: "scalar", ok: v1};
	    return {objectType: "scalar", conflict: {a: v1, o: v0, b: v2}};
        }
    },

    simpleText: {
	diff: function (v0, v1) {
	    var p = Diff.strip_patch(Diff.diff_patch(v0, v1));
	    return (p.length === 0) ? null : p;
	},
	patch: function (v0, p) {
	    if (p === null) return v0;
	    return Diff.patch(v0, p);
	},
	merge: function(v1, v0, v2) {
	    var mergeResult = Diff.diff3_merge(v1, v0, v2, true);
	    if (mergeResult.length == 1 && ("ok" in mergeResult[0])) {
		return {objectType: "text", ok: mergeResult[0].ok};
	    } else {
		return {objectType: "text", result: mergeResult};
	    }
        }
    },

    simpleObject: {
	diff: function (v0, v1, typeTableFun) {
	    var removed = Mc.Util.dict_difference(v0, v1);
	    var added = Mc.Util.dict_difference(v1, v0);
	    var changed = {};
	    if (!typeTableFun) {
		typeTableFun = Mc.SimpleObjectTypeTableFun;
	    }
	    var common = Mc.Util.dict_difference(v1, added);
	    for (var prop in common) {
		var differ = (typeTableFun(prop) || Mc.ObjectTypes.simpleScalar).diff;
		var p = differ(v0[prop], v1[prop]);
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
	},
	patch: function (v0, p, typeTableFun) {
	    var result = Mc.Util.deepCopy(v0);
	    if (p === null) return result;
	    var k;
	    if (!typeTableFun) {
		typeTableFun = Mc.SimpleObjectTypeTableFun;
	    }
	    if (p.removed) {
		for (var i = 0; i < p.removed.length; i++) {
		    delete result[p.removed[i]];
		}
	    }
	    if (p.added) { for (k in p.added) { result[k] = p.added[k]; } }
	    if (p.changed) {
		for (k in p.changed) {
		    var patcher = (typeTableFun(k) || Mc.ObjectTypes.simpleScalar).patch;
		    result[k] = patcher(result[k], p.changed[k]);
		}
	    }
	    return result;
	},
	merge: function(v1, v0, v2, typeTableFun) {
	    var props = Mc.Util.dict_union(v1, v2);
	    var bResult = {};
	    var failures = {};
	    var haveConflicts = false;
	    if (!typeTableFun) {
		typeTableFun = Mc.SimpleObjectTypeTableFun;
	    }
	    for (var prop in props) {
		var merger = (typeTableFun(prop) || Mc.ObjectTypes.simpleScalar).merge;
		var mergedPropValue = merger(v1[prop], v0[prop], v2[prop]);
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
	}
    },

    basicIndex: {
	diff: function (v0, v1) {
	    var result = {};
	    var d;
	    d = Mc.ObjectTypes.simpleObject.diff(v0.inodes, v1.inodes, Mc.RawObjectTypeTableFun);
	    if (d) { result.inodes = d; }
	    d = Mc.ObjectTypes.simpleObject.diff(v0.names, v1.names, Mc.RawObjectTypeTableFun);
	    if (d) { result.names = d; }
	    result.metadata = v1.metadata;
	    return result;
	},
	patch: function (v0, p) {
	    var result = Mc.Util.deepCopy(v0);
	    result.inodes = Mc.ObjectTypes.simpleObject.patch(result.inodes, p.inodes || null);
	    result.names = Mc.ObjectTypes.simpleObject.patch(result.names, p.names || null);
	    result.metadata = p.metadata;
	    return result;
	},
	merge: function(v1, v0, v2) {
	    // We cannot merge indexes directly, because they map
	    // inode IDs to blob IDs, and merging would need to insert
	    // new blob IDs. Instead, we construct a merged index
	    // explicitly, outside of the normal merging code.
	    throw {message: "Cannot merge indexes",
		   v1: v1,
		   v0: v0,
		   v2: v2};
	}
    }
};

Mc.TypeDirectory = {
    "scalar": Mc.ObjectTypes.simpleScalar,
    "text": Mc.ObjectTypes.simpleText,
    "object": Mc.ObjectTypes.simpleObject,
    "index": Mc.ObjectTypes.basicIndex
};

Mc.lookupType = function(typeName) {
    var t = Mc.TypeDirectory[typeName];
    if (!t) {
	throw {message: "ObjectType not found",
	       typeName: typeName};
    }
    return t;
};

Mc.SimpleObjectTypeTable = {
    "text": Mc.ObjectTypes.simpleText
};

Mc.typeTableFun = function (table) {
    return function (key) {
	return table[key];
    };
};

Mc.SimpleObjectTypeTableFun = Mc.typeTableFun(Mc.SimpleObjectTypeTable);

Mc.RawObjectTypeTableFun = Mc.typeTableFun({});

Mc.Repository = function() {
    this.repo_id = Mc.Util.random_uuid();
    this.blobs = {}; // blobId -> pickledInstanceRecord
    this.tags = {}; // repoid/bookmarkname -> blobId
    this.remotes = {}; // remotename -> remote_repo_id
    this.accidentalCleanMerge = true; // set to false to disable

    this.cache = {}; // blobId -> unpickledInstance

    var checkout = new Mc.Checkout(this, null);
    checkout.anyDirty = true; // cheeky
    checkout.commit();
};

Mc.Repository.prototype.emptyCache = function() {
    this.cache = {}; // blobId -> unpickledInstance
};

Mc.Repository.prototype.resolve = function(blobIdOrTag) {
    if (Mc.Util.blobIdKey(blobIdOrTag) in this.blobs) {
	return blobIdOrTag;
    } else {
	if (!blobIdOrTag) {
	    blobIdOrTag = "master";
	}

	var slashPos = blobIdOrTag.indexOf("/");
	if (slashPos == -1) {
	    blobIdOrTag = this.repo_id + "/" + blobIdOrTag;
	} else {
	    var remoteName = blobIdOrTag.substring(0, slashPos);
	    var bookmarkName = blobIdOrTag.substring(slashPos + 1);
	    var repoId = this.remotes[remoteName];
	    if (repoId) { remoteName = repoId; }
	    blobIdOrTag = remoteName + "/" + bookmarkName;
	}
	return this.tags[blobIdOrTag];
    }
};

Mc.Repository.prototype.maybeResolve = function(blobIdOrTag, shouldResolve) {
    // shouldResolve is an optional parameter defaulting to true,
    // hence the odd test in the line below
    var resolved = (shouldResolve !== false) ? this.resolve(blobIdOrTag) : blobIdOrTag;
    if (!resolved) return null;
    return resolved;
};

Mc.Repository.prototype.store = function(instance, // a picklable object
					 objectType, // a key into Mc.TypeDirectory
					 directParent,
					 additionalParent)
{
    var t = Mc.lookupType(objectType);
    var entry = {directParent: directParent, additionalParent: additionalParent};

    var jsonInstance = (t.pickle || Mc.ObjectTypes.Default.pickle)(instance);
    var jsonText = JSON.stringify(jsonInstance);
    var blobId = SHA1.hex_sha1(SHA1.encode_utf8(jsonText));
    if (Mc._debugMode) { blobId = "blob-" + blobId.substring(0, 8); }

    if (directParent) {
	var differ = t.diff || Mc.ObjectTypes.Default.diff;
	var diffJson = differ(this.lookupUnsafe(directParent), instance);
	entry.diff = JSON.stringify(diffJson);
    } else {
	entry.full = jsonText;
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
	    var patcher = (t.patch || Mc.ObjectTypes.Default.patch);
	    this.cache[resolved] = patcher(this.lookupUnsafe(entry.directParent),
					   JSON.parse(entry.diff));
	} else {
	    var unpickler = (t.unpickle || Mc.ObjectTypes.Default.unpickle);
	    this.cache[resolved] = unpickler(this, resolved, JSON.parse(entry.full));
	}
    }
    return this.cache[resolved];
};

Mc.Repository.prototype.lookupParents = function (blobId) {
    var result = [];
    var entry = this.blobs[Mc.Util.blobIdKey(blobId)];
    if (entry) {
	if (entry.directParent) result.push(entry.directParent);
	if (entry.additionalParent) result.push(entry.additionalParent);
    }
    return result;
};

Mc.Repository.prototype.leastCommonAncestor = function(b1, b2) {
    var $elf = this;
    function lookupParents(blobId) { return $elf.lookupParents(blobId); }
    return Graph.least_common_ancestor(lookupParents, this.resolve(b1), this.resolve(b2));
};

Mc.Repository.prototype.canMerge = function(b1, b2) {
    var ancestorBlobId = this.leastCommonAncestor(b1, b2);
    return !(b1 == ancestorBlobId || b2 == ancestorBlobId);
};

Mc.Repository.prototype.merge = function(b1, b2, metadata) {
    var ancestorBlobId = this.leastCommonAncestor(b1, b2);
    return this.merge3(b1, ancestorBlobId, b2, metadata);
};

Mc.Repository.prototype.merge3 = function (b1, b0, b2, metadata) {
    b1 = this.resolve(b1);
    b2 = this.resolve(b2);

    var objectType = Mc.Util.blobIdType(b1);
    if ((objectType != Mc.Util.blobIdType(b2)) || (objectType != Mc.Util.blobIdType(b0)))
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
    var inst0 = this.lookupUnsafe(b0); // note: not resolved further!

    if (this.accidentalCleanMerge && (b1 == b2)) {
	return {objectType: objectType, ok: inst1, mergeBlobId: b1};
    }

    if (b2 == b0) {
	return {objectType: objectType, ok: inst1, mergeBlobId: b1};
    }
    if (b1 == b0) {
	return {objectType: objectType, ok: inst2, mergeBlobId: b2};
    }

    var result = (t.merge || Mc.ObjectTypes.Default.merge)(inst1, inst0, inst2);
    return result;
};

Mc.Repository.prototype.tag = function(blobId, tagName) {
    this.tags[this.repo_id + "/" + tagName] = blobId;
};

Mc.Repository.prototype.exportRevisions = function() {
    return {repo_id: this.repo_id,
	    blobs: this.blobs,
	    tags: this.tags,
	    remotes: this.remotes};
};

Mc.Repository.prototype.importRevisions = function(exportedData) {
    for (var blobId in exportedData.blobs) {
	if (!(blobId in this.blobs)) {
	    this.blobs[blobId] = exportedData.blobs[blobId];
	}
    }
    for (var tag in exportedData.tags) {
	if (tag.substring(0, exportedData.repo_id.length) == exportedData.repo_id) {
	    this.tags[tag] = exportedData.tags[tag];
	}
    }
};

Mc.Checkout = function(repo, blobIdOrTag) {
    this.repo = repo;
    this.branchName = "master";

    var resolved = repo.resolve(blobIdOrTag);
    var index = repo.lookup(resolved, false);
    if (index) {
	this.inodes = index.inodes; // inodeId -> blobId
	this.names = index.names; // name -> inodeId
	this.directParent = resolved;
    } else {
	this.inodes = {};
	this.names = {};
	this.directParent = undefined;
    }

    this.resetTemporaryState();
};

Mc.Checkout.prototype.resetTemporaryState = function() {
    this.unmodifiedInodes = Mc.Util.deepCopy(this.inodes);
    this.newInstances = []; // list of {instance:, objectType:, directParent:, additionalParent:}
    this.dirtyInodes = {}; // inodeId -> ({instanceIndex:instanceIndex} | {blobId:blobId})
    this.conflicts = null;
    this.anyDirty = false;
    this.additionalParent = undefined;
};

Mc.Checkout.prototype.ensureClean = function(what) {
    if (this.anyDirty) {
	throw {message: ("Cannot "+what+" dirty checkout")};
    }
};

Mc.Checkout.prototype.setBranch = function(branchName) {
    this.branchName = branchName;
};

Mc.Checkout.prototype.lookupFile = function(fileName, createIfAbsent) {
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

Mc.Checkout.prototype.resolveInode = function(inodeId) {
    if (inodeId in this.dirtyInodes) {
	return this.dirtyInodes[inodeId];
    }
    if (inodeId in this.inodes) {
	return {blobId: this.inodes[inodeId]};
    }
    throw {message: "Internal error: missing inode", inodeId: inodeId};
};

Mc.Checkout.prototype.writeFile = function(fileName, instance, objectType) {
    objectType = objectType || "object";
    var inodeId = this.lookupFile(fileName, true);
    this.writeInode(inodeId, instance, objectType, this.unmodifiedInodes[inodeId]);
};

Mc.Checkout.prototype.writeInode = function(inodeId,
					    instance,
					    objectType,
					    directParent,
					    additionalParent)
{
    this.newInstances.push({instance: Mc.Util.deepCopy(instance),
			    objectType: objectType,
			    directParent: directParent,
			    additionalParent: additionalParent});
    this.dirtyInodes[inodeId] = {instanceIndex: (this.newInstances.length - 1)};
    this.anyDirty = true;
};

Mc.Checkout.prototype.copyFile = function(sourceName, targetName) {
    var inodeId = this.lookupFile(sourceName);
    var instanceLocation = this.resolveInode(inodeId);
    var newInodeId = this.lookupFile(targetName, true);
    this.dirtyInodes[newInodeId] = instanceLocation;
    this.anyDirty = true;
};

Mc.Checkout.prototype.renameFile = function(sourceName, targetName) {
    var inodeId = this.lookupFile(sourceName);
    this.names[targetName] = inodeId;
    delete this.names[sourceName];
    this.anyDirty = true;
};

Mc.Checkout.prototype.getInstance = function(blobId) {
    var instance = this.repo.lookup(blobId, false);
    if (!instance) {
	throw {message: "Missing blob", blobId: blobId};
    }
    return instance;
};

Mc.Checkout.prototype.readFile = function(fileName) {
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

Mc.Checkout.prototype.deleteFile = function(fileName) {
    if (fileName in this.names) {
	delete this.names[fileName];
	this.anyDirty = true;
	return true;
    } else {
	return false;
    }
};

Mc.Checkout.prototype.fileExists = function(fileName) {
    return (fileName in this.names);
};

Mc.Checkout.prototype.forEachFile = function(f) {
    for (var name in this.names) {
	f(name);
    }
};

Mc.Checkout.prototype.isDirty = function() {
    return this.anyDirty;
};

Mc.Checkout.prototype.merge = function(otherBlobIdOrTag) {
    this.ensureClean("merge into");

    var $elf = this;
    var repo = this.repo;

    var b1 = this.directParent;
    var b2 = repo.resolve(otherBlobIdOrTag);
    var b0 = repo.leastCommonAncestor(b1, b2);

    var v1 = repo.lookupUnsafe(b1, false);
    var v2 = repo.lookupUnsafe(b2, false);
    var v0 = b0 ? repo.lookupUnsafe(b0, false) : {inodes: {}, names: {}};

    var conflicts = {};
    var haveConflicts = false;

    var mergeResult;

    function inodeTableMerger(v1, v0, v2) {
	var mr;
	mr = Mc.ObjectTypes.simpleScalar.merge(v1, v0, v2);
	if (mr.conflict) {
	    if (typeof(v1) == "undefined" || typeof(v2) == "undefined") {
		// DieDieDieMerge for deleted entries.
		return {objectType: "inodeTable", ok: {deleted: true}};
	    }
	    mr = repo.merge3(v1, v0, v2);
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
				v1.inodes[inodeId],
				v2.inodes[inodeId]);
	    }
	}
    }

    function updateNames(tab) {
	for (var name in tab) {
	    if ($elf.dirtyInodes[tab[name]] || $elf.inodes[tab[name]]) {
		$elf.names[name] = tab[name];
	    }
	}
    }

    mergeResult = Mc.ObjectTypes.simpleObject.merge(v1.inodes, v0.inodes, v2.inodes,
						    function (key) {
							return {
							    merge: inodeTableMerger
							};
						    });
    this.inodes = {};
    if ("ok" in mergeResult) {
	updateInodes(mergeResult.ok);
    } else {
	haveConflicts = true;
	updateInodes(mergeResult.partial);
	conflicts.inodes = mergeResult.conflicts;
    }

    mergeResult = Mc.ObjectTypes.simpleObject.merge(v1.names, v0.names, v2.names,
						    function (key) { return null; });
    this.names = {};
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
};

Mc.Checkout.prototype.commit = function(metadata) {
    if (this.conflicts !== null) {
	throw {message: "Cannot commit with outstanding conflicts"};
    }

    if (this.anyDirty) {
	var repo = this.repo;

	for (var inodeId in this.dirtyInodes) {
	    var instanceLocation = this.dirtyInodes[inodeId];
	    if (instanceLocation.blobId) {
		this.inodes[inodeId] = instanceLocation.blobId;
	    } else {
		var x = this.newInstances[instanceLocation.instanceIndex];
		this.inodes[inodeId] = repo.store(x.instance,
						  x.objectType,
						  x.directParent,
						  x.additionalParent);
	    }
	}

	var inodesInUse = {};
	for (var name in this.names) {
	    inodesInUse[this.names[name]] = 1;
	}

	var inodesToRemove = Mc.Util.dict_difference(this.inodes, inodesInUse);
	this.inodes = Mc.Util.dict_difference(this.inodes, inodesToRemove);

	var commitId = repo.store({
				      inodes: this.inodes,
				      names: this.names,
				      metadata: metadata
				  },
				  "index",
				  this.directParent,
				  this.additionalParent);

	this.resetTemporaryState();
	this.directParent = commitId;

	if (this.branchName) {
	    repo.tag(commitId, this.branchName);
	}
    }
    return this.directParent;
};
