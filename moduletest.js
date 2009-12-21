try {

load("module.js");

var defs = new ModuleDefinitionDirectory();

defs.registerModuleDefinition(
    new ModuleDefinition(
	"top",
	["topval"],
	[],
	"var topval = 'topval_value';"));

defs.registerModuleDefinition(
    new ModuleDefinition(
	"left",
	[{"leftval": "topval"}],
	[{"top": {symbols: ["topval"]}}],
	""));

defs.registerModuleDefinition(
    new ModuleDefinition(
	"right",
	[{"rightval": "top.topval"}],
	["top"],
	""));

defs.registerModuleDefinition(
    new ModuleDefinition(
	"bot",
	[{"botval": "LEFT.leftval + '/' + right.rightval"}],
	[{"left": {alias: "LEFT"}}, "right"],
	""));

print(defs.lookupModuleDefinition("bot").constructFactory());

var b = defs.instantiateModule("bot");
print(b.botval);

} catch (e) {
    print("EXCEPTION: " + uneval(e));
    quit(1);
}
