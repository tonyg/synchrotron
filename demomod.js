$(document).ready(main);

function main() {
    var filename = "testIndex-"+Mc.Util.random_uuid()+".html";
    //alert(filename);
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
    //Boot.module_namespace.instantiateModule('foo');

    //ObjectMemory.saveImageAs(filename);

    $("body").append($((new Showdown.converter()).makeHtml("Done!")));

    Panels.headerDiv.html("<h1>Demo</h1>");

    var newPanelButton = $('<button>New Panel</button>');
    newPanelButton.click(function () {
	var p = new Panels.Panel(Panels.panelsDiv, "Test panel");
	p.body.html('<b>Ha!</b>');
    });
    Panels.rightDiv.append(newPanelButton);

    c.writeFile("bar", "hello", "text");
    c.commit({summary: "Add bar"});

    c.forEachFileOfType("text",
			function (name) {
			    var p = new Panels.Panel(Panels.panelsDiv, name);
			    p.body.append($((new Showdown.converter())
					    .makeHtml(c.readFile(name).instance)));
			});
};
