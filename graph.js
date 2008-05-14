Graph = {
    _foreach: function(arr, f) {
	for (var i = 0; i < arr.length; i++) {
	    f(arr[i]);
	}
    },

    least_common_ancestor: function(parentsFun, leafId1, leafId2) {
	/* This is a pretty crude approximation. Since we're working
	with DAGs, rather than trees, it may not return the very very
	least common ancestor. */

	var potentialMatches = {};

	function augmentPotentialMatches(nodeId) {
	    if (!potentialMatches[nodeId]) {
		potentialMatches[nodeId] = nodeId;
		Graph._foreach(parentsFun(nodeId), augmentPotentialMatches);
	    }
	}

	augmentPotentialMatches(leafId2);

	var searchOrder = [leafId1];

	function queueForExamination(nodeId) {
	    searchOrder.push(nodeId);
	}

	while (searchOrder.length) {
	    var candidateId = searchOrder.shift();
	    if (potentialMatches[candidateId]) {
		return candidateId;
	    } else {
		Graph._foreach(parentsFun(candidateId), queueForExamination);
	    }
	}

	return null; // no LCA found.
    },

    Tests: {
	_add: function(g, id, parentIds) {
	    g[id] = {id: id, parentIds: parentIds};
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

	t2: function () {
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
};

Graph.Tests.tests();
