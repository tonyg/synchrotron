#!/usr/bin/env python

import cairo
import math

pi = math.pi

WIDTH = 20
MID = WIDTH / 2.0
BLOBRADIUS = WIDTH / 4.0
LINEWIDTH = WIDTH / 12.0

ENABLE_CROSSOVER = False

surface = None
ctx = None

def reset(n = None):
    global surface, ctx
    if n and surface:
        surface.write_to_png(n)
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, WIDTH, WIDTH)
    ctx = cairo.Context(surface)
    ctx.set_line_width(LINEWIDTH)

#     ctx.set_source_rgb(1,1,1)
#     ctx.paint()
#     ctx.set_source_rgb(0,0,0)

def m(n):
    ctx.move_to(MID, MID)
    if n & 1: ctx.line_to(MID, 0); ctx.stroke()
    ctx.move_to(MID, MID)
    if n & 2: ctx.line_to(0, MID); ctx.stroke()
    ctx.move_to(MID, MID)
    if n & 4: ctx.line_to(MID, WIDTH); ctx.stroke()
    ctx.move_to(MID, MID)
    if n & 8: ctx.line_to(WIDTH, MID); ctx.stroke()

    ctx.arc(MID, MID, BLOBRADIUS, 0, pi * 2)
    ctx.fill()
    ctx.set_source_rgb(1,1,1)
    ctx.arc(MID, MID, BLOBRADIUS - LINEWIDTH, 0, pi * 2)
    ctx.fill()

    reset("blob_%d.png" % n)

def k(n):
    if n & 1:
        ctx.move_to(MID, 0)
        if ENABLE_CROSSOVER and n & 2:
            ctx.line_to(MID, MID - BLOBRADIUS - LINEWIDTH / 4)
            ctx.stroke()
            ctx.move_to(MID, MID - LINEWIDTH / 4)
        ctx.line_to(MID, WIDTH)
        ctx.stroke()
    if n & 2:
        ctx.move_to(0, MID)
        if ENABLE_CROSSOVER and n & 1:
            ctx.line_to(MID - BLOBRADIUS + LINEWIDTH, MID)
            ctx.curve_to(MID - BLOBRADIUS + LINEWIDTH, MID - BLOBRADIUS,
                         MID + BLOBRADIUS - LINEWIDTH, MID - BLOBRADIUS,
                         MID + BLOBRADIUS - LINEWIDTH, MID)
        ctx.line_to(WIDTH, MID)
        ctx.stroke()
    if n & 4:
        ctx.arc(0, WIDTH, WIDTH/2, pi / 2, 0)
        ctx.stroke()
    if n & 8:
        ctx.arc(WIDTH, WIDTH, WIDTH/2, pi, 3 * pi / 2)
        ctx.stroke()
    reset("stick_%d.png" % n)

reset()
for n in range(16):
    m(n)
    k(n)

def topleft():
    ctx.move_to(MID, 0)
    ctx.line_to(0, MID)
    ctx.stroke()
def bottomright():
    ctx.move_to(WIDTH, MID)
    ctx.line_to(MID, WIDTH)
    ctx.stroke()
bottomright()
reset("slide_l.png")
topleft()
bottomright()
reset("slide_m.png")
topleft()
reset("slide_r.png")
