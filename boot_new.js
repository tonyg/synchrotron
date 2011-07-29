var __$_module_namespace = null;
(function () {
     try {
	 var mdd, mns, md;

	 function foreachNewInstance(f) {
	     for (var i = 0; i < __$_new_instances.length; i++) {
		 f(__$_new_instances[i]);
	     }
	 }

	 foreachNewInstance(function (ni) {
				if (ni.name === 'net.lshift.synchrotron.module') {
				    var v = eval('(function () {' + ni.bodyText +
						 '; return [ModuleDefinitionDirectory,' +
						 'ModuleNamespace,' +
						 'ModuleDefinition];})()');
				    mdd = v[0];
				    mns = v[1];
				    md = v[2];
				}
			    });

	 var defs = new mdd();
	 foreachNewInstance(function (ni) {
				if (ni.objectType === 'moduleDefinition') {
				    var modDef = md.fromJsonObject(ni);
				    defs.registerModuleDefinition(modDef);
				}
			    });

	 __$_module_namespace = new mns(defs);
	 __$_module_namespace.registerModule("net.lshift.synchrotron.Boot",
					     {module_namespace: __$_module_namespace});
	 __$_module_namespace.instantiateModule(__$_goal);
     } catch (e) {
	 alert(uneval(e));
     }
 })();
