// Sources: https://github.com/Jermolene/TiddlyWiki5/blob/master/core/modules/savers/tiddlyfox.js
//          https://github.com/TiddlyWiki/TiddlyFox

"use strict";

function resolveRelativeURL(url) {
  var a = document.createElement('a');
  a.href = url;
  return a.href;
}

function documentLocationPath() {
  return urlToPath(document.location.toString().split("#")[0]);
}

function urlToPath(pathname) {
  if (pathname.indexOf("file://localhost/") == 0) {
    // Replace file://localhost/ with file:///
    pathname = "file://" + pathname.substr(16);
  }

  if (/^file\:\/\/\/[A-Z]\:\//i.test(pathname)) {
    // Windows path file:///x:/blah/blah --> x:\blah\blah
    // Remove the leading slash and convert slashes to backslashes
    pathname = pathname.substr(8).replace(/\//g,"\\");
  } else if (pathname.indexOf("file://///") === 0) {
    // Firefox Windows network path file://///server/share/blah/blah --> //server/share/blah/blah
    pathname = "\\\\" + unescape(pathname.substr(10)).replace(/\//g,"\\");
  } else if (pathname.indexOf("file:///") == 0) {
    // Mac/Unix local path file:///path/path --> /path/path
    pathname = unescape(pathname.substr(7));
  } else if (pathname.indexOf("file:/") == 0) {
    // Mac/Unix local path file:/path/path --> /path/path
    pathname = unescape(pathname.substr(5));
  } else {
    // Otherwise Windows network path file://server/share/path/path --> \\server\share\path\path
    pathname = "\\\\" + unescape(pathname.substr(7)).replace(new RegExp("/","g"),"\\");
  }

  return decodeURIComponent(pathname);
}

function saveFile(pathname, text, callback) {
  var messageBox = document.getElementById("tiddlyfox-message-box");

  if (!messageBox) {
    return false;
  }

  // Create the message element and put it in the message box
  var message = document.createElement("div");
  message.setAttribute("data-tiddlyfox-path", pathname);
  message.setAttribute("data-tiddlyfox-content", text);
  messageBox.appendChild(message);

  // Add an event handler for when the file has been saved
  message.addEventListener("tiddlyfox-have-saved-file", function(event) {
    if (callback) {
      callback();
    }
  }, false);

  // Create and dispatch the custom event to the extension
  var event = document.createEvent("Events");
  event.initEvent("tiddlyfox-save-file",true,false);
  message.dispatchEvent(event);

  return true;
}

function loadFile(path, callback) {
  try {
    // Just the read the file synchronously
    var xhReq = new XMLHttpRequest();
    xhReq.open("GET", "file:///" + escape(path), false);
    xhReq.overrideMimeType('text/plain');
    xhReq.send(null);
    return xhReq.responseText;
  } catch(ex) {
    return false;
  }
}
