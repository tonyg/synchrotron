// Copyright (c) 2008-2011 Tony Garnock-Jones <tonyg@lshift.net>
// Copyright (c) 2008 LShift Ltd. <query@lshift.net>
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
// BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Derived from embeddedconsole.user.js, part of
// http://hg.opensource.lshift.net/gm-embeddedconsole

function Repl(containerId) {
    this.counter = 0;
    this.containerId = containerId;
    this.inputId = containerId + "_expression";
    this.outputId = containerId + "_output";
    this.traces = [];
    this.scopeObject = {};
    this.buildView();
}

Repl.prototype.escapeHTML = function (s) {
    var n = document.createElement("div");
    n.appendChild(document.createTextNode(s));
    return n.innerHTML;
};

Repl.prototype.unescapeHTML = function (s) {
    var n = document.createElement("div");
    n.innerHTML = s;
    return n.firstChild.textContent;
};

Repl.prototype.prependOutputDiv = function (styletext, content) {
    var d = document.createElement("div");
    d.style.cssText = styletext;
    d.innerHTML = content;

    var o = document.getElementById(this.outputId);
    o.insertBefore(d, o.firstChild);
};

Repl.prototype.prependIO_HTML = function (styletext, input, outputHtml) {
    var id = this.containerId + 'expr' + this.counter;
    this.counter++;

    var editButtonId = id + '_editButton';
    var bodyHtml = '<div style="color: grey; font-style: italic">' +
    '<input style="float: right" id="'+editButtonId+'" value="Edit expression" type="submit">' +
    '<span id="'+id+'">' + this.escapeHTML(input.toString()) + '</span>' +
    '</div>';

    if (outputHtml != undefined) {
	this.prependOutputDiv(styletext, bodyHtml +
			      "<div style='border-top: 1px dashed grey'>" +
                              outputHtml +
			      "</div>");
    } else {
	this.prependOutputDiv(styletext, bodyHtml);
    }

    var thisRepl = this;
    document.getElementById(editButtonId)
    .addEventListener("click", function () { thisRepl.loadInput(id) }, false);
};

Repl.prototype.shortDisplay = function (x) {
    var t =
      (x === null) ? "null"
    : (x instanceof Array) ? "array"
    : typeof(x);

    return "(" + t + ") " + this.escapeHTML((x === undefined || x === null) ? "" :
					    x.toString ? x.toString() :
					    "(unprintable!)");
};

Repl.prototype.prependIO = function (styletext, input, output) {
    return this.prependIO_HTML(styletext, input,
                               output == undefined ? output : this.shortDisplay(output));
};

Repl.prototype.recordOutput = function (input, output) {
    this.prependIO("border: 1px solid black; margin-top: 0.5em", input, output);
};

Repl.prototype.inspectOutput = function (input, output) {
    var thisRepl = this;

    var values = [];
    var functions = [];
    var functionNames = [];
    var row;
    var ignoreValues = (typeof(output) == typeof(""));

    for (var k in output) {
	var v;
	try {
            v = output[k];
	} catch (e) {
	    v = {caught_exception_retrieving_property: e};
	}
        row = "<tr><th width='100' style='text-align: right'>" + this.escapeHTML(k) + "</th><td>" +
            thisRepl.shortDisplay(v) +
            "</td></tr>";
        switch (typeof(v)) {
          case "function":
              functionNames.push(k);
              functions.push(row);
              break;
          default:
              if (!ignoreValues) {
                  values.push(row);
              }
              break;
        }
    }

    var outputHtml = "<table><tr><td colspan='2' style='border-bottom: 1px dashed grey'>" +
        thisRepl.shortDisplay(output) + "</td>";
    for (k = 0; k < values.length; k++) {
        outputHtml = outputHtml + values[k];
    }
    if (this.get_inspectFunctions()) {
        for (k = 0; k < functions.length; k++) {
            outputHtml = outputHtml + functions[k];
        }
    } else {
        var needComma = false;
        outputHtml = outputHtml + "<tr><td colspan='2' style='border-top: 1px dashed grey'>" +
            "function names: ";
        for (k = 0; k < functionNames.length; k++) {
            if (needComma) outputHtml = outputHtml + ", ";
            outputHtml = outputHtml + this.escapeHTML(functionNames[k]);
            needComma = true;
        }
        outputHtml = outputHtml + "</td></tr>";
    }
    outputHtml = outputHtml + "</table>";
    this.prependIO_HTML("border: 1px solid black; margin-top: 0.5em", input, outputHtml);
};

Repl.prototype.recordError = function (input, e) {
    var style = "border: 2px solid red; margin-top: 0.5em";
    if ((typeof e == typeof {}) && ('message' in e)) {
	this.prependIO(style, input, e.message + " (" + e.name + ")");
    } else {
	this.prependIO(style, input, e.toString());
    }
};

Repl.prototype.refocusInput = function () {
    var codearea = document.getElementById(this.inputId);
    codearea.select();
    codearea.focus();
};

Repl.prototype.loadInput = function (id) {
    document.getElementById(this.inputId).value =
        this.unescapeHTML(document.getElementById(id).innerHTML);
    this.refocusInput();
};

Repl.prototype.processInput = function (successContinuationName) {
    var codearea = document.getElementById(this.inputId);
    var code = codearea.value.replace(/^\s*|\s*$/g,'');
    if (code) {
	var result;
	var haveError = false;
	try {
	    with (this.scopeObject) {
		result = eval(code);
	    }
	} catch (e) {
	    haveError = true;
	    result = e;
	}
	if (haveError) {
	    this.recordError(code, result);
	} else {
	    this[successContinuationName](code, result);
	}
    }
    this.refocusInput();
};

Repl.prototype.clearOutput = function () {
    document.getElementById(this.outputId).innerHTML = "";
    this.refocusInput();
};

Repl.prototype.buildView = function () {
    var evalButtonId = this.containerId + "_evalButton";
    var inspectButtonId = this.containerId + "_inspectButton";
    var clearButtonId = this.containerId + "_clearButton";
    var inspectFunctionsId = this.containerId + "_inspectFunctions";

    var h = '<div style="margin-bottom: 0.5em">' +
    '<textarea id="'+this.inputId+'" rows="6" style="width: 100%"></textarea><br>' +
    '<p>(Shortcut key: press ALT+SHIFT+P (on Windows or Linux) or CTRL+P (on Macintosh) to evaluate.</p>' +
    '<input id="'+evalButtonId+'" accesskey="p" type="submit" value="Evaluate">' +
    '<input id="'+inspectButtonId+'" accesskey="i" type="submit" value="Inspect">' +
    '<input id="'+clearButtonId+'" type="submit" value="Clear">' +
    '<input id="'+inspectFunctionsId+'" type="checkbox">Inspect functions' +
    '</div>' +
    '<div id="'+this.outputId+'"></div>';

    document.getElementById(this.containerId).innerHTML = h;

    this.get_inspectFunctions = function () {
        return document.getElementById(inspectFunctionsId).checked;
    }

    var thisRepl = this;
    document.getElementById(evalButtonId)
    .addEventListener("click", function () { thisRepl.processInput("recordOutput") }, false);
    document.getElementById(inspectButtonId)
    .addEventListener("click", function () { thisRepl.processInput("inspectOutput") }, false);
    document.getElementById(clearButtonId)
    .addEventListener("click", function () { thisRepl.clearOutput() }, false);
};

Repl.prototype.hide = function () {
    document.getElementById(this.containerId).style.display = "none";
};

Repl.prototype.show = function () {
    document.getElementById(this.containerId).style.display = "block";
};

Repl.prototype.trace = function (key, scope) {
    var thisRepl = this;
    var originalFunction;
    var traceRecord;

    if (scope == null) {
        scope = window;
    }

    originalFunction = scope[key];
    if (!originalFunction) {
        return false;
    }

    traceRecord = {scope: scope,
                   key: key,
                   originalFunction: originalFunction,
                   lastInput: undefined,
                   lastOutput: undefined,
                   lastError: undefined};
    this.traces.push(traceRecord);
    scope[key] = function () {
        var args = [];
        for (var i = 0; i < arguments.length; i++) { args.push(arguments[i]); }
        thisRepl.inspectOutput(key + ": INPUT", args);
        traceRecord.lastInput = args;
        var result;
        try {
            result = originalFunction.apply(this, arguments);
        } catch (e) {
            thisRepl.recordError(key + ": ERROR", e);
            traceRecord.lastError = e;
            throw e;
        }
        thisRepl.inspectOutput(key + ": OUTPUT", result);
        traceRecord.lastOutput = result;
        return result;
    };

    return true;
};

Repl.prototype.traceRecord = function (key, scope) {
    if (scope == null) {
        scope = window;
    }

    for (var i = 0; i < this.traces.length; i++) {
        var entry = this.traces[i];
        if (entry.scope === scope && entry.key === key) {
            return entry;
        }
    }
    return null;
};

Repl.prototype.untrace = function (key, scope) {
    if (scope == null) {
        scope = window;
    }

    for (var i = 0; i < this.traces.length; i++) {
        var entry = this.traces[i];
        if (entry.scope === scope && entry.key === key) {
            scope[key] = entry.originalFunction;
            this.traces.splice(i, 1); // remove the entry
            return;
        }
    }
};

Repl.prototype.addBinding = function (name, value) {
    this.scopeObject[name] = value;
};

Repl.prototype.deleteBinding = function (name) {
    delete this.scopeObject[name];
};

Repl.prototype.clearBindings = function () {
    this.scopeObject = {};
};
