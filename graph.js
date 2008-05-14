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
    }
}
