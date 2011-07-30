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

var Graph = {
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

    topological_sort: function (graph) {
	var visited = {};
	var active = {};
	var result = [];

	function visit(node) {
	    if (node in active) {
		throw {message: "Topological sort: cycle detected",
		       node: node,
		       active: active};
	    }

	    if (node in visited) return;
	    visited[node] = true;

	    active[node] = true;
	    var targets = graph[node] || [];
	    for (var i = 0; i < targets.length; i++) {
		visit(targets[i]);
	    }
	    delete active[node];

	    result.unshift(node);
	}

	for (var node in graph) {
	    visit(node);
	}

	return result;
    }
};
