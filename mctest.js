try {

function noisyLoad(filename) {
    print("Loading "+filename+"...");
    load(filename);
}

function assert(condition, explanation) {
    if (!condition) {
	throw {message: "Assertion failure", explanation: explanation};
    }
}

noisyLoad("json2.js");
noisyLoad("diff.js");
noisyLoad("graph.js");
noisyLoad("draw.js");
noisyLoad("sha1.js");
noisyLoad("mc.js");

Mc.Tests = {
    pp: function(x) {
        return JSON.stringify(x, null, 2);
    },

    Rt1: function() {
        var pp = Mc.Tests.pp;

        var repo = new Mc.Repository();
        var fs = new Mc.Checkout(repo);

        function d(x) {
            print(x);
            //repo.emptyCaches();
            //print(pp({fs: fs}));
            fs.forEachFile(function (fileName) {
                               print(fileName + ": " +
                                     fs.readFile(fileName).instance.text.join(" "));
                           });
            print();
        }

        d("start");

        fs.writeFile("File A", {"text": "A B C D E".split(/ /)});
        fs.writeFile("File B", {"text": ["One line"]});
        d("pre-rA");
        var rA = fs.commit({summary: "First commit"});
        d("post-rA");

        assert(fs.tag("BBB", false, true), "creating non-forced branch tag");

        fs.writeFile("File A", {"text": "G G G A B C D E".split(/ /)});
        var rB1 = fs.commit({summary: "Second commit"});
        d("post-rB1");

        fs.writeFile("File A", {"text": "A B C D E G G G A B C D E".split(/ /)});
        var rB2 = fs.commit({summary: "Third commit"});
        d("post-rB2");

        fs = new Mc.Checkout(repo, rA);
        assert(fs.tag("master", true, true), "forcing subsequent commits to be on 'master'");
        d("post-update-to-rA");

        fs.renameFile("File A", "File A, renamed");
        fs.writeFile("File A, renamed", {"text": "A B X D E".split(/ /)});
        Mc.Tests.revisionC = fs.commit({summary: "Fourth commit"});
        d("post-rC");

        fs.merge("BBB");
        d("post-merge");

        var rMerger = fs.commit({summary: "Merge BBB into master"});
        d("post-merge-commit");

        fs = new Mc.Checkout(repo, rMerger);
        d("post-rMerger");

        print("branch tip BBB: "+repo.resolve("BBB"));
        print("branch tip NonExistent: "+repo.resolve("NonExistent"));
        print();

        fs = new Mc.Checkout(repo, "BBB");
        fs.deleteFile("File A");
        var rB3 = fs.commit({summary: "Remove the unrenamed file A"});
        d("post-rB3");

        fs.merge("master");
        d("post-rMerger2");
        var rMerger2 = fs.commit({summary: "Merge master into BBB"});
        d("post-rMerger2-commit");

        print("---------------------------------------------------------------------------");
        Mc.Tests.exportedJson = pp(repo.exportRevisions());
        print(Mc.Tests.exportedJson);
        print("---------------------------------------------------------------------------");
    },

    Rt2: function() {
        var pp = Mc.Tests.pp;

        var repo = new Mc.Repository();
        var ed = JSON.parse(Mc.Tests.exportedJson);
        repo.importRevisions(ed);

        var fs = new Mc.Checkout(repo);
        fs.merge(ed.repoId + "/master");
        fs.commit({summary: "Fast-forward to remote's master"});
        print("================================================================= Rt2");
        print(pp({fs: fs}));
        print();

	var children = {};
	var branches = {};
	function recordChild(parentId, childId) {
	    if (parentId) {
		if (!(parentId in children)) children[parentId] = {};
		children[parentId][childId] = 1;
	    }
	}
	function recordBranch(blobId, branchName) {
	    if (!(blobId in branches)) branches[blobId] = {};
	    branches[blobId][branchName] = 1;
	}
	function traceBranch(branchName, blobId) {
	    if (blobId) {
		var entry = repo.blobs[Mc.Util.blobIdKey(blobId)];
		traceBranch(branchName, entry.directParent);
		traceBranch(branchName, entry.additionalParent);
		recordBranch(blobId, branchName);
		recordChild(entry.directParent, blobId);
		recordChild(entry.additionalParent, blobId);
	    }
	}
	var allBranches = repo.allBranches();
	for (var tag in allBranches) {
	    traceBranch(tag, allBranches[tag]);
	}

	var repoWrapper = {
	    childlessRevisions: function() {
		var result = {};
		var bs = allBranches;
		for (var tag in bs) {
		    result[bs[tag]] = 1;
		}
		return Mc.Util.dict_to_set_list(result);
	    },
	    lookupParents: function(blobId) {
		return repo.lookupParents(blobId);
	    },
	    lookupChildren: function(blobId) {
		return Mc.Util.dict_to_set_list(children[blobId]);
	    },
	    lookupRev: function(blobId) {
		return {
		    branch: Mc.Util.dict_to_set_list(branches[blobId]).join(","),
		    metadata: repo.lookup(blobId).metadata
		};
	    }
	};
	print(pp({children: children, branches: branches}));
	print(DrawDvcs.simpleRenderRepository(repoWrapper));
    }
};

Mc._debugMode = true;
Mc.Tests.Rt1();
Mc.Tests.Rt2();

} catch (e) {
    print(uneval(e));
    quit(1);
}
