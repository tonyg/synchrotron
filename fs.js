function random_hex_string(n) {
    var digits = "0123456789abcdef";
    var result = "";
    for (var i = 0; i < n; i++) {
	result = result + digits[Math.floor(Math.random() * 16)];
    }
    return result;
}

function random_uuid() {
    return random_hex_string(8);
/*
    return [random_hex_string(8),
	    random_hex_string(4),
	    "4" + random_hex_string(3),
	    ((Math.floor(Math.random() * 256) & ~64) | 128).toString(16) + random_hex_string(2),
	    random_hex_string(12)].join("-");
*/
}

function dict_union(s1, s2) {
    var result = {};
    for (var k in s2) { result[k] = s2[k]; }
    for (var k in s1) { result[k] = s1[k]; }
    return result;
}

function dict_difference(s1, s2) {
    var result = {};
    for (var k in s1) { result[k] = s1[k]; }
    for (var k in s2) { delete result[k]; }
    return result;
}

function dict_to_set(d) {
    for (var k in d) { d[k] = 1; }
    return d;
}

function deepCopy(obj) {
    // Courtesy of
    // http://keithdevens.com/weblog/archive/2007/Jun/07/javascript.clone
    //
    // Does not handle recursive structures.

    if (obj == null || typeof(obj) != 'object') {
        return obj;
    }

    var temp = obj.constructor();
    for (var key in obj) {
        temp[key] = deepCopy(obj[key]);
    }
    return temp;
}

function shallowCopy(obj) {
    if (obj == null || typeof(obj) != 'object') {
        return obj;
    }

    var temp = obj.constructor();
    for (var key in obj) {
        temp[key] = obj[key];
    }
    return temp;
}

function FileSystem(directParent, additionalParent) {
    this.inodes = {};
    this.directParent = directParent;
    this.additionalParent = additionalParent;
    this.dirty = {};
}

FileSystem.prototype.createFile = function() {
    var uuid = random_uuid();
    this.inodes[uuid] = {};
    return uuid;
}

FileSystem.prototype.deleteFile = function(uuid) {
    if (!this.inodes[uuid]) return false;
    delete this.inodes[uuid];
    return true;
}

FileSystem.prototype.fileExists = function(uuid) {
    return !!(this.inodes[uuid]);
}

FileSystem.prototype.getProp = function(uuid, prop) {
    var inode = this.inodes[uuid];
    if (!inode) return null;
    return deepCopy(inode[prop]);
}

FileSystem.prototype.setProp = function(uuid, prop, value) {
    var inode = this.inodes[uuid];
    if (!inode) return false;
    inode[prop] = value;
    this.dirty[uuid] = uuid;
    return true;
}

FileSystem.prototype.clone = function() {
    var result = new FileSystem(this.directParent, this.additionalParent);
    result.inodes = deepCopy(this.inodes);
    return result;
}

function simpleScalarMerger(v1, v0, v2) {
    if (v1 == v2) {
	return [{ok: v1}];
    }
    if (v1 == v0) {
	return [{ok: v2}];
    }
    if (v2 == v0) {
	return [{ok: v1}];
    }
    return [{conflict: {a: v1, o: v0, b: v2}}];
}

function simpleTextualMerger(v1, v0, v2) {
    return Diff.diff3_merge(v1, v0, v2, true);
}

DefaultMergers = {
    "text": simpleTextualMerger
};

function Repository() {
    this.bodies = {};
    this.revisions = {};
}

Repository.prototype.lookupRev = function(revId) {
    return this.revisions[revId] || { alive: {},
				      dead: {},
				      changed: [],
				      metadata: null, 
				      directParent: null,
				      additionalParent: null };
}

Repository.prototype.exportRevisions = function(revIds) {
    var revs = {};
    for (var i = 0; i < revIds; i++) {
	var rev = this.revisions[revIds[i]];
	if (rev) revs[revIds[i]] = rev;
    }

    var bodies = {};
    for (var revId in revs) {
	var alive = revs[revId].alive;
	for (var inodeId in alive) {
	    var bodyId = alive[inodeId];
	    bodies[bodyId] = this.bodies[bodyId];
	}
    }

    return {revs: revs, bodies: bodies};
}

Repository.prototype.getBody = function(revRecord, aliveInodeId) {
    var bodyId = revRecord.alive[aliveInodeId];
    if (!bodyId) return {};
    return deepCopy(this.bodies[bodyId]);
}

Repository.prototype.update = function(revId) {
    if (revId == null) {
	return new FileSystem(null, null);
    }

    var rev = this.revisions[revId];
    if (!rev) return null;
    var fs = new FileSystem(revId, null);
    for (var inode in rev.alive) {
	fs.inodes[inode] = this.getBody(rev, inode);
    }
    return fs;
}

Repository.prototype.commit = function(fs, metadata) {
    var directParentRev = this.lookupRev(fs.directParent);
    var additionalParentRev = this.lookupRev(fs.additionalParent);

    var oldAlive = dict_union(directParentRev.alive, additionalParentRev.alive);
    var oldDead = dict_union(directParentRev.dead, additionalParentRev.dead);

    var newChanged = [];
    var newAlive = {};
    for (var inodeId in fs.inodes) {
	if (fs.dirty[inodeId]) {
	    var newBodyId = random_uuid();
	    this.bodies[newBodyId] = deepCopy(fs.inodes[inodeId]);
	    newAlive[inodeId] = newBodyId;
	    newChanged.push(inodeId);
	} else {
	    newAlive[inodeId] = oldAlive[inodeId];
	}
    }

    var newDead = dict_to_set(dict_union(oldDead, dict_difference(oldAlive, newAlive)));

    var rev = { alive: newAlive,
		dead: newDead,
		changed: newChanged,
		metadata: metadata,
		directParent: fs.directParent,
		additionalParent: fs.additionalParent };

    var newRevId = random_uuid();
    this.revisions[newRevId] = rev;

    fs.directParent = newRevId;
    fs.additionalParent = null;

    return newRevId;
}

Repository.prototype.merge = function(r1, r2) {
    if (r1 == r2) {
	return this.update(r1);
    }

    var rev1 = this.lookupRev(r1);
    var rev2 = this.lookupRev(r2);

    var self = this;
    function lookupParents(revId) {
	var r = self.lookupRev(revId);
	var result = [];
	if (r.directParent) result.push(r.directParent);
	if (r.additionalParent) result.push(r.additionalParent);
	return result;
    }

    var ancestorRevId = Graph.least_common_ancestor(lookupParents, r1, r2);
    var ancestorRev = this.lookupRev(ancestorRevId);

    var fs = this.update(r1);
    fs.additionalParent = r2;

    var conflicts = [];

    for (var deadInode in rev2.dead) {
	fs.deleteFile(deadInode);
    }
    for (var aliveInode in rev2.alive) {
	if (fs.fileExists(aliveInode)) {
	    var body0 = this.getBody(ancestorRev, aliveInode);
	    var body1 = fs.inodes[aliveInode];
	    var body2 = this.getBody(rev2, aliveInode);
	    this.mergeBodies(body1, body0, body2,
			     function (mergedBody) {
				 fs.inodes[aliveInode] = mergedBody;
				 fs.dirty[aliveInode] = aliveInode;
			     },
			     function (partialResult, conflictDetails) {
				 conflicts.push({inode: aliveInode,
						 partialResult: partialResult,
						 conflictDetails: conflictDetails});
			     });
	} else if (!rev1.dead[aliveInode]) {
	    fs.inodes[inode] = this.getBody(rev2, aliveInode);
	}
    }

    return {files: fs, conflicts: conflicts};
}

Repository.prototype.lookupMerger = function(prop) {
    return DefaultMergers[prop] || simpleScalarMerger;
}

Repository.prototype.mergeBodies = function(bThis, bBase, bOther, kSuccess, kConflict) {
    var props = dict_union(bThis, bOther);
    var bResult = {};
    var failures = {};
    var haveConflicts = false;
    for (var prop in props) {
	var merger = this.lookupMerger(prop);
	var mergedPropValue = merger(bThis[prop], bBase[prop], bOther[prop]);
	if (mergedPropValue.length == 1 && mergedPropValue[0].ok) {
	    bResult[prop] = mergedPropValue[0].ok;
	} else {
	    failures[prop] = mergedPropValue;
	    haveConflicts = true;
	}
    }

    if (haveConflicts) {
	return kConflict(bResult, failures);
    } else {
	return kSuccess(bResult);
    }
}

function Rt1() {
    var repo = new Repository();
    var fs = repo.update(null);

    function d(x) {
	print(x);
	print(uneval(repo));
	print(uneval(fs));
	print();
    }

    var fileA = fs.createFile();
    d("start");

    fs.setProp(fileA, "name", "File A");
    fs.setProp(fileA, "text", "A B C D E".split(/ /));
    var rA = repo.commit(fs);
    d("post-rA");
    fs.setProp(fileA, "text", "G G G A B C D E".split(/ /));
    var rB1 = repo.commit(fs);
    d("post-rB1");
    fs.setProp(fileA, "text", "A B C D E G G G A B C D E".split(/ /));
    var rB2 = repo.commit(fs);
    d("post-rB2");

    fs = repo.update(rA);
    d("post-update-to-rA");
    fs.setProp(fileA, "name", "File A, renamed");
    fs.setProp(fileA, "text", "A B X D E".split(/ /));
    var rC = repo.commit(fs);
    d("post-rC");

    var mergeResult = repo.merge(rB2, rC);
    print("--------------------");
    print(uneval(mergeResult));
    print("--------------------");

    var rMerger = repo.commit(mergeResult.files);
    fs = repo.update(rMerger);
    d("post-rMerger");

    fs = repo.update(rB2);
    fs.deleteFile(fileA);
    var rB3 = repo.commit(fs);
    d("post-rB3");

    var rMerger2 = repo.commit(repo.merge(rB3, rMerger).files);
    fs = repo.update(rMerger2);
    d("post-rMerger2");
}
