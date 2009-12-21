var __$_module_definitions = null;
var __$_module_ns = null;
(function () {
     try {
	 var mdd, md;

	 function foreachNewInstance(f) {
	     for (var i = 0; i < __$_new_instances.length; i++) {
		 f(__$_new_instances[i]);
	     }
	 }

	 foreachNewInstance(function (ni) {
				if (ni.name === 'net.lshift.synchrotron.module') {
				    var v = eval('(function () {' + ni.bodyText +
						 '; return [ModuleDefinitionDirectory,' +
						 'ModuleDefinition];})()');
				    mdd = v[0];
				    md = v[1];
				}
			    });

	 var defs = new mdd();
	 foreachNewInstance(function (ni) {
				if (ni.objectType === 'moduleDefinition') {
				    var modDef = md.fromJsonObject(ni);
				    defs.registerModuleDefinition(modDef);
				}
			    });

	 __$_module_definitions = defs;
	 __$_module_ns = defs.instantiateModule(__$_goal);
     } catch (e) {
	 alert(uneval(e));
     }
 })();
