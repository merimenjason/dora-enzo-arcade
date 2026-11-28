# Builds a chibi Dora or Enzo in Blender and exports a .glb with one clip per action.
# Run: blender -b -P art/blender/chinchilla.py -- --who dora --outfit squall --out public/art/squall/dora.glb [--preview out.png]
#
# The model is a toy-like figure: each body part is its own smooth mesh, parented rigidly to one bone, so there is no
# weight painting to go wrong. Fur and outfit colours are flat vertex-free materials (base colour only); the game
# shades them with a toon ramp. Faces are modelled (eyes, highlights, nose, whiskers), not painted.
import bpy, sys, math, argparse
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--who', default='dora')
ap.add_argument('--outfit', default='plain')
ap.add_argument('--out', required=True)
ap.add_argument('--preview', default='')
args = ap.parse_args(argv)

FUR = {'dora': ((0.95, 0.91, 0.84), (0.99, 0.97, 0.93)), 'enzo': ((0.56, 0.57, 0.60), (0.80, 0.80, 0.82))}[args.who]
PINK = (0.96, 0.62, 0.66)
EYE = (0.06, 0.04, 0.05) if args.who == 'enzo' else (0.42, 0.07, 0.07)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30

mats = {}
def mat(name, rgb, rough=0.8, emit=0.0):
    if name in mats: return mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*rgb, 1)
        b.inputs['Emission Strength'].default_value = emit
    mats[name] = m
    return m

def smooth(o, levels=2):
    for p in o.data.polygons: p.use_smooth = True
    if levels:
        md = o.modifiers.new('sub', 'SUBSURF'); md.levels = levels; md.render_levels = levels
    return o

def ball(name, loc, scale, m, seg=24, ring=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
    return o

def cyl(name, loc, r, depth, m, rot=(0, 0, 0), r2=None, verts=20):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
    return o

fur = mat('fur', FUR[0]); belly = mat('belly', FUR[1]); pink = mat('pink', PINK)
eye = mat('eye', EYE, 0.2); shine = mat('shine', (1, 1, 1), 0.1, 0.6); nose = mat('nose', (0.85, 0.45, 0.5))
whisk = mat('whisker', (0.25, 0.22, 0.22))

# ---- armature (Z up, character faces -Y, height ~1.0) ----
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object; arm.name = f'{args.who}-rig'
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
root = eb[0]; root.name = 'root'; root.head = (0, 0, 0); root.tail = (0, 0, 0.12)
def bone(name, head, tail, parent):
    b = eb.new(name); b.head = head; b.tail = tail; b.parent = eb[parent]; return b
bone('body', (0, 0, 0.18), (0, 0, 0.42), 'root')
bone('head', (0, 0, 0.42), (0, 0, 0.72), 'body')
bone('ear.L', (0.13, 0, 0.78), (0.2, 0, 0.98), 'head')
bone('ear.R', (-0.13, 0, 0.78), (-0.2, 0, 0.98), 'head')
bone('arm.L', (0.15, -0.04, 0.36), (0.2, -0.08, 0.22), 'body')
bone('arm.R', (-0.15, -0.04, 0.36), (-0.2, -0.08, 0.22), 'body')
bone('leg.L', (0.09, 0, 0.16), (0.09, 0, 0.02), 'root')
bone('leg.R', (-0.09, 0, 0.16), (-0.09, 0, 0.02), 'root')
bone('tail', (0, 0.14, 0.2), (0, 0.3, 0.34), 'body')
bpy.ops.object.mode_set(mode='OBJECT')

PARTS = []
def attach(o, bname):
    """mark a part as moving rigidly with one bone (weight 1.0); parts are joined into one skinned mesh later"""
    PARTS.append((o, bname))
    return o

# ---- body ----
attach(ball('torso', (0, 0, 0.27), (0.19, 0.17, 0.17), fur), 'body')
attach(ball('belly', (0, -0.07, 0.25), (0.13, 0.11, 0.12), belly), 'body')
# head: big, a little wider than tall, with plump cheeks
attach(ball('head', (0, -0.01, 0.56), (0.26, 0.22, 0.205), fur, 32, 20), 'head')
# fluff: tufts on the crown and a soft chest ruff, so the silhouette reads as fur, not a smooth mouse
for k, (x, z, rr) in enumerate(((0, 0.76, 0.06), (0.06, 0.745, 0.045), (-0.06, 0.745, 0.045), (0.035, 0.775, 0.035))):
    attach(ball(f'tuft{k}', (x, -0.06, z), (rr, rr * 0.9, rr), fur, 16, 10), 'head')

attach(ball('cheek.L', (0.12, -0.11, 0.49), (0.12, 0.09, 0.085), belly), 'head')
attach(ball('cheek.R', (-0.12, -0.11, 0.49), (0.12, 0.09, 0.085), belly), 'head')
attach(ball('muzzle', (0, -0.19, 0.505), (0.06, 0.04, 0.04), belly), 'head')
# ears: huge, round, thin discs, tilted out, with pink insides
for s, n in ((1, 'L'), (-1, 'R')):
    e = ball(f'ear.{n}', (s * 0.17, 0.0, 0.84), (0.13, 0.03, 0.15), fur)
    e.rotation_euler = Euler((0, s * -0.42, 0)); attach(e, f'ear.{n}')
    i = ball(f'earin.{n}', (s * 0.17, -0.02, 0.84), (0.1, 0.02, 0.12), pink)
    i.rotation_euler = Euler((0, s * -0.42, 0)); attach(i, f'ear.{n}')
# face
for s, n in ((1, 'L'), (-1, 'R')):
    ey = ball(f'eye.{n}', (s * 0.1, -0.17, 0.585), (0.058, 0.03, 0.068), eye)
    ey.rotation_euler = Euler((0, 0, s * -0.3)); attach(ey, 'head')
    attach(ball(f'shine.{n}', (s * 0.085, -0.198, 0.615), (0.02, 0.01, 0.022), shine, 12, 8), 'head')
    attach(ball(f'shine2.{n}', (s * 0.115, -0.197, 0.56), (0.009, 0.006, 0.009), shine, 10, 6), 'head')
    attach(ball(f'blush.{n}', (s * 0.17, -0.185, 0.5), (0.035, 0.012, 0.02), pink, 12, 8), 'head')
    for k, dz in enumerate((0.01, -0.012)):
        w = cyl(f'whisker.{n}{k}', (s * 0.15, -0.2, 0.5 + dz), 0.0025, 0.13, whisk, (0, math.pi / 2, s * 0.25 + (dz * 6)), verts=6)
        attach(w, 'head')
attach(ball('nose', (0, -0.228, 0.52), (0.018, 0.012, 0.013), nose, 12, 8), 'head')
# arms, legs, feet
for s, n in ((1, 'L'), (-1, 'R')):
    a = ball(f'arm.{n}', (s * 0.18, -0.07, 0.29), (0.045, 0.045, 0.08), fur); attach(a, f'arm.{n}')
    attach(ball(f'paw.{n}', (s * 0.2, -0.09, 0.22), (0.04, 0.04, 0.035), belly), f'arm.{n}')
    attach(ball(f'leg.{n}', (s * 0.09, -0.02, 0.1), (0.06, 0.06, 0.07), fur), f'leg.{n}')
    attach(ball(f'foot.{n}', (s * 0.09, -0.06, 0.03), (0.055, 0.08, 0.03), belly), f'leg.{n}')
# tail: a big fluffy plume of overlapping balls
for k, (y, z, r) in enumerate(((0.17, 0.2, 0.08), (0.24, 0.28, 0.11), (0.28, 0.38, 0.12), (0.27, 0.47, 0.1))):
    attach(ball(f'tail{k}', (0, y, z), (r, r * 0.9, r), fur if k < 3 else belly), 'tail')

# ---- outfits ----
def coat(rgb, name, sleeves=True, length=0.15):
    m = mat(name, rgb, 0.55)
    attach(ball(f'{name}.body', (0, 0, 0.27), (0.205, 0.185, 0.185), m), 'body')
    if sleeves:
        for s, n in ((1, 'L'), (-1, 'R')):
            attach(ball(f'{name}.sleeve.{n}', (s * 0.18, -0.07, 0.31), (0.052, 0.052, 0.065), m), f'arm.{n}')
    return m

if args.outfit == 'squall' and args.who == 'dora':
    m = coat((0.98, 0.78, 0.12), 'raincoat')
    hood = ball('hood', (0, 0.1, 0.44), (0.14, 0.07, 0.07), m); attach(hood, 'body')
    for k, z in enumerate((0.33, 0.26, 0.19)):
        attach(ball(f'button{k}', (0, -0.19, z), (0.014, 0.008, 0.014), mat('button', (1, 1, 1), 0.3), 10, 6), 'body')
elif args.outfit == 'squall' and args.who == 'enzo':
    m = coat((0.97, 0.97, 0.95), 'singlet', sleeves=False)
    shorts = mat('shorts', (0.15, 0.3, 0.7), 0.7)
    attach(ball('shorts', (0, 0, 0.17), (0.19, 0.17, 0.09), shorts), 'root')
    towel = mat('towel', (0.98, 0.98, 0.98), 0.95)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.035, location=(0, -0.01, 0.42))
    t = bpy.context.object; t.name = 'towel'; t.scale = (1, 0.95, 0.6); t.data.materials.append(towel); smooth(t, 1); attach(t, 'body')
    stripe = mat('stripe', (0.25, 0.45, 0.85), 0.9)
    for s in (1, -1):
        attach(ball(f'towel.end{s}', (s * 0.07, -0.15, 0.33), (0.035, 0.015, 0.07), towel, 12, 8), 'body')
        attach(ball(f'towel.stripe{s}', (s * 0.07, -0.163, 0.3), (0.036, 0.006, 0.01), stripe, 12, 6), 'body')
elif args.outfit == 'jong':
    red = mat('tunic', (0.82, 0.08, 0.08), 0.45)
    coat((0.82, 0.08, 0.08), 'tunic')
    gold = mat('sash', (0.95, 0.72, 0.18), 0.35)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.025, location=(0, 0, 0.2))
    t = bpy.context.object; t.name = 'sash'; t.scale = (1, 0.92, 1); t.data.materials.append(gold); smooth(t, 1); attach(t, 'body')
    trou = mat('trousers', (0.07, 0.07, 0.08), 0.8)
    for s, n in ((1, 'L'), (-1, 'R')):
        attach(ball(f'trouser.{n}', (s * 0.09, -0.02, 0.11), (0.068, 0.068, 0.075), trou), f'leg.{n}')
    for k, z in enumerate((0.36, 0.3)):
        attach(ball(f'frog{k}', (0, -0.19, z), (0.03, 0.008, 0.008), gold, 10, 6), 'body')

# ---- clips ----
pb = arm.pose.bones
for b in pb: b.rotation_mode = 'XYZ'
def key(frame, poses):
    for name in [b.name for b in pb]:
        p = pb[name]
        r, l = poses.get(name, ((0, 0, 0), (0, 0, 0)))
        p.rotation_euler = Euler(r); p.location = Vector(l)
        p.keyframe_insert('rotation_euler', frame=frame); p.keyframe_insert('location', frame=frame)
def P(**kw):
    out = {}
    for k, v in kw.items():
        n = k.replace('_L', '.L').replace('_R', '.R')
        out[n] = (v[0], v[1] if len(v) > 1 else (0, 0, 0))
    return out
def clip(name, frames):
    act = bpy.data.actions.new(name)
    arm.animation_data_create(); arm.animation_data.action = act
    for f, poses in frames: key(f, poses)
    act.use_fake_user = True
    trk = arm.animation_data.nla_tracks.new(); trk.name = name
    trk.strips.new(name, int(frames[0][0]), act)
    arm.animation_data.action = None

r = math.radians
clip('idle', [
    (1, P(body=((0, 0, 0),), head=((0, 0, 0),), tail=((0, 0, 0),))),
    (30, P(body=((r(2), 0, 0), (0, 0, -0.005)), head=((r(-3), 0, r(3)),), ear_L=((0, r(-6), 0),), ear_R=((0, r(6), 0),), tail=((r(-8), 0, 0),))),
    (60, P(body=((0, 0, 0),), head=((0, 0, 0),), tail=((0, 0, 0),))),
])
clip('run', [
    (1, P(root=((0, 0, 0), (0, 0, 0)), body=((r(10), 0, 0),), leg_L=((r(-40), 0, 0),), leg_R=((r(40), 0, 0),), arm_L=((r(40), 0, 0),), arm_R=((r(-40), 0, 0),), tail=((r(15), 0, 0),), ear_L=((r(20), 0, 0),), ear_R=((r(20), 0, 0),))),
    (5, P(root=((0, 0, 0), (0, 0, 0.04)), body=((r(12), 0, 0),), tail=((r(-5), 0, 0),), ear_L=((r(28), 0, 0),), ear_R=((r(28), 0, 0),))),
    (9, P(root=((0, 0, 0), (0, 0, 0)), body=((r(10), 0, 0),), leg_L=((r(40), 0, 0),), leg_R=((r(-40), 0, 0),), arm_L=((r(-40), 0, 0),), arm_R=((r(40), 0, 0),), tail=((r(15), 0, 0),), ear_L=((r(20), 0, 0),), ear_R=((r(20), 0, 0),))),
    (13, P(root=((0, 0, 0), (0, 0, 0.04)), body=((r(12), 0, 0),), tail=((r(-5), 0, 0),), ear_L=((r(28), 0, 0),), ear_R=((r(28), 0, 0),))),
    (17, P(root=((0, 0, 0), (0, 0, 0)), body=((r(10), 0, 0),), leg_L=((r(-40), 0, 0),), leg_R=((r(40), 0, 0),), arm_L=((r(40), 0, 0),), arm_R=((r(-40), 0, 0),), tail=((r(15), 0, 0),), ear_L=((r(20), 0, 0),), ear_R=((r(20), 0, 0),))),
])
clip('jump', [
    (1, P(root=((0, 0, 0), (0, 0, -0.04)), body=((r(15), 0, 0),), leg_L=((r(-30), 0, 0),), leg_R=((r(-30), 0, 0),), arm_L=((r(30), 0, 0),), arm_R=((r(30), 0, 0),))),
    (6, P(body=((r(-8), 0, 0),), leg_L=((r(25), 0, 0),), leg_R=((r(10), 0, 0),), arm_L=((r(-150), 0, r(-20)),), arm_R=((r(-150), 0, r(20)),), ear_L=((r(35), 0, 0),), ear_R=((r(35), 0, 0),), tail=((r(-25), 0, 0),))),
    (14, P(body=((r(-4), 0, 0),), leg_L=((r(20), 0, 0),), leg_R=((r(-15), 0, 0),), arm_L=((r(-130), 0, r(-30)),), arm_R=((r(-120), 0, r(30)),), ear_L=((r(-15), 0, 0),), ear_R=((r(-15), 0, 0),), tail=((r(10), 0, 0),))),
])
clip('land', [
    (1, P(root=((0, 0, 0), (0, 0, -0.06)), body=((r(18), 0, 0),), leg_L=((r(-35), 0, 0),), leg_R=((r(-35), 0, 0),), arm_L=((r(20), 0, r(-30)),), arm_R=((r(20), 0, r(30)),), ear_L=((r(30), 0, 0),), ear_R=((r(30), 0, 0),))),
    (8, P(root=((0, 0, 0), (0, 0, 0.0)), body=((r(-3), 0, 0),), ear_L=((r(-8), 0, 0),), ear_R=((r(-8), 0, 0),))),
    (14, P()),
])

# bake each part (subsurf applied), give it one full-weight vertex group, and join into one skinned mesh
bpy.ops.object.select_all(action='DESELECT')
for o, bname in PARTS:
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    if not o.modifiers:
        md = o.modifiers.new('sub', 'SUBSURF'); md.levels = 1
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vg = o.vertex_groups.new(name=bname); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    o.select_set(False)
for o, _ in PARTS: o.select_set(True)
body_obj = PARTS[0][0]
bpy.context.view_layer.objects.active = body_obj
bpy.ops.object.join()
body_obj.name = f'{args.who}-{args.outfit}'
md = body_obj.modifiers.new('rig', 'ARMATURE'); md.object = arm
body_obj.parent = arm

import os
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_apply=False, export_skins=True, export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_yup=True)
print('EXPORTED', args.out, os.path.getsize(args.out))

if args.preview:
    arm.animation_data.action = bpy.data.actions['idle']
    for t in arm.animation_data.nla_tracks: t.mute = True
    scene.frame_set(1)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = (0.9, -1.9, 0.75); cam.rotation_euler = Euler((r(80), 0, r(25))); cam.data.lens = 50
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scene.collection.objects.link(sun)
    sun.rotation_euler = Euler((r(50), r(10), r(30))); sun.data.energy = 3.5
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.6, 0.68, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'
    scene.render.resolution_x = 640; scene.render.resolution_y = 640
    scene.render.filepath = args.preview
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', args.preview)
