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

var Dvcs = {
    Util: {
	random_hex_string: function(n) {
	    var digits = "0123456789abcdef";
	    var result = "";
	    for (var i = 0; i < n; i++) {
		result = result + digits[Math.floor(Math.random() * 16)];
	    }
	    return result;
	},

	random_uuid: function() {
	    return [Dvcs.Util.random_hex_string(8),
		    Dvcs.Util.random_hex_string(4),
		    "4" + Dvcs.Util.random_hex_string(3),
		    ((Math.floor(Math.random() * 256) & ~64) | 128).toString(16) +
		      Dvcs.Util.random_hex_string(2),
		    Dvcs.Util.random_hex_string(12)].join("-");
	},

	dict_union: function(s1, s2) {
	    var result = {};
	    for (var k in s2) { result[k] = s2[k]; }
	    for (var k in s1) { result[k] = s1[k]; }
	    return result;
	},

	dict_difference: function(s1, s2) {
	    var result = {};
	    for (var k in s1) { result[k] = s1[k]; }
	    for (var k in s2) { delete result[k]; }
	    return result;
	},

	dict_to_set: function(d) {
	    for (var k in d) { d[k] = 1; }
	    return d;
	},

	deepCopy: function(obj) {
	    // Courtesy of
	    // http://keithdevens.com/weblog/archive/2007/Jun/07/javascript.clone
	    //
	    // Does not handle recursive structures.

	    if (obj == null || typeof(obj) != 'object') {
		return obj;
	    }

	    var temp = obj.constructor();
	    for (var key in obj) {
		temp[key] = Dvcs.Util.deepCopy(obj[key]);
	    }
	    return temp;
	}
    },

    Mergers: {
	simpleScalarMerger: function(v1, v0, v2) {
	    if (v1 == v2) return [{ok: v1}];
	    if (v1 == v0) return [{ok: v2}];
	    if (v2 == v0) return [{ok: v1}];
	    return [{conflict: {a: v1, o: v0, b: v2}}];
	},

	simpleTextualMerger: function(v1, v0, v2) {
	    return Diff.diff3_merge(v1, v0, v2, true);
	},

	Defaults: {}
    },

    Checkout: function(directParent, additionalParent, currentBranch) {
	this.inodes = {};
	this.directParent = directParent;
	this.additionalParent = additionalParent;
	this.dirty = {};
	this.currentBranch = currentBranch;
    },

    Repository: function() {
	this.bodies = {};
	this.revisions = {};
	this.children = {};
    }
}

Dvcs.Mergers.Defaults["text"] = Dvcs.Mergers.simpleTextualMerger;

Dvcs.Checkout.prototype.createFile = function() {
    var uuid = Dvcs.Util.random_uuid();
    this.inodes[uuid] = {};
    return uuid;
}

Dvcs.Checkout.prototype.deleteFile = function(uuid) {
    if (!this.inodes[uuid]) return false;
    delete this.inodes[uuid];
    return true;
}

Dvcs.Checkout.prototype.fileExists = function(uuid) {
    return !!(this.inodes[uuid]);
}

Dvcs.Checkout.prototype.getProp = function(uuid, prop) {
    var inode = this.inodes[uuid];
    if (!inode) return null;
    return Dvcs.Util.deepCopy(inode[prop]);
}

Dvcs.Checkout.prototype.setProp = function(uuid, prop, value) {
    var inode = this.inodes[uuid];
    if (!inode) return false;
    inode[prop] = value;
    this.dirty[uuid] = uuid;
    return true;
}

Dvcs.Checkout.prototype.getBranch = function() {
    return this.currentBranch;
}

Dvcs.Checkout.prototype.setBranch = function(newBranch) {
    this.currentBranch = newBranch;
}

Dvcs.Checkout.prototype.clone = function() {
    var result = new Dvcs.Checkout(this.directParent,
				   this.additionalParent,
				   this.currentBranch);
    result.inodes = Dvcs.Util.deepCopy(this.inodes);
    return result;
}

Dvcs.Repository.prototype.resolveRevId = function(revId) {
    if (this.revisions[revId]) {
	return revId;
    } else {
	return this.branchTip(revId);
    }
}

Dvcs.Repository.prototype.lookupRev = function(revId, shouldResolve) {
    var candidate = this.revisions[revId];
    if (!candidate && (shouldResolve != false)) {
	// shouldResolve is an optional parameter, hence the odd test in the line above
	candidate = this.revisions[this.branchTip(revId)];
    }
    return candidate
	|| { alive: {},
	     dead: {},
	     changed: [],
	     branch: null,
	     timestamp: 0,
	     metadata: null, 
	     directParent: null,
	     additionalParent: null };
}

Dvcs.Repository.prototype.getBody = function(revRecord, aliveInodeId) {
    var bodyId = revRecord.alive[aliveInodeId];
    if (!bodyId) return {};
    return Dvcs.Util.deepCopy(this.bodies[bodyId]);
}

Dvcs.Repository.prototype.update = function(unresolvedRevId) {
    var revId = this.resolveRevId(unresolvedRevId);
    var rev = this.revisions[revId];
    if (!rev) {
	if (unresolvedRevId == null) {
	    // meaning "default branch". We only get here if the user
	    // asked for the default branch and there are currently no
	    // commits at all in the repo. Hand back an empty
	    // checkout.
	    return new Dvcs.Checkout(null, null, null);
	} else {
	    // Couldn't find what the user asked for.
	    return null;
	}
    }

    var fs = new Dvcs.Checkout(revId, null, rev.branch);
    for (var inode in rev.alive) {
	fs.inodes[inode] = this.getBody(rev, inode);
    }
    return fs;
}

Dvcs.Repository.prototype.commit = function(fs, metadata) {
    var directParentRev = this.lookupRev(fs.directParent);
    var additionalParentRev = this.lookupRev(fs.additionalParent);

    var oldAlive = Dvcs.Util.dict_union(directParentRev.alive, additionalParentRev.alive);
    var oldDead = Dvcs.Util.dict_union(directParentRev.dead, additionalParentRev.dead);

    var newChanged = [];
    var newAlive = {};
    for (var inodeId in fs.inodes) {
	if (fs.dirty[inodeId]) {
	    var newBodyId = Dvcs.Util.random_uuid();
	    this.bodies[newBodyId] = Dvcs.Util.deepCopy(fs.inodes[inodeId]);
	    newAlive[inodeId] = newBodyId;
	    newChanged.push(inodeId);
	} else {
	    newAlive[inodeId] = oldAlive[inodeId];
	}
    }

    var newDead = Dvcs.Util.dict_to_set(Dvcs.Util.dict_union(oldDead,
							     Dvcs.Util.dict_difference(oldAlive,
										       newAlive)));

    var rev = { alive: newAlive,
		dead: newDead,
		changed: newChanged,
		branch: fs.getBranch(),
		timestamp: (new Date()).getTime(),
		metadata: metadata,
		directParent: fs.directParent,
		additionalParent: fs.additionalParent };

    var newRevId = Dvcs.Util.random_uuid();
    this.recordRevision(newRevId, rev);

    fs.directParent = newRevId;
    fs.additionalParent = null;
    fs.dirty = {};

    return newRevId;
}

Dvcs.Repository.prototype.lookupParents = function (revId) {
    var r = this.lookupRev(revId);
    var result = [];
    if (r.directParent) result.push(r.directParent);
    if (r.additionalParent) result.push(r.additionalParent);
    return result;
}

Dvcs.Repository.prototype.merge = function(r1, r2) {
    if (r1 == r2) {
	return this.update(r1);
    }

    var rev1 = this.lookupRev(r1);
    var rev2 = this.lookupRev(r2);

    var self = this;
    function lookupParents(revId) { return self.lookupParents(revId); }

    var ancestorRevId = Graph.least_common_ancestor(lookupParents, r1, r2);
    var ancestorRev = this.lookupRev(ancestorRevId, false);

    var fs = this.update(r1);
    fs.additionalParent = r2;

    var conflicts = [];

    for (var deadInode in rev2.dead) {
	fs.deleteFile(deadInode);
    }
    for (var aliveInode in rev2.alive) {
	if (fs.fileExists(aliveInode)) {
	    if (ancestorRev.alive[aliveInode] != rev1.alive[aliveInode] ||
		ancestorRev.alive[aliveInode] != rev2.alive[aliveInode])
	    {
		// It has a different body from the ancestor in one or
		// both of the revs being merged.
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
	    } else {
		// It is unchanged. Leave it alone.
	    }
	} else if (!rev1.dead[aliveInode]) {
	    fs.inodes[aliveInode] = this.getBody(rev2, aliveInode);
	    fs.dirty[aliveInode] = aliveInode;
	}
    }

    return {files: fs, conflicts: conflicts, ancestor: ancestorRevId};
}

Dvcs.Repository.prototype.lookupMerger = function(prop) {
    return Dvcs.Mergers.Defaults[prop] || Dvcs.Mergers.simpleScalarMerger;
}

Dvcs.Repository.prototype.mergeBodies = function(bThis, bBase, bOther, kSuccess, kConflict) {
    var props = Dvcs.Util.dict_union(bThis, bOther);
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

Dvcs.Repository.prototype.recordRevision = function(newRevId, rev) {
    var self = this;
    function addChild(parentId) {
	if (parentId == null) return;
	if (!self.children[parentId]) {
	    self.children[parentId] = [newRevId];
	} else {
	    self.children[parentId].push(newRevId);
	}
    }
    this.revisions[newRevId] = rev;
    addChild(rev.directParent);
    addChild(rev.additionalParent);
}

Dvcs.Repository.prototype.exportRevisions = function(revIds) {
    if (revIds) {
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

	return {revisions: revs, bodies: bodies};
    } else {
	// Shortcut for all revisions. Be warned: shares structure!
	return {revisions: this.revisions, bodies: this.bodies};
    }
}

Dvcs.Repository.prototype.importRevisions = function(e) {
    for (var bodyId in e.bodies) {
	this.bodies[bodyId] = e.bodies[bodyId];
    }
    for (var revId in e.revisions) {
	this.recordRevision(revId, e.revisions[revId]);
    }
}

Dvcs.Repository.prototype.allRevisions = function() {
    return Dvcs.Util.dict_to_set(this.revisions);
}

Dvcs.Repository.prototype.branchHeads = function(branch) {
    var result = [];
    for (var revId in this.revisions) {
	var rev = this.revisions[revId];
	if (rev.branch == branch) {
	    var hasChildrenWithinBranch = false;
	    var kids = this.children[revId] || [];
	    for (var i = 0; i < kids.length; i++) {
		if (this.revisions[kids[i]].branch == branch) {
		    hasChildrenWithinBranch = true;
		    break;
		}
	    }
	    if (!hasChildrenWithinBranch) {
		result.push(revId);
	    }
	}
    }
    return result;
}

Dvcs.Repository.prototype.branchTip = function(branch) {
    var newestHead = null;
    var newestRev = null;
    var branchHeads = this.branchHeads(branch);
    for (var i = 0; i < branchHeads.length; i++) {
	var id = branchHeads[i];
	var rev = this.lookupRev(id);
	if (newestHead == null || newestRev.timestamp < rev.timestamp) {
	    newestHead = id;
	    newestRev = rev;
	}
    }
    return newestHead;
}

Dvcs.Repository.prototype.allBranches = function() {
    var branches = {}
    for (var revId in this.revisions) {
	var rev = this.revisions[revId];
	var branch = rev.branch;
	var branchRecord = branches[branch];
	if (!branchRecord) {
	    branchRecord = { active: false, heads: [] };
	    branches[branch] = branchRecord;
	}

	var hasChildrenWithinBranch = false;
	var kids = this.children[revId] || [];
	for (var i = 0; i < kids.length; i++) {
	    if (this.revisions[kids[i]].branch == branch) {
		hasChildrenWithinBranch = true;
		break;
	    }
	}
	if (!hasChildrenWithinBranch) {
	    branchRecord.heads.push(revId);
	    if (kids.length == 0) {
		branchRecord.active = true;
	    }
	}
    }
    return branches;
}

Dvcs.Repository.prototype.childlessRevisions = function() {
    var result = [];
    for (var revId in this.revisions) {
	var kids = this.children[revId] || [];
	if (kids.length == 0) {
	    result.push(revId);
	}
    }
    return result;
}

Dvcs.Repository.prototype.fileRevisions = function(uuid) {
    var result = [];
    for (var revId in this.revisions) {
	var rev = this.revisions[revId];
	for (var i = rev.changed.length - 1; i >= 0; i--) {
	    if (uuid == rev.changed[i]) {
		result.push(rev);
		break;
	    }
	}
    }
    result.sort(function (r1, r2) { return r1.timestamp - r2.timestamp; });
    return result;
}
