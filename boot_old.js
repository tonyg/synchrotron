var __$_module_namespace = null;
(function () {
     try {
	 var mdd, mns, md;

	 var r = __$_exported_repo;
	 function lookup(blobId) {
	     var blob = r.blobs[blobId];
	     return eval('(' + (blob._boot_full || blob.full) + ')');
	 }

	 var index = lookup(r.tags[r.repoId + "/master"].blobId.substring(6));
	 var module = lookup(index.inodes[index.names["net.lshift.synchrotron.module"]].substring(17));
	 var v = eval('(function () {' + module.bodyText +
		      '; return [ModuleDefinitionDirectory,' +
		      'ModuleNamespace,' +
		      'ModuleDefinition];})()');
	 mdd = v[0];
	 mns = v[1];
	 md = v[2];

	 var defs = new mdd();
	 for (var name in index.names) {
	     var blobId = index.inodes[index.names[name]];
	     if (blobId.indexOf("moduleDefinition:") == 0) {
		 var modDef = md.fromJsonObject(lookup(blobId.substring(17)));
		 defs.registerModuleDefinition(modDef);
	     }
	 }

	 __$_module_namespace = new mns(defs);
	 __$_module_namespace.registerModule("net.lshift.synchrotron.Boot",
					     {module_namespace: __$_module_namespace});
	 __$_module_namespace.instantiateModule(__$_goal);
     } catch (e) {
	 alert(uneval(e));
     }
 })();
