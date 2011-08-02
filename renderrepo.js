// Copyright (c) 2008-2011 Tony Garnock-Jones <tonygarnockjones@gmail.com>
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

function wrapRepo(repo) {
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
	    var entry = repo.lookup(blobId);
	    for (var i = 0; i < entry.parents.length; i++) {
		traceBranch(branchName, entry.parents[i]);
	    }
	    recordBranch(blobId, branchName);
	    for (var i = 0; i < entry.parents.length; i++) {
		recordChild(entry.parents[i], blobId);
	    }
	}
    }
    var allBranches = repo.allBranches();
    for (var tag in allBranches) {
	traceBranch(repo.prettyTag(tag), allBranches[tag]);
    }

    var repoWrapper = {
	childlessRevisions: function() {
	    var result = {};
	    var bs = allBranches;
	    for (var tag in bs) {
		if (!children[bs[tag]]) {
		    result[bs[tag]] = 1;
		}
	    }
	    return Mc.Util.dict_to_set_list(result);
	},
	lookupParents: function(blobId) {
	    return repo.lookup(blobId).parents;
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

    return repoWrapper;
}

function renderRepository(repo) {
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
}

function simpleRenderRepository(repo) {
    var ordering = renderRepository(repo);
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

var images = {
  "blob_0.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAIdJREFUOI3tkjEKwzAMRV+6CnwmjTpFl1yshwnkLp5TNP4u9tJ2cWsohTzQIqEnGwlO/ooFuAIbcG+xtdzyiewGyMzk7nJ3mZkAtdqQdAUUEcpMdTJTEdGl64hwL6Wo1qpnaq0qpQjYR4RHRLzIOu2Vx7vGy8iUb5j+5elLmX42XTrtsE9+yANzZprVJVS76gAAAABJRU5ErkJggg=="
  ,"blob_1.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJZJREFUOI3tkjEOAjEMBPdoLflNLv0KmvsYjznpep7h+lAqtDROAwiSUwQFjLRNooxieYE2zpm3HBqFzfyg8BUTgCOABcA1s+TZtEd2AkARoZnRzCgiBMC865LOAOjuLKWwUkqhu1fp3CNcVZURwXsigqpKAGuPcHP3B1klf7k9e/ixLQ8fefhShtemSmuxL5ndxf7zRW4Gj5yRa/KFewAAAABJRU5ErkJggg=="
  ,"blob_10.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAKVJREFUOI3tkrEJwzAQRZ/AnUCQQoOkSaFKpaZI48UyhgcwuMkk6oPKn0ZuEhliYzABP7jmjv/gpIOTv8IAd2AEXrXG2jNbZA9A1lrFGBVjlLVWgOpslbQHlFJSKUUzpRSllGZpv0Y4OeeUc9YnOWc55wRMrWAHPBv9awgB7/3XwHtPCIFhGG6tbAdcGsJf3scsZJtsXnmJ3T9l97OZpbsd9smBvAHQ9YOCh41JCAAAAABJRU5ErkJggg=="
  ,"blob_11.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAALVJREFUOI3tkjEKAjEQRd/KdoGARQ5iY5EqZU5hsxfzGDnAwjZWHiO9pJKxSRrNanZZsNAHv5lhHmQy0MY15yO7RmEzPyh8RwecgBG454y51q2RnQFRSolzTpxzopQSQHJvkXQAxHsvKSUppJTEe1+kwxLhpLWWGKM8E2MUrbUAU22wBy6V+sFaizHmpWGMwVpLCOFYm+2BfUXYsp9uZrbK6ifPsfmnbH42RVoO+5az+rD/fJEHZB6FPnyuglsAAAAASUVORK5CYII="
  ,"blob_12.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJxJREFUOI3tkjEKAyEUBceQThByI8t/ijR7sRxmYZtUewzrBKvlpdHGFIkbm8AOvEZlvuKDg7/CAVdgBp4lc1lze2Q3QN57xRgVY5T3XoDKXpd0AmRmyjmrknOWmVXp1CNcQghKKaklpaQQgoClR/gwszdZpdxyA+5tzj1TGhxw+fbw8CcP/5ThtanSWuytZHexW9aSj5x+nXQIeQEBLaCqFSFpfQAAAABJRU5ErkJggg=="
  ,"blob_13.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJ5JREFUOI3tlDEKAyEQRZ8hnSDkRpZzijR7sRxmYZtUOYZ1wGr5abQxkGiQNMmD3zjyVGYQ+riVvOXQKezmB4WvcMAZWIG9ZC1r7hPZBZD3XjFGxRjlvRegUhuSLoDMTDlnVXLOMrMqXUaEWwhBKSW1pJQUQhCwjQjvZvYkq5Rb7sC1zXHklAYHnHo3T3/y9KZMH5sqnTbYLf/v64vCB5RHomZlltYsAAAAAElFTkSuQmCC"
  ,"blob_14.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAALJJREFUOI3tkjEOwiAUhr+abiQkDhzExYGJkVO49GIegwM06eLkMdgNk3kusFQaLXYx6Ze85b38HwEe7PwVHXABRuCRa8y9rkV2BUQpJc45cc6JUkoAybNV0gEQ772klKSQUhLvfZEOa4ST1lpijDInxihaawGmWrAHbpX+yVqLMeZtYIzBWksI4VzL9sCxIvzmfbqFbJXmKy+x+adsvjZFWhb7mat5sefcc33k8OtJu5AXRsKFPuF7sfwAAAAASUVORK5CYII="
  ,"blob_15.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAALVJREFUOI3tlLENwyAQRR+ROySkFAySJgUVJVOk8WIZwwNYcpMqY7AAVXRpoHFwgi0rTfKka+70nwScgDbuuT5yaBQ284PCdyjgAozAI9eYe2qL7AqI1lq89+K9F621AJJnq6Q9ICEESSlJIaUkIYQi7dcIJ2OMxBhlToxRjDECTLVgB9wq/ZNzDmvty8Bai3OOYRjOtWwHHCvClvtRC9kqm4+8xO6PsvvaFOluiz3n/319UfgE2dyG+rvKV2wAAAAASUVORK5CYII="
  ,"blob_2.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJNJREFUOI3tkjEKAjEQRd+CXSDgjaacU9jsxTzMwjaeJPVKKvk2SaMRiQZE2Ae/mZBHZjKw81dMwAlYgGvJUmrTJ7IzoBCCzExmphCCAJWzLukMyN2Vc1Yl5yx3r9K5R7jGGJVS0iMpJcUYBayvLl8aubn7k6xSXrm1ZAfg2Kh3D/0dX7XcYvinDF+bKh222Ds/5A5/457uDkGvZQAAAABJRU5ErkJggg=="
  ,"blob_3.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAKNJREFUOI3tkr0KwjAYRU/FLRDwjTJ+T+HSF/NhCl2cfIzMSqZyXZJFo01rwUEP3OULOeTnQhuXnFl2jcJmflD4jg44AgMw5Qx51q2RnQA55xRCUAhBzjkBymuLpD0gM1NKSYWUksysSPslwtF7rxijHokxynsvYHy1+VzJZGZPskI+5bUm2wOHynzxo8/x0ZVrbP4pm9emSEuxbzmri/3ni9wBEwygqo8e4tAAAAAASUVORK5CYII="
  ,"blob_4.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJVJREFUOI3tkjEKwzAMRX+6CnQmjTpFl1yshwlk7zE0p2gqv4u8pIXi1EtpH/zFxs82+sCfr2ICcAawALhVllqbjsguACgiNDOaGUWEAFh7XdIZAN2dmclGZtLdm3TuEa6qyojgnoigqhLA2iPc3P1J1qhXbq8Onnpu+YThXx4+lOG1adJW7HvlcLH3XCtvGT7lHxQ+AOkknJHNxLgkAAAAAElFTkSuQmCC"
  ,"blob_5.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJZJREFUOI3tlDEKwzAMRX+6CnQmjTpFl1yshwlk7zE0BzSV38Ve0tLaxWRpHmix8MPiCwNt3Et95dIobOYPhZ+YAFwBLAAepZZyNv0iuwGgiNDMaGYUEQJg6XVJZwB0d2YmK5lJd6/SuUe4qiojgnsigqpKAGuPcHP3F1mlvHJ7d/GwlIePPDyU4WtTpcMWe8/5fR0ofAJ8TZ5N0sDKDwAAAABJRU5ErkJggg=="
  ,"blob_6.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJ9JREFUOI3tkrEKwyAURU9KN0HoHzm+r+iSH+vHBLJ0ymc4tziF20WX1BJMshRy4C5PPD71wclf0QF3YADeOUOudVtkD0DOOYUQFEKQc06A8lqTtAdkZkopqZBSkpkVad8iHL33ijFqSYxR3nsB46/Nz0pmM/uSFXKXr5rsCtwq9eZHX2PXlWsc/imHj02RlsGeczYP9pIpZ5XL3pNOIR/1oaCqrqJp9wAAAABJRU5ErkJggg=="
  ,"blob_7.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAKNJREFUOI3tlLEKwjAURU/FLRDwjzK+r3Dpj/kxhS5O/YzMQqZyXZKlRttocdEDd3khh7zkEdjGlLPKYaNwMz8ofEUHnIEBmHOGXOvekV0AOecUQlAIQc45AcprTdIekJkppaRCSklmVqR9i3D03ivGqCUxRnnvBYzPNl8rmc3sQVbIp7zVZEfgVKk3X/oaH7VcY/dH2X1sinS3wV7y/76+KLwDiMqiZru+wK0AAAAASUVORK5CYII="
  ,"blob_8.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJBJREFUOI3tkjEKAjEQRV/ALjDgjaacU9jsxTzMwjaeJLWSSr5N0qyNkYAI++A3yfAyYQYO/ooEXIAVeLSs7Sx9I7sCyjnL3eXuyjkLULsbki6AIkK1VnVqrYqILl1GhJuZqZSiPaUUmZmAbUR4j4g3Wad1+QRu+5xGXtmRgPOnxdO/PH0o09emS6ct9sEPeQGLYJ7ucs6fnQAAAABJRU5ErkJggg=="
  ,"blob_9.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJ9JREFUOI3tkjEKAyEUBceQThByI8t/ijR7sRxmYZtUOYZ1gtXy0mizgUQXIUUy8BqV8YsP2riVfOTQKGzmB4XvcMAZmIG1ZC5rbo/sAsh7rxijYozy3gtQ2euSToDMTDlnVXLOMrMqnXqESwhBKSVtSSkphCBg6RHezexFVilTrsB1m2PPLRsccGo9PPzJwz9leG2qtBb7UbK72H++yBMeiaCqdfixnAAAAABJRU5ErkJggg=="
  ,"slide_l.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAADFJREFUOI1jYBgFo2AYAkYqmsXMwMAQSE3DVjEwMPyntmGrqG0Y86hho4YhQBixhgEAQRwWyV5wCkoAAAAASUVORK5CYII="
  ,"slide_m.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAE9JREFUOI3t0zEKgDAMBdAHvaJ6yF5SByuIgxUasEP+FggPQhLeU1CxY+30dnPHaqsTS6wlFBOIFSycHxCBXZMO57mDUGye60jsZwy2r9gB/Z0tlT2EWtcAAAAASUVORK5CYII="
  ,"slide_r.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAADpJREFUOI3t06ENACAMRcFLmJElWRIEFSgwVaTP/aQ5V+41DEz0x+2zExuxCyssSsVkY+wPSMOq6ssWvM8WywislYYAAAAASUVORK5CYII="
  ,"stick_0.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAABVJREFUOI1jYBgFo2AUjIJRMAqoAwAGVAAB8lwiXwAAAABJRU5ErkJggg=="
  ,"stick_1.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAACNJREFUOI1jYCAOXIJigoCJSAOJBqMGjho4auCogaMGDhUDAZwOAcsorz0zAAAAAElFTkSuQmCC"
  ,"stick_10.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJVJREFUOI3t07sJAlEQRuHPt2IgC4Z2YGIJlmBPYgOmYgkbiLGhmX2YrqkgGuw1MViXe41kTzIMDId/BoaGhj+khUuiY4QJxuh1kSWIMgxD/8QjRjTALggKbLCIDKWPU5AdMY0VvdkH2RbtVNkyyA7opMrgjJsfrAlzZbr1t8G6d1iFmscm+iTHXfkIldRNOMNVuXYlL+XfFT2H2O6WAAAAAElFTkSuQmCC"
  ,"stick_11.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAALVJREFUOI3t0ztuAkEMgOEvYQkQChQpp6DikrkALcohUOrcgIqCjj5FilDQ8UixlngosN5su780Gllj/bLHMjmWcSp5TArTtMJW+A8esEjkjeNe/fE2wAhDdAu8JISduM9zBxH3Iz5in3DhcvV6mIXgB2+YZEXXwid8huwDr3VF18L3kE01HOgS65DNnf60kXCLjYo2s2X38axs9btRacGXst3a07zFBgflItwl23KBnbLKu/wCR20gpGTSl3wAAAAASUVORK5CYII="
  ,"stick_12.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAANNJREFUOI3t07FKA0EQgOHvoijaxuBDaCEEe5uUwUeyEDurtEHfwECQlNopCKnsrUJqFcFCQs7i5sgVeuxhJ/nLnZl/d2ZY1qz5h2SYYo5nTPCEvIHjAKc4xj684DMkeYj7CaITPFbqvjArgy10cYmPSLjGzg+ibQwj5w0XOKq7uYObKLjHbiW2hbuI3WIvoRMUsx1UXlpyFWeD6KoRGUYh6ClmlmOMjaaykjZeFcN/wLsGbf7GmdUmz/8qg8OKsHabqbSwwFIx11o2E4TLEGYSftA3PXkxeOJzoewAAAAASUVORK5CYII="
  ,"stick_13.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAANtJREFUOI3t07FKA0EQBuDvTlG0VfEhtAgEe19AfCQLsbNKK/oGCiIpYykEUtlrI9YqooVFziJzuEg896JlftjmduZj9+aOvNzG+jVlJpidOTgHZ8giRng0+XD7GKJqYWxhHzvYhDu8B1IFvPetadqfsoubpO8DD/VmiS6O8RoFZ1iZAi7jJGqecYRO0xU2cB4N11hNwCUMYu8K601QmgK95KQ1eBrPemYYaIGLAO5N3nWFSyy0xeqs4QlvsV60uOZPOfA1ycO/YrCdgI3TzE2JcYDFf4ACHOcUfgK/fDpV7BBCtAAAAABJRU5ErkJggg=="
  ,"stick_14.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAM1JREFUOI3t0rFKA0EQgOFvY2KMFiKat7AQ8gI2PpeF2FmlFX0DA2Jtuvg4apAYCHpnkbl4CDnvsJP81c7O7r8z7LBhwz8kYYYF5phG3IQe9rGHTgpZO+QifsZ7DdEBdiLO8VkkWxjgCm+RvI1LP+niOs684hInVS/3cRcXxtgt5bbxGLkHHP3SxYqEYanSgpvYG0ZXjUgYheAMp7G+x1ZTWcEhXvCEieUU1G5zHedRWY6Lv8rguCSs/M26tPCBzPesrqVdQ5iFMFlWWckXLE8s0STxUmsAAAAASUVORK5CYII="
  ,"stick_15.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAOFJREFUOI3t071KA0EQwPHfnt9aiKidTyApBB/QQuys0oq+gYJY60NYpItVaj+QKAgmFpmTNcTcGtv8Ydmdm50/c8wdZdzHaqQqFBYzF86FM5DQxwfe8RLxOPuxdybk1rCJDSylkC2GXMSPeMuK9mLvjYm2sBrxEJ91ssIhTvEayYso4uevt4KzuPOMExxM6PybXVxGwR3WM+EybiN3g51popyEdtZpLTyPZ20zDDThKgQP6Mb5Ggt/ldVs48lo8n2jr6D4NX/jKDob4vi/MmhlwqnTLKXCIISp4W4xg1iNfAH/IDYHUEEa4gAAAABJRU5ErkJggg=="
  ,"stick_2.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAACRJREFUOI1jYBgFo2AYAkYGBoYz1DSQhYGBQZCaBo6CUTAsAQAO/gDjGameSwAAAABJRU5ErkJggg=="
  ,"stick_3.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAD9JREFUOI1jYCAOXIJigoCJSAOJBqMGjhpIBmBkYGA4Q4Q6LSh9jZBCFgYGBkEiDGSG0sSoJQqMZr1RA4eUgQCBQAVfOGtUugAAAABJRU5ErkJggg=="
  ,"stick_4.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJBJREFUOI3tzjEOAUEYBeBvV0UrEncQlTOoROJGLqByADdYjV6pUumVEp1C0KEwiUZiYqaSfcmfaV6+edSp84dpYIsRerjhkIruccUj3A7jVLTEADOcA7xAMxWGDqqArtHKgRaYey/NkgLLgA5zoW2csMkFwtRrZT+mXEZ0qvBOfl306dMLVrHlb7njiG4M+ATgfRo0TB7IrwAAAABJRU5ErkJggg=="
  ,"stick_5.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAKJJREFUOI3t0zEKwjAYgNFncVBX8RZunsObOYgH8Aa6uboLTu66CS4iKDqpdWgKxaWh7dgPsoVHEvIT1yGs0pJIMLoWbMEKdbHHWfZxN9ghrYMe8QpIGuDp357oSclLMMEMjwAv0a8KFhthFdAtBnVB6GBROGltMEfXAT01AcIQNzxjwbJ/eMVc9o69WkcrNJZd+9IUmOCDe+zmsr54y6aqtB8W9CgIIj5T8QAAAABJRU5ErkJggg=="
  ,"stick_6.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAI9JREFUOI3tzjEOAVEUheFvJhpakdiEyhr0dmQDqlmAHYxGr7QWFREZkilQeKKRePFeJfM3997k5L+Hjo4/pECDFlecwp0kbNELu3AfcEkRl5hiiTPuWKGfIn0xQh2kWwxySAtU3k2zUGAdpLNc0iGO2OUSwsKz5SQmXEZk6jDnvzb69LTBJjb8jRv2GMcIHzSiGs7D32QGAAAAAElFTkSuQmCC"
  ,"stick_7.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAALBJREFUOI3t1D1qAkEUwPGfi4WmFbucIKTzmimCB/AGegQPYZEylYWNhigqLH4V84RFAjtkt/QPw5thHn/efJLHIlotRaYwm6fwKfwHHexR4ojfGD/yFvErR1iiG30x3uBQyXuNuMyttMAIH9jhign6MZ/99P5iiGlI53hpKiQtf1yptLHwLp2F9LsNIQzwI518K9/XGp/SPvYalVbhXVr2qi1hgTO2ucl1XHCSLn8tN1MaJxupl4lMAAAAAElFTkSuQmCC"
  ,"stick_8.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAJNJREFUOI3t0yEOwkAQRuEPSOACJBhugMHgewO4U8MFsIQjVBA0Ei6CwILFFLGLQdBmt4r0JZs1k5d/JjP09Pwhgw4cC6yxwixHVOCKOr4XbimiCfZR8sAWy9RUY5yj7IRpqujDIcp2GObKiig7YpQrgwueOmiTsBo1yqbCtnPYxL9KTfRNJexZ4yG0TTjHXWj7J2/dMhe9PX35ywAAAABJRU5ErkJggg=="
  ,"stick_9.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH2AYFChQyYckycwAAAKNJREFUOI3t0zEOAUEUBuAPG0QtcQiNRu8GTuUCWnEIUWsdQK/SKBS20Iig2NFssLNWuX8y3cyX9+dliMsunMI0I8Ho1GAN/pDkD8YQU4wxiH307qdMsMUjnCsOv4AdLAJyxgyjWCgPtrEJ2Br9slAeXAZsruJCd9gHbIVWFewFXpAqqBk7dhc9WdVTpdFCjrK6pbf5KSnuaBRdjK2c4Cab8muerVAjt5zCDvoAAAAASUVORK5CYII="
}
