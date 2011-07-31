function Panel(panelContainer, title) {
    this.title = ko.observable(title);
    this.body = $('<div class="panels panel panelBody"></div>');
    this.container = $('<div class="panels panel"><h2 data-bind="text: title()"></h2></div>');
    this.container.append(this.body);
    ko.applyBindings(this, this.container[0]);

    panelContainer.append(this.container);
}

var containerDiv = $('<div class="panels container"></div>');
var headerDiv = $('<div class="panels top"></div>');
var leftDiv = $('<div class="panels left"></div>');
var rightDiv = $('<div class="panels right"></div>');
var panelsDiv = $('<div class="panels body"></div>');
var footerDiv = $('<div class="panels bottom"></div>');

function skin(skinName) {
    return ObjectMemory.checkout.readFile("skin:" + skinName).instance.bodyText;
}

function installRepoTemplateEngine() {
    var engine = new ko.jqueryTmplTemplateEngine();
    engine.getTemplateNode = function (templateId) {
	return { text: Panels.skin(templateId) };
    };
    ko.setTemplateEngine(engine);
}

$(document).ready(main);

function main() {
    var c = ObjectMemory.checkout;
    c.forEachFileOfType("textFile",
			function (name) {
			    var sheet = c.readFile(name).instance;
			    if (sheet.mimeType === "text/css" && sheet.enabled) {
				var s = $('<style type="text/css"></style>');
				s.text(sheet.bodyText);
				$("head").append(s);
			    }
			});

    installRepoTemplateEngine();

    containerDiv.append(headerDiv);
    containerDiv.append(leftDiv);
    containerDiv.append(rightDiv);
    containerDiv.append(panelsDiv);
    containerDiv.append(footerDiv);

    $("body").append(containerDiv);
}
