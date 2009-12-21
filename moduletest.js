load("module.js");

var defs = new ModuleDefinitionDirectory();

defs.registerModuleDefinition(
    new ModuleDefinition(
	"top",
	["topval"],
	{},
	"var topval = 'topval_value';"));

defs.registerModuleDefinition(
    new ModuleDefinition(
	"left",
	[{"leftval": "top.topval"}],
	{"top": {alias: true}},
	""));

defs.registerModuleDefinition(
    new ModuleDefinition(
	"right",
	[{"rightval": "top.topval"}],
	{"top": {alias: true}},
	""));

defs.registerModuleDefinition(
    new ModuleDefinition(
	"bot",
	[{"botval": "left.leftval + '/' + right.rightval"}],
	{"left": {alias: true},
	 "right": {alias: true}},
	""));

print(defs.lookupModuleDefinition("bot").constructFactory());

var b = defs.instantiateModule("bot");
print(b.botval);
