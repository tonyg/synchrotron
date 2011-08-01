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

function boundSkin(skinName, viewModel) {
    var node = $(skin(skinName));
    var count = node.size();
    for (var i = 0; i < count; i++) {
	ko.applyBindings(viewModel, node[i]);
    }
    return node;
}

// Based on https://gist.github.com/973973 "Zepto + Mustache + KnockoutJS starting point"
// Uses JQuery and our repository instead of Zepto and the document's own DOM.
ko.mustacheTemplateEngine = function () {
    this.cache = {};

    ObjectMemory.checkout.changeListeners.name.push(function (event) {
	if (event.name.substring(0, 5) === "skin:") {
	    delete this.cache[event.name.substring(5)];
	}
    });

    this['getTemplateNode'] = function (template) {
	if (!(template in this.cache)) {
	    this.cache[template] = { text: skin(template), isRewritten: false };
	}
	return this.cache[template];
    }

    this['renderTemplate'] = function (templateId, data, options) {
        options = options || {};
	var templateOptions = options['templateOptions'] || {};
	var context = $.extend({$data: data}, data, templateOptions);
        var template = this['getTemplateNode'](templateId).text,
            html = Mustache.to_html(template, context),
            resultNodes = $(html);
        return resultNodes;
    };

    this['isTemplateRewritten'] = function (templateId) {
        return this['getTemplateNode'](templateId).isRewritten === true;
    };

    this['rewriteTemplate'] = function (template, rewriterCallback) {
        var templateNode = this['getTemplateNode'](template);
        var rewritten = rewriterCallback(templateNode.text);
        templateNode.text = rewritten;
        templateNode.isRewritten = true;
    };

    this['createJavaScriptEvaluatorBlock'] = function (script) {
	/* This is a nonstandard extension to Mustache. */
	return "{{@ " + script + "}}";
    };
};
ko.mustacheTemplateEngine.prototype = new ko.templateEngine();

function installRepoTemplateEngine() {
    ko.setTemplateEngine(new ko.mustacheTemplateEngine());
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

    /* TODO: Make font links be documents like style sheets are */
    $("head").append($("<link href='http://fonts.googleapis.com/css?family=Lora&amp;v1' rel='stylesheet' type='text/css'>"));
    $("head").append($("<link href='http://fonts.googleapis.com/css?family=Mako&amp;v1' rel='stylesheet' type='text/css'>"));
}
