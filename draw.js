DrawDvcs = {
    renderRepository: function (repo) {
	var worklist = [];
	var branches = repo.allBranches();
	for (var branchName in branches) {
	    if (branches[branchName].active) {
		worklist = worklist.concat(branches[branchName].heads);
	    }
	}

	var childCount = {};
	var ordering = [];

	while (worklist.length) {
	    var item = worklist.shift();
	    ordering.push(item);

	    var parents = repo.lookupParents(item);
	    for (var i = 0; i < parents.length; i++) {
		var parent = parents[i];
		if (childCount[parent] == undefined) {
		    childCount[parent] = (repo.children[parent] || []).length;
		}
		childCount[parent] = childCount[parent] - 1;
		if (childCount[parent] == 0) {
		    worklist.push(parent);
		}
	    }
	}

	var slots = [];
	var assignments = {};

	function allocateSlot(item) {
	    var column = assignments[item];
	    if (typeof(column) != 'number') {
		column = null;
		for (var j = 0; j < slots.length; j++) {
		    if (slots[j] == null) {
			column = j;
			break;
		    }
		}
		if (column == null) {
		    slots.push(item);
		    column = slots.length - 1;
		}
	    }
	    return column;
	}

	var finalAssignments = [];
	var cells = [];
	var oldrow = [];

	for (var i = 0; i < ordering.length; i++) {
	    var item = ordering[i];
	    var hasKid = typeof(assignments[item]) == 'number';
	    var column = allocateSlot(item);
	    var parentIds = repo.lookupParents(item);
	    var parentColumns = [];
	    slots[column] = null;

	    for (var j = 0; j < parentIds.length; j++) {
		var parent = parentIds[j];
		var c2 = (j == 0)
		    ? (typeof(assignments[parent]) == 'number'
		       ? allocateSlot(parent)
		       : column)
		    : allocateSlot(parent);
		parentColumns.push(c2);
		slots[c2] = parent;
		assignments[parent] = c2;
	    }

	    finalAssignments.push(column);

	    var row = [];
	    for (var j = 0; j < slots.length; j++) {
		var oldCell = (oldrow.length >= j ? oldrow[j] : 0);
		if (oldCell & 16) {
		    row[j] = (oldCell & 4) ? 1 : 0;
		} else {
		    row[j] = (oldCell & (1 | 4 | 8)) ? 1 : 0;
		}
	    }
	    row[column] = 16 | (hasKid ? 1 : 0);
	    for (var j = 0; j < parentColumns.length; j++) {
		var parentColumn = parentColumns[j];
		var n1 = Math.min(parentColumn, column) + 1;
		var n2 = Math.max(parentColumn, column);
		for (var k = n1; k < n2; k++) {
		    row[k] = row[k] | 2;
		}
		if (parentColumn == column) {
		    row[parentColumn] = row[parentColumn] | 4;
		} else {
		    row[parentColumn] = row[parentColumn] | (column > parentColumn ? 8 : 4);
		    row[column] = row[column] | (column > parentColumn ? 2 : 8);
		}
	    }
	    cells.push(row);
	    oldrow = row;
	}

	var results = [];
	for (var i = 0; i < ordering.length; i++) {
	    var item = ordering[i];
	    var column = finalAssignments[i];

	    var row = cells[i];

	    var result = {revId: item, pictures: []};
	    for (var j = 0; j < row.length; j++) {
		var v = row[j];
		result.pictures.push((v & 16 ? "blob_" : "stick_") + (v & 15) + ".png");
	    }
	    results.push(result);
	}

	return results;
    },

    simpleRenderRepository: function (repo) {
	var ordering = DrawDvcs.renderRepository(repo);
	var html = "";
	for (var i = 0; i < ordering.length; i++) {
	    var item = ordering[i];
	    var pictures = item.pictures;
	    for (var j = 0; j < pictures.length; j++) {
		html = html + "<img src='img/" + pictures[j] + "' />";
	    }
	    html = html + " " + item.revId + "<br />\n";
	}
	return "<p style='line-height: 0px; white-space: nowrap;'>" + html + "</p>";
    }
}
