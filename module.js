function ModuleDefinition(name, exports, imports, bodyText) {
    this.name = name;
    this.exports = exports;
    this.imports = imports;
    this.bodyText = bodyText;

    this.localName = ModuleDefinition.localNameFor(this.name);
    this.gensymCounter = 0;

    this.factory = eval(this.constructFactory());
}

ModuleDefinition.localNameFor = function (name) {
    var parts = name.split('.');
    return parts[parts.length - 1];
};

ModuleDefinition.prototype.gensym = function (distinguisher) {
    var counter = this.gensymCounter;
    this.gensymCounter++;
    return this.localName + '_' + (distinguisher ? distinguisher + '_' : '') + counter;
};

ModuleDefinition.prototype.importedModuleNames = function () {
    var result = [];
    for (var name in this.imports) { result.push(name); }
    return result;
};

ModuleDefinition.prototype.constructFactory = function () {
    var namespaceName = this.gensym('ns');
    var moduleAliases = {};
    var importBindings = [];
    var exportCodeFragments = [];
    var i, publicName, privateName;

    for (var importModuleName in this.imports) {
	var importSpec = this.imports[importModuleName];
	var localAlias = ModuleDefinition.localModuleName(importModuleName);
	var unambiguousAlias = this.gensym('mod_' + localAlias);
	moduleAliases[importModuleName] = unambiguousAlias;

	importBindings.push([unambiguousAlias,
			     namespaceName + '.lookupModule("' +
			       this.name + '", "' +
			       importModuleName + '")']);

	if (importSpec.alias) {
	    importBindings.push([(typeof(importSpec.alias) === 'string')
				   ? importSpec.alias
				   : localAlias,
				 unambiguousAlias]);
	}

	if (importSpec.symbols) {
	    for (i = 0; i < importSpec.symbols; i++) {
		var importSymbol = importSpec.symbols[i];
		if (typeof(importSymbol) === 'string') {
		    importBindings.push([importSymbol, unambiguousAlias + '.' + importSymbol]);
		} else {
		    for (publicName in importSymbol) {
			privateName = importSymbol[publicName];
			importBindings.push([privateName, unambiguousAlias + '.' + publicName]);
		    }
		}
	    }
	}
    }

    for (i = 0; i < this.exports.length; i++) {
	var exportSymbol = this.exports[i];
	if (typeof(exportSymbol) === 'string') {
	    exportCodeFragments.push(exportSymbol + ': (' + exportSymbol + ')');
	} else {
	    for (publicName in exportSymbol) {
		privateName = exportSymbol[publicName];
		exportCodeFragments.push(publicName + ': (' + privateName + ')');
	    }
	}
    }

    for (i = 0; i < importBindings.length; i++) {
	importBindings[i] = importBindings[i][0] + ' = ' + importBindings[i][1] + ';\n';
    }

    return 'function (' + namespaceName + ') {\n' +
	importBindings.join('') +
	this.bodyText +
	'return {\n' +
	exportCodeFragments.join(',\n') +
	'}';
};

function ModuleNamespace() {
    this.modules = {};
}

ModuleNamespace.prototype.beginModuleDefinition = function (name) {
    this.modules[name] = null;
};

ModuleNamespace.prototype.registerModule = function (name, exports) {
    this.modules[name] = exports;
};

ModuleNamespace.prototype.lookupModule = function (importingModuleName, name) {
    var result = this.modules[name];
    if (typeof(result) === 'undefined') {
	throw {message: "Unknown module '" + name + "' imported from '" + importingModuleName + "'",
	       importingModuleName: importingModuleName,
	       name: name};
    }
    if (result === null) {
	throw {message: "Cyclic module dependency detected in '" + importingModuleName +
	       "' while importing '" + name + "'",
	       importingModuleName: importingModuleName,
	       name: name};
    }
    return result;
};

ModuleNamespace.prototype.containsModule = function (name) {
    return name in this.modules;
};

function ModuleDefinitionDirectory() {
    this.definitions = {};
}

ModuleDefinitionDirectory.prototype.registerModuleDefinition = function (definition) {
    this.definitions[definition.name] = definition;
};

ModuleDefinitionDirectory.prototype.instantiateModule = function (goalName) {
    var ns = new ModuleNamespace();

    function instantiate(modName) {
	if (ns.containsModule[modName]) return;
	ns.beginModuleDefinition(modName);
	var def = this.definitions[modName];
	if (!def) {
	    throw 
	var importedModules = mod.importedModuleNames();
	for (var i = 0; i < importedModules.length; i++) {
	    
};