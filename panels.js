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
    $("head").append($('<style type="text/css">' +
		       '.panels.container { border: solid black 1px; }' +
		       '.panels.clear { clear: both; }' +
		       '.panels.left { float: left; }' +
		       '.panels.right { float: right; }' +
		       '.panels.bottom { clear: both; }' +
		       '</style>'));

    containerDiv.append(headerDiv);
    containerDiv.append(leftDiv);
    containerDiv.append(rightDiv);
    containerDiv.append(panelsDiv);
    containerDiv.append(footerDiv);

    $("body").append(containerDiv);
}
