#!/usr/bin/env python
try:
    import json
except:
    import simplejson as json
import sys
import os

f = file("image.boot.html")
template = f.read()
f.close()

mods = {}
defs = []

def loadTextFile(name, kind = 'text', prefix = ''):
    sys.stderr.write("Loading %s file %s...\n" % (kind, name))
    f = file(name)
    body = f.read()
    f.close()
    metadata = {}
    metadata["bodyText"] = body
    metadata["name"] = prefix + os.path.splitext(os.path.basename(name))[0]
    metadata["mimeType"] = "text/plain"

    d = dict(metadata)
    d["objectType"] = "textFile"
    defs.append(d)

def loadSkin(name):
    return loadTextFile(name, 'skin', 'skin:')

def loadStyleFile(name):
    sys.stderr.write("Loading CSS style file %s...\n" % (name,))
    f = file(name)
    body = f.read()
    f.close()
    metadata = {}
    metadata["bodyText"] = body
    metadata["name"] = name
    metadata["mimeType"] = "text/css"
    metadata["enabled"] = True

    d = dict(metadata)
    d["objectType"] = "textFile"
    defs.append(d)

def loadModspec(name):
    sys.stderr.write("Loading javascript module %s...\n" % (name,))
    f = file(name + ".modspec.js")
    metadata = json.load(f)
    f.close()
    f = file(name + ".js")
    body = f.read()
    f.close()
    metadata["bodyText"] = body
    metadata["mimeType"] = "application/javascript"

    mods[metadata["name"]] = metadata

    d = dict(metadata)
    d["objectType"] = "moduleDefinition"
    defs.append(d)

def split(what, marker):
    (prefix, suffix) = what.split(marker + "START", 1)
    (middle, suffix) = what.split(marker + "STOP", 1)
    return (prefix + marker + "START", "// " + marker + "STOP\n" + suffix)

def replaceMarker(marker, value):
    global template
    (prefix, template) = split(template, marker)
    value = value \
        .replace('</script>', '</scr"+"ipt>') # skode. Should deal with this case-insensitively
    print prefix + '\n' + value

goal = sys.argv[1]
modspecs = []
stylefiles = []
skins = []
textfiles = []
mode = modspecs
for name in sys.argv[2:]:
    if name == '--styles':
        mode = stylefiles
    elif name == '--modules':
        mode = modspecs
    elif name == '--skins':
        mode = skins
    elif name == '--textfiles':
        mode = textfiles
    else:
        mode.append(name)

for name in stylefiles:
    loadStyleFile(name)

for name in modspecs:
    loadModspec(name)

for name in skins:
    loadSkin(name)

for name in textfiles:
    loadTextFile(name)

replaceMarker('__$__exported_repo__$__', '(' + json.dumps({}, indent = 2) + ')')
replaceMarker('__$__exported_reflog__$__', '(' + json.dumps([], indent = 2) + ')')
replaceMarker('__$__new_instances__$__', '(' + json.dumps(defs, indent = 2) + ')')
replaceMarker('__$__goal__$__', '(' + json.dumps(goal, indent = 2) + ')')
replaceMarker('__$__boot_script__$__', mods['net.lshift.synchrotron.boot_new']['bodyText'])
print template
