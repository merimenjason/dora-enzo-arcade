import * as T from 'three';
import {
  createChinchilla,
  animateChinchilla,
  type Chinchilla,
} from './chinchilla';
import { routePose } from './checkpoint-remake-game';
import type { Species } from './checkpoint-game';

export class RemakeScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(38, 1, 0.1, 90);
  renderer: T.WebGLRenderer;
  dora: Chinchilla;
  enzo: Chinchilla;
  visitor = new T.Group();
  gate = new T.Group();
  elapsed = 0;
  decision: boolean | null = null;
  arrival = 0;
  complete = false;
  private observer: ResizeObserver;
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.scene.background = new T.Color('#b9c8c7');
    this.scene.fog = new T.Fog('#b9c8c7', 25, 65);
    this.scene.add(new T.HemisphereLight(0xe6f4ff, 0x574636, 2));
    const sun = new T.DirectionalLight(0xffdda4, 3);
    sun.position.set(-6, 12, -4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    this.scene.add(sun);
    this.box(this.scene, 0, -0.16, 0, 70, 0.3, 65, 0x9f9987);
    for (let i = 0; i < 12; i++) {
      const mountain = new T.Mesh(
        new T.ConeGeometry(4 + (i % 3), 6 + (i % 4), 5),
        new T.MeshStandardMaterial({
          color: i % 2 ? 0x899d9b : 0x768a8d,
          flatShading: true,
        }),
      );
      mountain.position.set(i * 5 - 28, 1, 17 + (i % 3) * 3);
      this.scene.add(mountain);
    }
    // Open-front, cutaway booth. Neither counter nor signage overlaps the inspectors.
    this.box(this.scene, 0, 0.08, 3.25, 6.5, 0.18, 3.5, 0x646b62);
    this.box(this.scene, 0, 1.55, 4.9, 6.5, 3, 0.18, 0x345350);
    this.box(this.scene, -3.2, 1.4, 3.3, 0.15, 2.8, 3.4, 0x46645c);
    this.box(this.scene, 0, 3.22, 4.1, 6.9, 0.18, 1.9, 0x283e3e);
    this.box(this.scene, 0, 0.52, 1.45, 5.8, 1.04, 0.6, 0x3d5550);
    this.box(this.scene, 0, 1.08, 1.45, 6, 0.12, 0.85, 0xb5a17a);
    for (const x of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5])
      this.box(this.scene, x, 0.5, 1.12, 0.035, 0.85, 0.015, 0x60756b);
    this.label('NORTH REPUBLIC  /  09', 0, 2.65, 4.77, 3.8, 0.45);
    this.label('DORA  ·  INSPECTION', -1.25, 0.72, 1.125, 1.6, 0.25);
    this.label('ENZO  ·  RECORDS', 1.25, 0.72, 1.125, 1.6, 0.25);
    this.dora = createChinchilla(true);
    this.enzo = createChinchilla(false);
    [this.dora, this.enzo].forEach((c, i) => {
      const rig = new T.Group();
      rig.position.set(i ? 1.3 : -1.3, 0.26, 3.05);
      rig.rotation.y = Math.PI / 2;
      rig.scale.setScalar(1.1);
      rig.add(c.root);
      this.scene.add(rig);
      this.box(
        this.scene,
        i ? 1.3 : -1.3,
        0.2,
        3.05,
        1.5,
        0.22,
        1.65,
        0x7f806b,
      );
    });
    // Equipment on the far left. Exit is the unobstructed horizontal lane z=-1.5.
    this.box(this.scene, -2.3, 0.4, -0.15, 1.1, 0.8, 0.9, 0x546762);
    this.box(this.scene, -2.3, 0.84, -0.15, 1.3, 0.08, 1.1, 0xc0c9bc);
    this.label('SCALE', -2.3, 0.55, -0.62, 0.8, 0.22);
    for (let z = -7; z < 0; z += 1.15)
      this.box(this.scene, 0, 0.006, z, 0.13, 0.014, 0.5, 0xe4d5ac);
    for (const z of [-2.5, -0.55])
      this.box(this.scene, 4, 0.01, z, 8, 0.025, 0.05, 0xe7d8b3);
    this.box(this.scene, 4.5, 0.75, -0.45, 0.22, 1.5, 0.22, 0x3b5550);
    this.gate.position.set(4.5, 1.5, -0.45);
    this.box(this.gate, 0, 0, -1.05, 0.14, 0.14, 2.1, 0xf0dfb9);
    for (let i = 0; i < 4; i++)
      this.box(this.gate, 0, 0, -0.25 - i * 0.5, 0.155, 0.155, 0.22, 0xaf6655);
    this.scene.add(this.gate);
    this.label('ENTRY →', 5.6, 0.1, -1.5, 1.4, 0.35, true);
    for (const x of [-4.5, 7]) {
      this.box(this.scene, x, 1.8, 3, 0.08, 3.6, 0.08, 0x3d514b);
      const light = new T.PointLight(0xffdd99, 12, 8);
      light.position.set(x, 3.5, 3);
      this.scene.add(light);
      this.ball(this.scene, x, 3.5, 3, 0.16, 0.12, 0.16, 0xffe8b0);
    }
    for (let i = 0; i < 3; i++) {
      const paper = this.box(
        this.scene,
        -1.2 + i * 0.9,
        1.151,
        1.4,
        0.62,
        0.02,
        0.43,
        i === 2 ? 0x9aac98 : 0xeee0ba,
      );
      paper.rotation.y = 0.1 - i * 0.15;
    }
    this.scene.add(this.visitor);
    this.camera.position.set(7, 5.5, -10);
    this.camera.lookAt(0.6, 1, 1.5);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }
  box(
    root: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  ball(
    root: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) {
    const m = new T.Mesh(
      new T.SphereGeometry(1, 20, 14),
      new T.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = true;
    root.add(m);
    return m;
  }
  label(
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    floor = false,
  ) {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#243f3d';
    ctx.fillRect(0, 0, 768, 128);
    ctx.fillStyle = '#ecdfb9';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 64);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.rotation.y = Math.PI;
    if (floor) m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
  }
  arrive(species: Species) {
    this.disposeObject(this.visitor);
    this.visitor.clear();
    const colors = {
        chinchilla: 0xb5aab8,
        viscacha: 0xbca383,
        fox: 0xcd8550,
        owl: 0xa28dba,
        viper: 0x91a46d,
      },
      color = colors[species];
    this.ball(this.visitor, 0, 0.6, 0, 0.36, 0.48, 0.3, color);
    this.ball(this.visitor, 0, 1.08, 0.04, 0.29, 0.28, 0.27, color);
    if (species !== 'viper' && species !== 'owl')
      for (const x of [-0.19, 0.19]) {
        this.ball(
          this.visitor,
          x,
          1.45,
          0,
          0.1,
          species === 'viscacha' ? 0.3 : 0.2,
          0.065,
          color,
        );
        this.ball(this.visitor, x, 1.45, 0.06, 0.065, 0.13, 0.02, 0xc79d92);
        this.ball(this.visitor, x, 0.09, 0.12, 0.13, 0.08, 0.21, color);
      }
    for (const x of [-0.14, 0.14]) {
      this.ball(this.visitor, x, 1.12, 0.277, 0.045, 0.06, 0.03, 0x172627);
      this.ball(
        this.visitor,
        x - 0.012,
        1.14,
        0.299,
        0.012,
        0.015,
        0.008,
        0xffffff,
      );
      if (species !== 'viper')
        this.ball(
          this.visitor,
          x * 2,
          0.56,
          0.18,
          species === 'owl' ? 0.13 : 0.09,
          0.15,
          0.09,
          color,
        );
    }
    this.ball(
      this.visitor,
      0,
      0.99,
      0.31,
      species === 'fox' ? 0.13 : 0.065,
      0.06,
      species === 'fox' ? 0.22 : 0.065,
      0xcda18c,
    );
    if (species === 'owl') {
      for (const x of [-0.15, 0.15]) {
        this.ball(this.visitor, x, 0.09, 0.12, 0.1, 0.06, 0.15, 0xb59755);
        this.ball(this.visitor, x, 1.12, 0.24, 0.11, 0.13, 0.055, 0xe0d2a6);
      }
      this.ball(this.visitor, 0, 1, 0.34, 0.06, 0.09, 0.1, 0xc3a058);
    }
    if (species === 'viper')
      for (let i = 0; i < 4; i++)
        this.ball(
          this.visitor,
          Math.sin(i) * 0.06,
          0.15 + i * 0.14,
          -0.04,
          0.32 - i * 0.025,
          0.15,
          0.28 - i * 0.02,
          i % 2 ? 0x738855 : color,
        );
    this.arrival = 0;
    this.elapsed = 0;
    this.decision = null;
    this.complete = false;
    this.visitor.visible = true;
  }
  judge(approve: boolean) {
    this.decision = approve;
    this.elapsed = 0;
  }
  render(time: number, dt: number) {
    animateChinchilla(this.dora, time, 0, true, 1);
    animateChinchilla(this.enzo, time + 0.7, 0, true, 1);
    const target = this.decision === true ? Math.PI / 2 : 0;
    this.gate.rotation.x = T.MathUtils.damp(
      this.gate.rotation.x,
      target,
      5,
      dt,
    );
    if (this.decision === null) {
      this.arrival = Math.min(1, this.arrival + dt * 0.65);
      this.visitor.position.set(
        0,
        this.arrival < 1 ? Math.abs(Math.sin(time * 11)) * 0.045 : 0,
        -5 * (1 - this.arrival),
      );
      this.visitor.rotation.y = 0;
    } else {
      this.elapsed += dt;
      const p = routePose(this.decision, this.elapsed);
      this.visitor.position.set(
        p.x,
        p.walking ? Math.abs(Math.sin(time * 11)) * 0.05 : 0,
        p.z,
      );
      this.visitor.rotation.y = p.heading;
      this.complete = p.done;
      this.visitor.visible = !p.done;
    }
    this.renderer.render(this.scene, this.camera);
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  disposeObject(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ('map' in m && (m as T.MeshBasicMaterial).map)
            (m as T.MeshBasicMaterial).map!.dispose();
          m.dispose();
        }
      }
    });
  }
  dispose() {
    this.observer.disconnect();
    this.disposeObject(this.scene);
    this.renderer.dispose();
  }
}
