try {

    function noisyLoad(filename) {
	print("Loading "+filename+"...");
	load(filename);
    }

    /* NOTE: condition should return null for success */
    function assert(condition, explanation) {
	if (condition !== null) {
	    throw {message: "Assertion failure",
		   explanation: explanation,
		   witness: condition};
	}
    }

    function assertExn(messageRe, explanation, thunk) {
	try {
	    thunk();
	} catch (e) {
	    if (!e.message || !messageRe(e.message)) {
		throw {message: "Expected matching exception",
		       messageRe: messageRe,
		       exception: e,
		       explanation: explanation};
	    }
	    return;
	}
	throw {message: "Expected exception",
	       messageRe: messageRe,
	       explanation: explanation};
    }

    noisyLoad("json2.js");
    noisyLoad("graph.js");

    function g(spec) {
	var graph = {};
	var nodes = spec.split(';');
	for (var i = 0; i < nodes.length; i++) {
	    var headTails = nodes[i].split(':');
	    graph[headTails[0]] = headTails[1].split(',');
	}
	return graph;
    }

    assertExn(/cycle detected/, "Short cycle",
	      function () { Graph.topological_sort(g("a:a")); });
    assertExn(/cycle detected/, "Longer cycle",
	      function () { Graph.topological_sort(g("c:d;a:b,d;d:a;b:c;e:d")); });
    assertExn(/cycle detected/, "Loop and no loop",
	      function () { Graph.topological_sort(g("a:b;b:c;c:d;e:f;f:g;g:e")); });

    function sortValid(graph) {
	var s = Graph.topological_sort(graph);
	for (var source in graph) {
	    var sourcePos = s.indexOf(source);
	    if (sourcePos == -1) {
		return {missing_source: source, graph: graph};
	    }

	    var sinks = graph[source];
	    for (var i = 0; i < sinks.length; i++) {
		var sink = sinks[i];
		var sinkPos = s.indexOf(sink);
		if (sinkPos == -1) {
		    return {missing_sink: sink, source: source, graph: graph};
		}
		if (sourcePos >= sinkPos) {
		    return {out_of_order: [source, sink], ordering: s, graph: graph};
		}
	    }
	}
	return null;
    }

    assert(sortValid(g("a:b;b:c;c:d;e:f;f:g;g:h")));
    assert(sortValid(g("c:d;a:b,d;b:c;e:d")));

    assert(Graph.topological_sort({}).length == 0 ? null : "That's strange");

} catch (e) {
    print(JSON.stringify(e));
    quit(1);
}
