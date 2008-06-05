function noisyLoad(filename) {
    print("Loading "+filename+"...");
    load(filename);
}

noisyLoad("json2.js");
noisyLoad("diff.js");
noisyLoad("graph.js");
noisyLoad("fs.js");
noisyLoad("draw.js");

Graph.Tests = {
    _add: function(g, id, parentIds, comment) {
	if (!g[id]) { g[id] = {childIds: []}; }
	g[id].id = id;
	g[id].parentIds = parentIds;
	g[id].comment = comment;
	for (var i = 0; i < parentIds.length; i++) {
	    var parentId = parentIds[i];
	    if (!g[parentId]) { g[parentId] = {childIds: []}; }
	    g[parentId].childIds.push(id);
	}
    },

    _lca: function(g, id1, id2) {
	return Graph.least_common_ancestor(function (id) { return g[id].parentIds; },
					   id1,
					   id2);
    },

    t1: function() {
	var g = {};
	Graph.Tests._add(g, 'a', []);
	Graph.Tests._add(g, 'b', ['a']);
	Graph.Tests._add(g, 'c', ['a']);
	Graph.Tests._add(g, 'd', ['b', 'c']);
	Graph.Tests._add(g, 'e', ['b', 'c']);
	print("** t1");
	print(Graph.Tests._lca(g, 'd', 'e'));
	print(Graph.Tests._lca(g, 'e', 'd'));
    },

    make_g: function () {
	var g = {};
	Graph.Tests._add(g, 'a', []);
	Graph.Tests._add(g, 'b', ['a']);
	Graph.Tests._add(g, 'c', ['b']);
	Graph.Tests._add(g, 'd', ['c', 'g']);
	Graph.Tests._add(g, 'e', ['d', 'h']);
	Graph.Tests._add(g, 'f', ['e']);
	Graph.Tests._add(g, 'g', ['b']);
	Graph.Tests._add(g, 'h', ['g']);
	Graph.Tests._add(g, 'i', ['c', 'h']);
	Graph.Tests._add(g, 'j', ['i']);
	return g;
    },

    t2: function () {
	var g = Graph.Tests.make_g();
	print("** t2");
	print(Graph.Tests._lca(g, 'f', 'j'));
	print(Graph.Tests._lca(g, 'j', 'f'));
    },

    t3: function () {
	var g = {};
	Graph.Tests._add(g, 'a', []);
	Graph.Tests._add(g, 'b', ['a']);
	Graph.Tests._add(g, 'c', []);
	Graph.Tests._add(g, 'd', ['c']);
	print("** t3");
	print(Graph.Tests._lca(g, 'b', 'd'));
    },

    tests: function () {
	Graph.Tests.t1();
	Graph.Tests.t2();
	Graph.Tests.t3();
    }
}


Dvcs.Tests = {
    pp: function(x) {
	return JSON.stringify(x, null, 2);
    },

    Rt1: function() {
	var pp = Dvcs.Tests.pp;

	var repo = new Dvcs.Repository();
	var fs = repo.update(null);

	function d(x) {
	    print(x);
	    print(pp({repo: repo,
		      fs: fs,
		      allBranches: repo.allBranches()}));
	    print(DrawDvcs.simpleRenderRepository(repo));
	    print();
	}

	var fileA = fs.createFile();
	d("start");

	fs.setProp(fileA, "name", "File A");
	fs.setProp(fileA, "text", "A B C D E".split(/ /));
	var rA = repo.commit(fs);
	d("post-rA");
	fs.setBranch("BBB");
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
	Dvcs.Tests.revisionC = rC;
	d("post-rC");

	var mergeResult = repo.merge(rC, rB2);
	print("--------------------");
	print(pp(mergeResult));
	print("--------------------");

	var rMerger = repo.commit(mergeResult.files);
	fs = repo.update(rMerger);
	d("post-rMerger");

	print("branch tip BBB: "+repo.branchTip("BBB"));
	print("branch tip NonExistent: "+repo.branchTip("NonExistent"));
	print();

	fs = repo.update("BBB");
	fs.deleteFile(fileA);
	var rB3 = repo.commit(fs);
	d("post-rB3");

	var rMerger2 = repo.commit(repo.merge(rB3, rMerger).files);
	fs = repo.update(rMerger2);
	d("post-rMerger2");

	print("---------------------------------------------------------------------------");
	Dvcs.Tests.exportedJson = pp(repo.exportRevisions());
	print(Dvcs.Tests.exportedJson);
	print("---------------------------------------------------------------------------");
    },

    Rt2: function() {
	var pp = Dvcs.Tests.pp;

	var repo = new Dvcs.Repository();
	repo.importRevisions(JSON.parse(Dvcs.Tests.exportedJson));

	var fs = repo.update(Dvcs.Tests.revisionC);
	print("================================================================= Rt2");
	print(pp({repo: repo,
		  fs: fs,
		  allBranches: repo.allBranches()}));
	print();

	print(DrawDvcs.simpleRenderRepository(repo));
    }
}

Graph.Tests.tests();
Dvcs.Tests.Rt1();
Dvcs.Tests.Rt2();
