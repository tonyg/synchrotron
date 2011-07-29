$(document).ready(main);

function main() {
    var filename = "testIndex-"+Mc.Util.random_uuid()+".html";
    alert(filename);
    $("body").append($((new Showdown.converter()).makeHtml("Hello, *world*!")));

    var r = ObjectMemory.repo;
    var c = ObjectMemory.checkout;

    var f;
    if (c.fileExists("foo")) {
	f = c.readFile("foo").instance;
    } else {
	f = {name: "foo", exports: [], imports: [], bodyText: "alert('hi');"};
    }
    f.bodyText = f.bodyText + "\nalert('there');";
    c.writeFile("foo", f, "moduleDefinition");
    c.commit({summary: "updated foo"});

    Boot.module_namespace.definitionDirectory.registerJsonModuleDefinition(f);
    Boot.module_namespace.instantiateModule('foo');

    ObjectMemory.saveImageAs(filename);

    $("body").append($((new Showdown.converter()).makeHtml("Done!")));
};
