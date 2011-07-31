function Panel(panelContainer, title) {
    this.title = ko.observable(title);
    this.body = $('<div class="panels panel panelBody"></div>');
    this.container = $('<div class="panels panel"><h2 data-bind="text: title()"></h2></div>');
    this.container.append(this.body);
    ko.applyBindings(this, this.container[0]);

    panelContainer.append(this.container);
}

$(document).ready(main);

var containerDiv = $('<div class="panels container"></div>');
var headerDiv = $('<div class="panels top"></div>');
var leftDiv = $('<div class="panels left"></div>');
var rightDiv = $('<div class="panels right"></div>');
var panelsDiv = $('<div class="panels body"></div>');
var footerDiv = $('<div class="panels bottom"></div>');

function main() {
    var c = ObjectMemory.checkout;
    c.forEachFileOfType("cssStyleSheet",
			function (name) {
			    var sheet = c.readFile(name).instance;
			    if (sheet.enabled) {
				var s = $('<style type="text/css"></style>');
				s.text(sheet.bodyText);
				$("head").append(s);
			    }
			});

    containerDiv.append(headerDiv);
    containerDiv.append(leftDiv);
    containerDiv.append(rightDiv);
    containerDiv.append(panelsDiv);
    containerDiv.append(footerDiv);

    $("body").append(containerDiv);
}
