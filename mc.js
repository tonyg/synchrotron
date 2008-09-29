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
    _debugMode: false,

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
            if (Mc._debugMode) {
                return Mc.Util.random_hex_string(8);
            } else {
                return [Mc.Util.random_hex_string(8),
                        Mc.Util.random_hex_string(4),
                        "4" + Mc.Util.random_hex_string(3),
                        ((Math.floor(Math.random() * 256) & ~64) | 128).toString(16) +
                        Mc.Util.random_hex_string(2),
                        Mc.Util.random_hex_string(12)].join("-");
            }
        },

        dict_union: function(s1, s2) {
            var result = {};
            var k;
            for (k in s2) { result[k] = s2[k]; }
            for (k in s1) { result[k] = s1[k]; }
            return result;
        },

        dict_difference: function(s1, s2) {
            var result = {};
            var k;
            for (k in s1) { result[k] = s1[k]; }
            for (k in s2) { delete result[k]; }
            return result;
        },

        dict_to_set: function(d) {
	    var result = {};
            for (var k in d) { result[k] = 1; }
            return result;
        },

        deepCopy: function(obj) {
            // Courtesy of
            // http://keithdevens.com/weblog/archive/2007/Jun/07/javascript.clone
            //
            // Does not handle recursive structures.

            if (obj === null || typeof(obj) != 'object') {
                return obj;
            }

            var temp = obj.constructor();
            for (var key in obj) {
                temp[key] = Mc.Util.deepCopy(obj[key]);
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

	Directory: {}
    },

    make_versionable: function(blob, id, mergerName, directParent, additionalParent) {
	blob.mc_version_data = {
	    id: id,
	    mergerName: mergerName,
	    directParent: directParent,
	    additionalParent: additionalParent
	};
    },

    Index: function(repo) {
	this.alive = {};
	this.dead = {};
	this.repo = repo;
    },

    Repository: function() {
	this.blobs = {};
	this.tags = {};
    }
};

Mc.Index.prototype.insert = function(uuid) {
    delete this.dead[uuid];
    this.alive[uuid] = 1;
};

Mc.Index.prototype.remove = function(uuid) {
    if (!this.alive[uuid]) return false;
    delete this.alive[uuid];
    this.dead[uuid] = 1;
    return true;
};

Mc.Index.prototype.exists = function(uuid) {
    return !!(this.alive[uuid]);
};

Mc.Index.prototype.forEachBlob = function(f) {
    for (var uuid in this.alive) {
	f(uuid);
    }
};

Mc.Repository.prototype.lookup = function(blobIdOrTag, shouldResolve) {
    var candidate = this.blobs[blobIdOrTag];
    if (!candidate && (shouldResolve !== false)) {
        // shouldResolve is an optional parameter, hence the odd test in the line above
        candidate = this.blobs[this.tags[blobIdOrTag]];
    }
    return candidate || null;
};

Mc.Repository.prototype.store = function(blob, mergerName, directParent, additionalParent) {
    var blobId = Mc.Util.random_uuid();
    if (Mc._debugMode) { newBodyId = "blob-" + blobId; }
    Mc.make_versionable(blob, blobId, mergerName, directParent, additionalParent);
    this.blobs[blobId] = blob;
};

Mc.Repository.prototype.lookupParents = function (blobId) {
    var b = this.lookup(blobId);
    var result = [];
    if (b.mc_version_data) {
	b = b.mc_version_data;
	if (b.directParent) result.push(b.directParent);
	if (b.additionalParent) result.push(b.additionalParent);
    }
    return result;
};

Mc.Repository.prototype.canMerge = function(b1, b2) {
    var $elf = this;
    function lookupParents(blobId) { return $elf.lookupParents(blobId); }
    var ancestorBlobId = Graph.least_common_ancestor(lookupParents, b1, b2);
    return !(b1 == ancestorBlobId || b2 == ancestorBlobId);
}

Mc.Repository.prototype.merge = function(b1, b2) {
    var blob1 = this.lookup(b1);
    var blob2 = this.lookup(b2);

    var $elf = this;
    function lookupParents(blobId) { return $elf.lookupParents(blobId); }

    var ancestorBlobId = Graph.least_common_ancestor(lookupParents, b1, b2);
    var ancestorBlob = this.lookup(ancestorBlobId, false);

    if (b1 == ancestorBlobId || b2 == ancestorBlobId) {
	return null;
    }

    var fs = this.update(b1);
    fs.additionalParent = b2;
    fs.anyDirty = true;

    var conflicts = [];

    for (var deadInode in blob2.dead) {
        fs.deleteFile(deadInode);
    }
    for (var aliveInode in blob2.alive) {
        if (fs.fileExists(aliveInode)) {
            if (ancestorBlob.alive[aliveInode] != blob1.alive[aliveInode] ||
                ancestorBlob.alive[aliveInode] != blob2.alive[aliveInode])
            {
                // It has a different body from the ancestor in one or
                // both of the revs being merged.
                var body0 = this.getBody(ancestorBlob, aliveInode);
                var body1 = fs.inodes[aliveInode];
                var body2 = this.getBody(blob2, aliveInode);
                this.mergeBodies(body1, body0, body2,
                                 function (mergedBody) {
                                     fs.inodes[aliveInode] = mergedBody;
				     fs.setDirty(aliveInode);
                                 },
                                 function (partialResult, conflictDetails) {
                                     conflicts.push({inode: aliveInode,
                                                     partialResult: partialResult,
                                                     conflictDetails: conflictDetails});
                                 });
            } else {
                // It is unchanged. Leave it alone.
            }
        } else if (!blob1.dead[aliveInode]) {
            fs.inodes[aliveInode] = this.getBody(blob2, aliveInode);
	    fs.setDirty(aliveInode);
        }
    }

    return {files: fs, conflicts: conflicts, ancestor: ancestorBlobId};
};

Mc.Repository.prototype.lookupMerger = function(prop) {
    return Mc.Mergers.BasicDefaults[prop] || Mc.Mergers.simpleScalarMerger;
};

Mc.Repository.prototype.mergeBodies = function(bThis, bBase, bOther, kSuccess, kConflict) {
    var props = Mc.Util.dict_union(bThis, bOther);
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
};

Mc.Repository.prototype.recordRevision = function(newRevId, rev) {
    var $elf = this;
    function addChild(parentId) {
        if (parentId === null) return;
        if (!$elf.children[parentId]) {
            $elf.children[parentId] = [newRevId];
        } else {
            $elf.children[parentId].push(newRevId);
        }
    }
    this.revisions[newRevId] = rev;
    addChild(rev.directParent);
    addChild(rev.additionalParent);
};

Mc.Repository.prototype.exportRevisions = function(blobIds) {
    if (blobIds) {
        var revs = {};
        for (var i = 0; i < blobIds; i++) {
            var rev = this.revisions[blobIds[i]];
            if (rev) revs[blobIds[i]] = rev;
        }

        var bodies = {};
        for (var blobId in revs) {
            var alive = revs[blobId].alive;
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
};

Mc.Repository.prototype.importRevisions = function(e) {
    var stats = {
	bodyCount: 0,
	bodyDups: 0,
	revCount: 0,
	revDups: 0
    };
    for (var bodyId in e.bodies) {
	if (!this.bodies[bodyId]) {
            this.bodies[bodyId] = e.bodies[bodyId];
	    stats.bodyCount++;
	} else {
	    stats.bodyDups++;
	}
    }
    for (var blobId in e.revisions) {
	if (!this.revisions[blobId]) {
            this.recordRevision(blobId, e.revisions[blobId]);
	    stats.revCount++;
	} else {
	    stats.revDups++;
	}
    }
    return stats;
};

Mc.Repository.prototype.allRevisions = function() {
    return Mc.Util.dict_to_set(this.revisions);
};

Mc.Repository.prototype.branchHeads = function(branch) {
    var result = [];
    for (var blobId in this.revisions) {
        var rev = this.revisions[blobId];
        if (rev.branch == branch) {
            var hasChildrenWithinBranch = false;
            var kids = this.children[blobId] || [];
            for (var i = 0; i < kids.length; i++) {
                if (this.revisions[kids[i]].branch == branch) {
                    hasChildrenWithinBranch = true;
                    break;
                }
            }
            if (!hasChildrenWithinBranch) {
                result.push(blobId);
            }
        }
    }
    return result;
};

Mc.Repository.prototype.branchTip = function(branch) {
    var newestHead = null;
    var newestRev = null;
    var branchHeads = this.branchHeads(branch);
    for (var i = 0; i < branchHeads.length; i++) {
        var id = branchHeads[i];
        var rev = this.lookup(id);
        if (newestHead === null || newestRev.timestamp < rev.timestamp) {
            newestHead = id;
            newestRev = rev;
        }
    }
    return newestHead;
};

Mc.Repository.prototype.allBranches = function() {
    var branches = {};
    for (var blobId in this.revisions) {
        var rev = this.revisions[blobId];
        var branch = rev.branch;
        var branchRecord = branches[branch];
        if (!branchRecord) {
            branchRecord = { active: false, heads: [] };
            branches[branch] = branchRecord;
        }

        var hasChildrenWithinBranch = false;
        var kids = this.children[blobId] || [];
        for (var i = 0; i < kids.length; i++) {
            if (this.revisions[kids[i]].branch == branch) {
                hasChildrenWithinBranch = true;
                break;
            }
        }
        if (!hasChildrenWithinBranch) {
            branchRecord.heads.push(blobId);
            if (kids.length === 0) {
                branchRecord.active = true;
            }
        }
    }
    return branches;
};

Mc.Repository.prototype.childlessRevisions = function() {
    var result = [];
    for (var blobId in this.revisions) {
        var kids = this.children[blobId] || [];
        if (kids.length === 0) {
            result.push(blobId);
        }
    }
    var revs = this.revisions;
    result.sort(function (b1, b2) { return revs[b2].timestamp - revs[b1].timestamp; });
    return result;
};

Mc.Repository.prototype.fileRevisions = function(uuid) {
    var result = {};
    for (var blobId in this.revisions) {
        var rev = this.revisions[blobId];
        for (var i = rev.changed.length - 1; i >= 0; i--) {
            if (uuid == rev.changed[i]) {
                result[blobId] = rev;
                break;
            }
        }
    }
    return result;
};
