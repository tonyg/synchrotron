import sys
import string
import re

seen = {}
heads = []
current = None
parents = []
summary = ''

for line in sys.stdin.readlines():
    line = line.strip()
    if line:
        (keyword, value) = line.split(':', 1)
        if keyword == "changeset":
            current = value.strip().split(':')[0]
        elif keyword == 'parent':
            p = value.strip().split(':')[0]
            parents.append(p)
        elif keyword == 'summary':
            summary = value.strip()
    else:
        if not parents:
            p = int(current) - 1
            if p >= 0:
                parents.append(str(p))
        for p in parents:
            seen[p] = 1
        if not seen.has_key(current):
            heads.append(current)
        print "Graph.Tests._add(g, '%s', [%s], %s);" % (current,
                                                        ','.join(["'"+x+"'" for x in parents]),
                                                        repr(summary))
        current = None
        parents = []

print "var worklist = [%s];" % (','.join(["'"+x+"'" for x in heads]))
