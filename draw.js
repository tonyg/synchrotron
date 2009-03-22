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

DrawDvcs = {
    renderRepository: function (repo) {
        var childCount = {};
        var ordering = [];
        var i, j, item, parent, column, row;

        var worklist = repo.childlessRevisions();
        while (worklist.length) {
            item = worklist.shift();
            ordering.push(item);

            var parents = repo.lookupParents(item);
            for (i = 0; i < parents.length; i++) {
                parent = parents[i];
                if (childCount[parent] == undefined) {
                    childCount[parent] = repo.lookupChildren(parent).length;
                }
                childCount[parent] = childCount[parent] - 1;
                if (childCount[parent] === 0) {
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
                    if (slots[j] === null) {
                        column = j;
                        break;
                    }
                }
                if (column === null) {
                    slots.push(item);
                    column = slots.length - 1;
                }
            }
            return column;
        }

        var finalAssignments = [];
        var cells = [];
        var oldrow = [];

        for (i = 0; i < ordering.length; i++) {
            item = ordering[i];
            var hasKid = typeof(assignments[item]) == 'number';
            column = allocateSlot(item);
            var parentIds = repo.lookupParents(item);
            var parentColumns = [];
            slots[column] = null;

            for (j = 0; j < parentIds.length; j++) {
                parent = parentIds[j];
                var c2 = (j === 0)
                    ? (typeof(assignments[parent]) == 'number'
                       ? allocateSlot(parent)
                       : column)
                    : allocateSlot(parent);
                parentColumns.push(c2);
                slots[c2] = parent;
                assignments[parent] = c2;
            }

            finalAssignments.push(column);

            row = [];
            for (j = 0; j < slots.length; j++) {
                var oldCell = (oldrow.length >= j ? oldrow[j] : 0);
                if (oldCell & 16) {
                    row[j] = (oldCell & 4) ? 1 : 0;
                } else {
                    row[j] = (oldCell & (1 | 4 | 8)) ? 1 : 0;
                }
            }
            row[column] = 16 | (hasKid ? 1 : 0);
            for (j = 0; j < parentColumns.length; j++) {
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
        for (i = 0; i < ordering.length; i++) {
            item = ordering[i];
            column = finalAssignments[i];

            row = cells[i];

            var result = {revId: item, pictures: []};
            for (j = 0; j < row.length; j++) {
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
            var rev = repo.lookupRev(item.revId);
            var pictures = item.pictures;
            for (var j = 0; j < pictures.length; j++) {
                html = html + "<img src='img/" + pictures[j] + "' />";
            }
            html = html+" "+item.revId+" ("+rev.branch+") "+(rev.metadata||{}).summary+"<br />\n";
        }
        return "<p style='line-height: 0px; white-space: nowrap;'>" + html + "</p>";
    }
};
