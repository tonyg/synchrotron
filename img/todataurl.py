import glob
import base64

print 'var synchrotronImages = {'
comma = ''
for file in glob.glob("*.png"):
    f = open(file, 'rb')
    print '  %s"%s": "data:image/png;base64,%s"' % (comma, file, base64.b64encode(f.read()))
    f.close()
    comma = ','
print '};'
