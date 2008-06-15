/***
|''Name:''|synchroAltPlugin|
|''Description:''|an alternative take on DVCS with TiddlyWiki|
|''Author:''|MartinBudden and TonyGarnockJones|
|''Version:''|0.0.1|
|''Date:''|June 15, 2008|
|''License:''|[[Creative Commons Attribution-ShareAlike 3.0 License|http://creativecommons.org/licenses/by-sa/3.0/]] |
|''~CoreVersion:''|2.4.0|

!!Description
//!!TODO write a brief description of the plugin here

!!Usage
//!!TODO describe how to use the plugin - how a user should include it in their TiddlyWiki, parameters to the plugin etc

***/

//{{{
// Ensure that the plugin is only installed once.
if(!version.extensions.synchroAltPlugin) {
version.extensions.synchroAltPlugin = {installed:true};

var revisionStore = null;

function Synchrotron()
{
    //Dvcs._debugMode = true;
    this.repo = new Dvcs.Repository();
    this.checkout = this.repo.update(null);
    return this;
}

Synchrotron.repositoryTiddlerTitle = '_synchrotronRepository';

Synchrotron.prototype.export = function()
{
	var repoExt = this.repo.exportRevisions();
	var repoText = uneval(repoExt);
	//#console.log('Synchrotron.export:'+repoText);
	return repoText;
};

Synchrotron.prototype.import = function(repoText)
{
	//#console.log('Synchrotron.import:'+repoText);
	if(repoText) {
		var repoExt = eval(repoText);
		this.repo.importRevisions(repoExt);
		this.checkout = this.repo.update(null);
	}
};

Synchrotron.prototype.getUuid = function(tiddler) {
    if (!tiddler.fields.uuid) {
	tiddler.fields.uuid = this.checkout.createFile();
    }
    return tiddler.fields.uuid;
};

Dvcs.Mergers.Defaults["tags"] = Dvcs.Mergers.simpleTextualMerger;

Synchrotron.prototype.commitAllChanges = function() {
//#console.log('commitAllChanges');
    var $this = this;
    var seenTiddlers = {};

    store.forEachTiddler(checkForChanges);
    function checkForChanges(title, tiddler) {
	if (title != Synchrotron.repositoryTiddlerTitle &&
	    !tiddler.doNotSave() &&
	    !tiddler.isTagged("systemConfig"))
	{
	    var id = $this.getUuid(tiddler);

	    seenTiddlers[id] = id;

	    function maybeStore(key, value) {
		if (value !== $this.checkout.getProp(id, key)) {
		    $this.checkout.setProp(id, key, value);
		}
	    }
	    function maybeStoreText(key, value) {
		var oldText = $this.checkout.getProp(id, key);
		if (!oldText || value.join('\n') !== oldText.join('\n')) {
		    $this.checkout.setProp(id, key, value);
		}
	    }

	    function storeSingleField(tiddler, fieldName, value) {
		if (!fieldName.match(/^temp\./)) {
		    if (typeof value != "string") {
			value = "";
		    }
		    maybeStore('field-' + fieldName, value);
		}
	    }

	    maybeStore('title', tiddler.title);
	    maybeStore('created', tiddler.created.convertToYYYYMMDDHHMM());
	    maybeStore('modified', tiddler.modified.convertToYYYYMMDDHHMM());
	    maybeStore('modifier', tiddler.modifier);
	    tiddler.tags.sort();
	    maybeStoreText('tags', tiddler.tags);
	    maybeStoreText('text', tiddler.text.split('\n'));
	    store.forEachField(tiddler, storeSingleField, true);
	}
    }

    $this.checkout.forEachFile(deleteUnseen);
    function deleteUnseen(repoId) {
	if (!(seenTiddlers[repoId])) {
	    $this.checkout.deleteFile(repoId);
	}
    }

    $this.repo.commit($this.checkout, { committer: config.options.txtUserName });
};

Synchrotron.prototype.syncUItoCheckout = function() {
//#console.log('syncUItoCheckout');
    var $this = this;
    var toDelete = {};
    var existingTiddlers = {};

    store.forEachTiddler(detectDeletable);
    function detectDeletable(title, tiddler) {
	if (title != Synchrotron.repositoryTiddlerTitle &&
	    !tiddler.isTagged("systemConfig"))
	{
	    var id = $this.getUuid(tiddler);
	    if (!$this.checkout.fileExists(id)) {
		toDelete[id] = tiddler;
	    } else {
		existingTiddlers[id] = tiddler;
	    }
	}
    }

    for (var id in toDelete) {
	var tiddler = toDelete[id];
	store.removeTiddler(tiddler.title);
	story.closeTiddler(tiddler.title, true);
    }

    $this.checkout.forEachFile(reflectFileInUI);
    function reflectFileInUI(id) {
	var tiddler = existingTiddlers[id];
	if (!tiddler) {
	    tiddler = store.createTiddler($this.checkout.getProp(id,'title'));
	    tiddler.fields.uuid = id;
	}

	var newTitle = $this.checkout.getProp(id, 'title', tiddler.title);
	var newCreated = Date.convertFromYYYYMMDDHHMM($this.checkout.getProp(id, 'created', tiddler.created.convertToYYYYMMDDHHMM()));
	var newModified = Date.convertFromYYYYMMDDHHMM($this.checkout.getProp(id, 'modified', tiddler.modified.convertToYYYYMMDDHHMM()));
	var newModifier = $this.checkout.getProp(id, 'modifier', tiddler.modifier);
	var newTags = $this.checkout.getProp(id, 'tags', tiddler.tags);
	var newText = $this.checkout.getProp(id, 'text', tiddler.text.split('\n')).join('\n');
	var newFields = {};
	$this.checkout.forEachProp(id, function(propName, propValue) {
				       if (propName.match(/^field-/)) {
					   newFields[propName.substring(6)] = propValue;
				       }
				   });

	tiddler.assign(newTitle, newText, newModifier, newModified, newTags, newCreated, newFields);
    }

    story.forEachTiddler(refreshDisplayedTiddler);
    function refreshDisplayedTiddler(title, e) {
	if (store.tiddlerExists(title) || store.isShadowTiddler(title)) {
	    story.refreshTiddler(title, null, true);
	} else {
	    story.closeTiddler(title);
	}
    }
};

Synchrotron.prototype.updateToRevision = function(revId) {
    if ((store && store.isDirty && store.isDirty()) ||
	(story && story.areAnyDirty && story.areAnyDirty()))
    {
	if (!confirm(config.messages.confirmExit))
	    return false;
    }

    this.checkout = this.repo.update(revId);
    this.syncUItoCheckout();
    store.setDirty(false);
    story.forEachTiddler(function (title) { story.setDirty(title, false); });
    refreshDisplay();
    return true;
};

Synchrotron.prototype.revertCheckout = function() {
    return this.updateToRevision(this.checkout.directParent);
};

Synchrotron.prototype.mergeWithRevision = function(revId) {
    if (this.revertCheckout()) {
	var openForEditing = {};
	var merger = this.repo.merge(this.checkout.directParent, revId);
	var fs = merger.files;

	for (var i = 0; i < merger.conflicts.length; i++) {
	    var conflictRecord = merger.conflicts[i];
	    var inode = conflictRecord.inode;

	    for (var okProp in conflictRecord.partialResult) {
		fs.setProp(inode, okProp, conflictRecord.partialResult[okProp]);
	    }

	    var winner;
	    if (!("modified" in conflictRecord.partialResult)) {
		if ("modified" in conflictRecord.conflictDetails) {
		    var aModified = conflictRecord.conflictDetails["modified"][0].conflict.a;
		    var bModified = conflictRecord.conflictDetails["modified"][0].conflict.b;
		    fs.setProp(inode, "modified", aModified > bModified ? aModified : bModified);
		    winner = aModified > bModified ? "a" : "b";
		} else {
		    fs.setProp(inode, "modified", new Date().convertToYYYYMMDDHHMM());
		    winner = "a";
		}
	    }

	    for (var badProp in conflictRecord.conflictDetails) {
		if (badProp != "modified") {
		    var r = conflictRecord.conflictDetails[badProp];
		    if (badProp == "text") {
			fs.setProp(inode, "text", Synchrotron.buildConflictMarkers(r));
		    } else if (badProp == "tags") {
			fs.setProp(inode, "tags", Synchrotron.mergeConflictingTags(r));
		    } else {
			fs.setProp(inode, badProp, r[0].conflict[winner]);
		    }
		}
	    }

	    openForEditing[inode] = fs.getProp(inode, "title");
	}
	store.setDirty(true);
	this.checkout = fs;
	this.syncUItoCheckout();
	refreshDisplay();

	for (var inodeToEdit in openForEditing) {
	    story.displayTiddler(null, openForEditing[inodeToEdit], DEFAULT_EDIT_TEMPLATE);
	}	    
    }
};

Synchrotron.buildConflictMarkers = function(r) {
    var lines = [];
    for (var i = 0; i < r.length; i++) {
        var item = r[i];
        if (item.ok) {
            lines = lines.concat(item.ok);
        } else {
            lines = lines.concat([" < < < < < < < < <"], item.conflict.a,
                                 [" ============"], item.conflict.b,
                                 [" > > > > > > > > >"]);
        }
    }
    return lines;
}

Synchrotron.mergeConflictingTags = function(r) {
    var lines = [];
    for (var i = 0; i < r.length; i++) {
        var item = r[i];
        if (item.ok) {
            lines = lines.concat(item.ok);
        } else {
            lines = lines.concat(item.conflict.a, item.conflict.b);
        }
    }
    var t = {}
    for (i = 0; i < lines.length; i++) {
	t[lines[i]] = true;
    }
    lines = [];
    for (i in t) {
	lines.push(i);
    }
    lines.sort();
    return lines;
}

restartSynchrotron = restart;
function restart()
{
//#console.log('new restart');
	restartSynchrotron();
	revisionStore = new Synchrotron();
	revisionStore.import(store.getTiddlerText(Synchrotron.repositoryTiddlerTitle));
	revisionStore.syncUItoCheckout();
}

saveChangesSynchrotron = saveChanges;
function saveChanges(onlyIfDirty,tiddlers)
{
//#console.log('new saving');
	revisionStore.commitAllChanges();

	var tiddler = new Tiddler(Synchrotron.repositoryTiddlerTitle);
	tiddler.text = '//{{{\n' + revisionStore.export() + '\n//}}}\n';
	tiddler.tags = ['excludeLists','excludeSearch'];
	store.addTiddler(tiddler);
	saveChangesSynchrotron(onlyIfDirty,tiddlers);

	refreshDisplay();
}

config.shadowTiddlers.SideBarTabs =
    config.shadowTiddlers.SideBarTabs
    .replace(/>>$/, ' "Versions" "Repository History" TabVersions>>');

merge(config.shadowTiddlers, {
	  TabVersions: '<<synchrotronHistory>>'
      });

Synchrotron.images = {
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
};

config.macros.synchrotronHistory = {};
config.macros.synchrotronHistory.handler = function(place) {
    var repo = revisionStore.repo;
    var ordering = DrawDvcs.renderRepository(repo);

    var para = document.createElement("p");
    para.style.cssText = 'line-height: 0px; white-space: nowrap;';

    for (var i = 0; i < ordering.length; i++) {
        var item = ordering[i];
        var rev = repo.lookupRev(item.revId);
        var pictures = item.pictures;
        for (var j = 0; j < pictures.length; j++) {
	    var img = document.createElement('img');
	    img.src = Synchrotron.images[pictures[j]];
	    para.appendChild(img);
	}
	var summary =
	    (rev.metadata||{}).committer + " " + new Date(rev.timestamp||0).convertToYYYYMMDDHHMM();
	var s = createTiddlyButton(para,
				   summary,
				   "Click for a menu of options for this revision",
				   config.macros.synchrotronHistory.revisionClicked);
	s.revisionId = item.revId;
	if (revisionStore.checkout.directParent == item.revId) {
	    s.style.cssText = 'background-color: blue; color: white;';
	}
	if (revisionStore.checkout.additionalParent == item.revId) {
	    s.style.cssText = 'background-color: #00cc00; color: white;';
	}
	para.appendChild(document.createElement("br"));
    }
    place.appendChild(para);
};

config.macros.synchrotronHistory.revisionClicked = function(event) {
    var e = (event || window.event);
    var revId = e.target.revisionId;
    var popup = Popup.create(this);

    createTiddlyText(createTiddlyElement(popup, "li", null, "listTitle"), "Revision " + revId);

    if (revId != revisionStore.checkout.directParent || store.isDirty()) {
	createTiddlyButton(createTiddlyElement(popup, "li"),
			   "Checkout",
			   "Displays this revision as a base to edit from",
			   function () {
			       revisionStore.updateToRevision(revId);
			   });
    } else {
	createTiddlyText(createTiddlyElement(popup, "li", null, "disabled"), "Checkout");
    }

    if (revisionStore.repo.canMerge(revisionStore.checkout.directParent,
				    revId)) {
	createTiddlyButton(createTiddlyElement(popup, "li"),
			   "Merge",
			   "Merges this revision into the current revision",
			   function () {
			       revisionStore.mergeWithRevision(revId);
			   });
    } else {
	createTiddlyText(createTiddlyElement(popup, "li", null, "disabled"), "Merge");
    }

    Popup.show();
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
    return false;
};

}//# end of 'install only once'
//}}}
