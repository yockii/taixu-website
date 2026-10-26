/* 太虚之门 · WebGL2 程序化渲染（零依赖，无模型下载）
   门体由标志几何直接生成：圆环 + 三道横向留白 + S 形门缝，光线步进（SDF）渲染。
   四个通道：
     A 门体与星海（降采样，alpha 存命中深度）
     B 上采样 + GPU 粒子（无状态计算，按 A 的深度做遮挡）
     屏幕：跃迁径向模糊 · 色散 · 颗粒 · 闪白
   镜头由首屏滚动驱动：门前 → 推进 → 穿过门心 → 门后星海。 */

(function () {
  'use strict';

  const canvas = document.getElementById('universe');
  if (!canvas) return;
  const stage = document.getElementById('stage');
  const root = document.documentElement;
  const hud = {
    xyz: document.getElementById('hud-xyz'),
    fps: document.getElementById('hud-fps'),
    warp: document.getElementById('hud-warp'),
    bar: document.getElementById('hud-bar'),
    state: document.getElementById('hud-state'),
    res: document.getElementById('hud-res')
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches;

  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance'
  });
  if (!gl) { root.classList.add('no-webgl'); return; }
  const floatRT = !!gl.getExtension('EXT_color_buffer_float');

  /* ── 着色器 ───────────────────────────────── */

  const COMMON = `#version 300 es
precision highp float;
const float R = 1.6;
const float RT = 0.33;
const vec3 CY = vec3(0.157, 0.945, 0.867);
const vec3 VI = vec3(0.573, 0.467, 1.0);
`;

  const VS_QUAD = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

  const FS_PORTAL = COMMON + `
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
uniform float uTime, uTan, uShift, uIntro, uInside, uSteps;
uniform vec3 uCam;
uniform mat3 uRot, uRA, uRB;

float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float h31(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = .5, s = 0.;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.1; a *= .5; }
  return s;
}
float sdTorus(vec3 p, float r1, float r2) { return length(vec2(length(p.xy) - r1, p.z)) - r2; }

/* 三道留白：比例取自标志（中心 ±11.25/24·R 与 0，半宽 1.25/24·R 与 1.75/24·R） */
float cutField(vec3 p) {
  return max(max(0.083 - abs(p.y - 0.75), 0.117 - abs(p.y)), 0.083 - abs(p.y + 0.75));
}
/* 开场：圆环像一笔描出来，从正上方顺时针生长 */
float reveal(vec3 p) {
  float a01 = fract(atan(p.x, p.y) / 6.28318);
  return (a01 - uIntro * 1.02) * 10.0;
}
float sdMain(vec3 p) { return max(max(sdTorus(p, R, RT), cutField(p)), reveal(p)); }

/* S 形门缝 */
float sdSeam(vec3 p) {
  float y = clamp(p.y, -0.92, 0.86);
  float k = 3.14159 / 0.9;
  float x = -0.3 * sin(k * y) + 0.2 * y / 0.9;
  float dx = -0.3 * k * cos(k * y) + 0.2 / 0.9;
  return length(vec3(abs(p.x - x) / sqrt(1. + dx * dx), abs(p.y - y), p.z)) - 0.006;
}

vec3 nebula(vec3 rd) {
  vec2 q = rd.xy / (abs(rd.z) + 0.6);
  float n = fbm(q * 1.4 + vec2(0., uTime * 0.01));
  float n2 = fbm(q * 3.1 - 7.3 + uTime * 0.005);
  vec3 c = mix(vec3(0.010, 0.014, 0.024), VI * 0.16, smoothstep(0.45, 0.95, n));
  c += CY * 0.06 * smoothstep(0.55, 1.0, n2);
  return c * mix(1.0, 1.7, uInside);
}

vec3 background(vec3 ro, vec3 rd) {
  vec3 c = nebula(rd);
  for (int l = 0; l < 2; l++) {
    float sc = l == 0 ? 160. : 320.;
    vec3 sp = rd * sc;
    vec3 cell = floor(sp);
    float h = h31(cell + float(l) * 17.);
    if (h > 0.982) {
      float d = length(fract(sp) - 0.5);
      float b = smoothstep(0.28, 0., d) * (h - 0.982) / 0.018;
      b *= 0.7 + 0.3 * sin(uTime * (2. + h * 5.) + h * 40.);
      c += mix(vec3(0.85, 0.95, 1.), CY, step(0.6, fract(h * 91.))) * b * (l == 0 ? 1.6 : 0.9);
    }
  }
  if (rd.y < -0.01) {
    float tg = (-3.4 - ro.y) / rd.y;
    vec2 g = (ro + rd * tg).xz * 0.5;
    vec2 w = fwidth(g);
    vec2 gd = abs(fract(g) - 0.5) / max(w, 1e-4);
    float line = 1. - min(min(gd.x, gd.y), 1.);
    c += CY * line * 0.16 * exp(-tg * 0.07);
  }
  return c;
}

vec3 membrane(vec2 q, float r) {
  float tw = 2.4 / (r + 0.3) + uTime * 0.45;
  vec2 qq = mat2(cos(tw), -sin(tw), sin(tw), cos(tw)) * q;
  float n = fbm(qq * 2.3 + uTime * 0.04);
  float arm = 0.5 + 0.5 * sin(2. * atan(qq.y, qq.x) + r * 7. - uTime * 1.2);
  vec3 c = mix(VI * 0.7, CY, smoothstep(0.3, 0.9, n)) * (0.25 + arm * 0.9) * n * 1.4;
  c += CY * smoothstep(0.85, 1.27, r) * 0.55;
  c *= smoothstep(0.0, 0.6, r);
  c += vec3(0.9, 1., 0.98) * exp(-r * r * 160.) * 0.9;
  return c;
}

void main() {
  vec2 uv = (vUv * uRes - 0.5 * uRes) / uRes.y;
  uv.x -= uShift;
  vec3 rd = normalize(uRot * vec3(uv * 2.0 * uTan, -1.0));
  vec3 ro = uCam;

  float tHit = -1.0;
  float glow = 0., glowA = 0., glowB = 0., glowS = 0.;
  /* 包围球：射线不经过门体所在球体时跳过步进 */
  float b = dot(ro, rd);
  float hh = b * b - (dot(ro, ro) - 3.3 * 3.3);
  if (hh > 0.) {
    float sq = sqrt(hh);
    float t = max(-b - sq, 0.);
    float t1 = -b + sq;
    for (int i = 0; i < 120; i++) {
      if (float(i) >= uSteps || t > t1) break;
      vec3 p = ro + rd * t;
      float dm = sdMain(p);
      float da = sdTorus(uRA * p, 2.2, 0.008);
      float db = sdTorus(uRB * p, 2.62, 0.006);
      float ds = sdSeam(p);
      if (dm < 0.0015) { tHit = t; break; }
      float st = max(min(dm, min(min(da, db), ds) + 0.015) * 0.85, 0.006);
      glow += exp(-dm * 5.) * st;
      glowA += exp(-da * 70.) * st;
      glowB += exp(-db * 70.) * st;
      glowS += exp(-ds * 55.) * st;
      t += st;
    }
  }

  vec3 col = background(ro, rd);

  /* 事件视界：门心 z = 0 的圆盘 */
  float tp = -ro.z / rd.z;
  if (tp > 0. && (tHit < 0. || tp < tHit)) {
    vec3 hp = ro + rd * tp;
    float r = length(hp.xy);
    if (r < R - RT * 0.55) {
      float a = smoothstep(R - RT * 0.55, R - RT * 1.4, r) * uIntro;
      col = mix(col, col * 0.25 + membrane(hp.xy, r), a);
    }
  }

  if (tHit > 0.) {
    vec3 p = ro + rd * tHit;
    vec2 e = vec2(0.0015, -0.0015);
    vec3 n = normalize(e.xyy * sdMain(p + e.xyy) + e.yyx * sdMain(p + e.yyx) + e.yxy * sdMain(p + e.yxy) + e.xxx * sdMain(p + e.xxx));
    vec3 L = normalize(vec3(-0.6, 0.8, 0.55));
    float diff = max(dot(n, L), 0.);
    float spec = pow(max(dot(reflect(rd, n), L), 0.), 48.);
    float fres = pow(1. - max(dot(n, -rd), 0.), 3.);
    vec3 refl = nebula(reflect(rd, n));
    /* 浅色金属环：对应标志里的白色圆环，让品牌图形一眼可辨 */
    float wrap = 0.5 + 0.5 * dot(n, L);
    vec3 c = vec3(0.30, 0.34, 0.40) * (0.18 + wrap * wrap * 0.95) + refl * 1.6 + spec * vec3(0.9, 1., 1.) * 0.9;
    c += fres * mix(VI, CY, 0.5 + 0.5 * n.y) * 0.6;
    float ang = atan(p.y, p.x);
    c *= 0.85 + 0.15 * step(0.08, abs(sin(ang * 18.)));                       // 面板分割
    float cut = -cutField(p);
    c += CY * exp(-cut * 90.) * 1.3 * smoothstep(0.6, 1.0, uIntro);            // 留白截面：细的边缘光
    float ph = fract(ang / 6.28318 - uTime * 0.07);
    c += CY * exp(-pow((ph - 0.5) * 16., 2.)) * 0.45;                          // 环向能量脉冲
    col = c;
  }

  col += CY * glow * 0.05 * uIntro;
  col += mix(CY, VI, 0.25) * glowA * 1.1;
  col += VI * glowB * 1.0;
  col += mix(CY, vec3(1.), 0.55) * glowS * 1.8 * smoothstep(0.75, 1.0, uIntro);

  o = vec4(col, tHit > 0. ? tHit / 40. : 1.0);
}`;

  const FS_COPY = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
void main() { o = vec4(texture(uTex, vUv).rgb, 1.0); }`;

  const VS_PARTICLE = COMMON + `
in vec4 aSeed;
uniform float uTime, uIntro, uTan, uShift, uAspect, uPx;
uniform vec3 uCam, uMouse;
uniform mat3 uRot;
out vec3 vCol;
out float vDepth;
out float vA;

void main() {
  vec3 p;
  float life = fract(aSeed.x + uTime * (0.016 + aSeed.y * 0.028));
  bool vortex = aSeed.w < 0.8;
  if (vortex) {
    /* 吸积漩涡：三条旋臂沿螺线向门心收拢，最后穿过门心从背面流出 */
    float r = mix(4.8, 0.1, pow(life, 1.15));
    float arm = floor(aSeed.z * 3.0) * 2.0944;
    float spread = (fract(aSeed.z * 3.0) - 0.5) * mix(0.5, 1.6, fract(aSeed.w * 9.1));
    float th = arm + spread + (4.8 - r) * 1.15 + uTime * 0.1;
    float thick = (fract(aSeed.y * 13.7) - 0.5) * 0.7 * smoothstep(0.2, 3.5, r);
    p = vec3(cos(th) * r, sin(th) * r, thick);
    p.z -= smoothstep(0.8, 1.0, life) * 10.0;
    vA = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.94, 1.0, life));
    vA *= 0.1 + 0.9 * smoothstep(4.8, 1.7, r);
  } else {
    /* 环尘：绕着环体流动的微粒 */
    float dir = fract(aSeed.x * 7.0) > 0.5 ? 1.0 : -1.0;
    float th = aSeed.z * 6.28318 + uTime * (0.08 + aSeed.y * 0.2) * dir;
    float ph = aSeed.x * 6.28318 + uTime * 0.5;
    float rt = RT * 1.3 + aSeed.y * 0.4;
    p = vec3(cos(th) * (R + cos(ph) * rt), sin(th) * (R + cos(ph) * rt), sin(ph) * rt);
    vA = 0.7;
  }
  /* 指针扰动（门所在平面） */
  vec2 dm = p.xy - uMouse.xy;
  float f = exp(-dot(dm, dm) * 1.4) * uMouse.z;
  p.xy += normalize(dm + 1e-4) * f * 0.9;
  p.z += f * 0.7;
  /* 开场：从四周汇聚成形 */
  vec3 from = normalize(fract(aSeed.yzx * vec3(7.13, 3.31, 5.77)) - 0.5 + 1e-3) * (9.0 + aSeed.y * 9.0);
  float k = smoothstep(aSeed.x * 0.4, aSeed.x * 0.4 + 0.6, uIntro);
  p = mix(from, p, k * k * (3. - 2. * k));

  vec3 v = transpose(uRot) * (p - uCam);
  if (v.z > -0.15) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; vA = 0.; return; }
  float iz = 1.0 / -v.z;
  vec2 uv = v.xy * iz / (2.0 * uTan);
  uv.x += uShift;
  gl_Position = vec4(uv.x * 2.0 / uAspect, uv.y * 2.0, 0.0, 1.0);
  float size = (0.012 + aSeed.y * 0.022) * (vortex ? 1.0 : 0.75);
  gl_PointSize = clamp(size * iz * uPx, 1.0, 8.0);
  vDepth = length(v);
  float hot = exp(-length(p.xy) * 0.8);
  vCol = mix(CY, VI, step(0.72, fract(aSeed.z * 17.3))) * (0.45 + hot * 1.5);
  if (fract(aSeed.y * 31.7) > 0.94) vCol = vec3(0.95, 1.0, 0.98) * 1.2;
  vA *= 0.3 + 0.7 * k;
}`;

  const FS_PARTICLE = `#version 300 es
precision highp float;
in vec3 vCol;
in float vDepth;
in float vA;
out vec4 o;
uniform sampler2D uDepthTex;
uniform vec2 uRes;
uniform float uGain;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  float sceneT = texture(uDepthTex, gl_FragCoord.xy / uRes).a * 40.0;
  if (vDepth > sceneT + 0.06) discard;
  o = vec4(vCol * a * vA * uGain, 1.0);
}`;

  const FS_POST = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uRes, uCenter;
uniform float uWarp, uFlash, uTime;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  vec2 dir = uv - uCenter;
  float ca = 0.0018 + uWarp * 0.012;
  vec3 col = vec3(texture(uTex, uv + dir * ca).r, texture(uTex, uv).g, texture(uTex, uv - dir * ca).b);
  if (uWarp > 0.01) {
    vec3 acc = vec3(0.);
    float ws = 0.;
    for (int i = 0; i < 12; i++) {
      float f = float(i) / 11.;
      float w = 1. - f * 0.7;
      acc += texture(uTex, uv - dir * f * 0.09 * uWarp).rgb * w;
      ws += w;
    }
    col = mix(col, acc / ws * (1. + uWarp * 0.6), clamp(uWarp * 1.6, 0., 1.));
  }
  col = 1. - exp(-col * 1.25);
  vec2 vq = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.);
  col *= mix(1., smoothstep(1.25, 0.25, length(vq)), 0.55);
  col += (h(uv * uRes + fract(uTime * 7.3) * 91.) - 0.5) * 0.03;
  col = mix(col, vec3(0.93, 1., 0.98), clamp(uFlash, 0., 1.));
  o = vec4(col, 1.);
}`;

  /* ── GL 工具 ──────────────────────────────── */

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('着色器编译失败：' + log);
    }
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('着色器链接失败：' + gl.getProgramInfoLog(p));
    const locs = {};
    return {
      p,
      u(name) {
        if (!(name in locs)) locs[name] = gl.getUniformLocation(p, name);
        return locs[name];
      }
    };
  }
  function target(w, h, hdr) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  let P;
  try {
    P = {
      portal: program(VS_QUAD, FS_PORTAL),
      copy: program(VS_QUAD, FS_COPY),
      particle: program(VS_PARTICLE, FS_PARTICLE),
      post: program(VS_QUAD, FS_POST)
    };
  } catch (err) {
    console.warn(err);
    root.classList.add('no-webgl');
    return;
  }

  const quadVAO = gl.createVertexArray();

  /* 粒子种子：每个粒子一组随机数，运动全部在顶点着色器里算 */
  const COUNT = mobile ? 24576 : 98304;
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const particleVAO = gl.createVertexArray();
  gl.bindVertexArray(particleVAO);
  const seedBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  const aSeed = gl.getAttribLocation(P.particle.p, 'aSeed');
  gl.enableVertexAttribArray(aSeed);
  gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /* ── 尺寸与自适应质量 ─────────────────────── */

  const DPR = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  let scaleA = mobile ? 0.42 : 0.55;
  let steps = mobile ? 64 : 96;
  let W = 0, H = 0, A = null, B = null;

  function resize() {
    W = Math.max(2, Math.round(innerWidth * DPR));
    H = Math.max(2, Math.round(innerHeight * DPR));
    canvas.width = W;
    canvas.height = H;
    rebuildTargets();
  }
  function rebuildTargets() {
    [A, B].forEach((t) => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } });
    A = target(Math.max(2, Math.round(W * scaleA)), Math.max(2, Math.round(H * scaleA)), floatRT);
    B = target(W, H, floatRT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (hud.res) hud.res.textContent = A.w + '×' + A.h;
  }
  resize();
  addEventListener('resize', resize);

  /* ── 矩阵（列主序 mat3） ──────────────────── */

  const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
  const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
  function mul(a, b) {
    const o = new Array(9);
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 3; r++) {
        o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
      }
    }
    return o;
  }
  // camera→world 旋转后的向量转回相机空间：R^T * v
  const applyT = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
  const apply = (m, v) => [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
  ];

  /* ── 输入 ─────────────────────────────────── */

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  const ptr = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1, active: 0, last: 0 };
  addEventListener('pointermove', (e) => {
    ptr.x = e.clientX / innerWidth * 2 - 1;
    ptr.y = -(e.clientY / innerHeight) * 2 + 1;
    ptr.px = e.clientX; ptr.py = e.clientY;
    ptr.last = performance.now();
  }, { passive: true });

  function stageProgress() {
    if (!stage) return 1;
    const total = stage.offsetHeight - innerHeight;
    if (total <= 0) return scrollY > 0 ? 1 : 0;
    return clamp(-stage.getBoundingClientRect().top / total);
  }

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; root.classList.add('no-webgl'); });

  /* ── 主循环 ───────────────────────────────── */

  const t0 = performance.now();
  let last = t0;
  let lastScroll = scrollY;
  let scrollVel = 0;
  let camVel = 0;
  let prevZ = null;
  let frames = 0, fpsT = t0, slowFrames = 0, skip = false;
  let lastVars = '';

  function setStageVars(p) {
    if (!stage) return;
    const heroO = 1 - smooth(0.04, 0.3, p);
    const hudO = 1 - smooth(0.86, 0.98, p);
    const arriveO = smooth(0.8, 0.92, p);
    const key = p.toFixed(3) + heroO.toFixed(3) + arriveO.toFixed(3);
    if (key === lastVars) return;
    lastVars = key;
    stage.style.setProperty('--p', p.toFixed(4));
    stage.style.setProperty('--hero-o', heroO.toFixed(3));
    stage.style.setProperty('--hud-o', hudO.toFixed(3));
    stage.style.setProperty('--arrive-o', arriveO.toFixed(3));
  }
  function stateLabel(p) {
    if (p < 0.1) return 'STANDBY · 门已就绪';
    if (p < 0.6) return 'APPROACH · 接近门心';
    if (p < 0.84) return 'TRANSIT · 穿越中';
    return 'INSIDE · 已进入太虚';
  }

  function frame(now) {
    if (lost) return;
    requestAnimationFrame(frame);
    render(now);
  }

  function render(now) {
    const dtRaw = (now - last) / 1000;
    last = now;
    const dt = Math.min(dtRaw, 0.05);
    const time = (now - t0) / 1000 * (reduced ? 0.25 : 1);

    const sy = scrollY;
    scrollVel = lerp(scrollVel, Math.abs(sy - lastScroll) / Math.max(dtRaw, 0.001), 1 - Math.exp(-dt * 6));
    lastScroll = sy;
    const p = reduced ? 0 : stageProgress();
    const beyond = stage ? Math.max(0, sy - (stage.offsetTop + stage.offsetHeight - innerHeight)) : 0;

    // 远离首屏后降到 30 帧
    if (beyond > innerHeight * 1.2) { skip = !skip; if (skip) return; }

    // 镜头路径
    const s = smooth(0.08, 0.86, p);
    const aspect0 = innerWidth / innerHeight;
    const startZ = mobile ? 9.5 : lerp(9.2, 7.4, clamp((aspect0 - 1.0) / 0.8));   // 窄屏时退远，别压住标题
    let camZ = lerp(startZ, -6.5, s * s * s);
    camZ -= Math.min(beyond * 0.003, 22);
    if (prevZ !== null) camVel = lerp(camVel, Math.abs(camZ - prevZ) / Math.max(dt, 0.001), 1 - Math.exp(-dt * 10));
    prevZ = camZ;
    ptr.sx = lerp(ptr.sx, ptr.x, 1 - Math.exp(-dt * 2.5));
    ptr.sy = lerp(ptr.sy, ptr.y, 1 - Math.exp(-dt * 2.5));
    const par = (1 - s) * (reduced ? 0.3 : 1);
    const cam = [ptr.sx * 0.5 * par, ptr.sy * 0.3 * par + Math.sin(time * 0.35) * 0.06 * par, camZ];
    const yaw = -ptr.sx * 0.07 * (1 - s * 0.6);
    const pitch = ptr.sy * 0.05 * (1 - s * 0.6);
    const rot = mul(ry(yaw), rx(pitch));
    const fov = (46 + 30 * smooth(0.5, 0.82, p) * (1 - smooth(0.86, 1, p) * 0.6)) * Math.PI / 180;
    const tanH = Math.tan(fov / 2);
    const aspect = W / H;
    const shift = mobile ? 0 : (1 - smooth(0.04, 0.45, p)) * 0.24 * Math.min(aspect / 1.6, 1.2);
    const inside = smooth(0.5, -0.5, camZ);

    const intro = reduced ? 1 : clamp((now - t0) / 2800);
    const introE = 1 - Math.pow(1 - intro, 3);

    // 跃迁强度：镜头速度 + 门后的滚动速度
    const warp = reduced ? 0 : clamp(Math.max(camVel / 14, beyond > 0 ? scrollVel / 3200 : 0));
    const flash = reduced ? 0 : Math.exp(-Math.pow(camZ / 0.45, 2)) * 0.8 + (intro < 1 ? Math.exp(-Math.pow((intro - 0.06) / 0.05, 2)) * 0.35 : 0);

    // 指针投到门平面（z = 0）
    let mouse = [0, 0, 0];
    const idle = (now - ptr.last) / 1000;
    if (ptr.px >= 0 && camZ > 0.5) {
      const uvx = (ptr.px * DPR - 0.5 * W) / H - shift;
      const uvy = (0.5 * H - ptr.py * DPR) / H;
      const d = apply(rot, [uvx * 2 * tanH, uvy * 2 * tanH, -1]);
      const tz = -cam[2] / d[2];
      if (tz > 0) mouse = [cam[0] + d[0] * tz, cam[1] + d[1] * tz, clamp(1.2 - idle * 0.5) * (1 - s)];
    }

    // 门心在屏幕上的位置（径向模糊中心）
    let center = [0.5, 0.5];
    const vc = applyT(rot, [-cam[0], -cam[1], -cam[2]]);
    if (vc[2] < -0.2) {
      const ux = vc[0] / -vc[2] / (2 * tanH) + shift;
      const uy = vc[1] / -vc[2] / (2 * tanH);
      center = [clamp(ux / aspect + 0.5, -0.5, 1.5), clamp(uy + 0.5, -0.5, 1.5)];
    }

    const RA = mul(rx(time * 0.23), ry(0.9));
    const RB = mul(ry(-time * 0.17), rx(1.2));

    /* 通道 A：门体与星海 */
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
    gl.viewport(0, 0, A.w, A.h);
    gl.disable(gl.BLEND);
    gl.useProgram(P.portal.p);
    gl.bindVertexArray(quadVAO);
    gl.uniform2f(P.portal.u('uRes'), A.w, A.h);
    gl.uniform1f(P.portal.u('uTime'), time);
    gl.uniform1f(P.portal.u('uTan'), tanH);
    gl.uniform1f(P.portal.u('uShift'), shift);
    gl.uniform1f(P.portal.u('uIntro'), introE);
    gl.uniform1f(P.portal.u('uInside'), inside);
    gl.uniform1f(P.portal.u('uSteps'), steps);
    gl.uniform3f(P.portal.u('uCam'), cam[0], cam[1], cam[2]);
    gl.uniformMatrix3fv(P.portal.u('uRot'), false, rot);
    gl.uniformMatrix3fv(P.portal.u('uRA'), false, RA);
    gl.uniformMatrix3fv(P.portal.u('uRB'), false, RB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* 通道 B：上采样 + 粒子 */
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.copy.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(P.copy.u('uTex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.particle.p);
    gl.bindVertexArray(particleVAO);
    gl.uniform1i(P.particle.u('uDepthTex'), 0);
    gl.uniform2f(P.particle.u('uRes'), W, H);
    gl.uniform1f(P.particle.u('uGain'), floatRT ? 0.5 : 0.38);
    gl.uniform1f(P.particle.u('uTime'), time);
    gl.uniform1f(P.particle.u('uIntro'), introE);
    gl.uniform1f(P.particle.u('uTan'), tanH);
    gl.uniform1f(P.particle.u('uShift'), shift);
    gl.uniform1f(P.particle.u('uAspect'), aspect);
    gl.uniform1f(P.particle.u('uPx'), H / (2 * tanH));
    gl.uniform3f(P.particle.u('uCam'), cam[0], cam[1], cam[2]);
    gl.uniform3f(P.particle.u('uMouse'), mouse[0], mouse[1], mouse[2]);
    gl.uniformMatrix3fv(P.particle.u('uRot'), false, rot);
    gl.drawArrays(gl.POINTS, 0, beyond > innerHeight * 1.2 ? COUNT >> 1 : COUNT);
    gl.disable(gl.BLEND);

    /* 屏幕：后期 */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.post.p);
    gl.bindVertexArray(quadVAO);
    gl.bindTexture(gl.TEXTURE_2D, B.tex);
    gl.uniform1i(P.post.u('uTex'), 0);
    gl.uniform2f(P.post.u('uRes'), W, H);
    gl.uniform2f(P.post.u('uCenter'), center[0], center[1]);
    gl.uniform1f(P.post.u('uWarp'), warp);
    gl.uniform1f(P.post.u('uFlash'), flash);
    gl.uniform1f(P.post.u('uTime'), time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* HUD */
    setStageVars(p);
    if (hud.xyz) hud.xyz.textContent = 'X ' + cam[0].toFixed(2) + '  Y ' + cam[1].toFixed(2) + '  Z ' + cam[2].toFixed(2);
    if (hud.warp) hud.warp.textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
    if (hud.bar) hud.bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    if (hud.state) { const st = stateLabel(p); if (hud.state.textContent !== st) hud.state.textContent = st; }

    /* 帧率与自适应质量：持续掉帧就降低门体通道分辨率 */
    frames++;
    // 只把 25–200ms 的帧算作“慢”：更长的间隔是标签页被节流，不是 GPU 跑不动
    if (dtRaw > 1 / 40 && dtRaw < 0.2) slowFrames++;
    if (now - fpsT > 1000) {
      if (hud.fps) hud.fps.textContent = frames;
      if (slowFrames > frames * 0.5 && scaleA > 0.3 && !skip) {
        scaleA = Math.max(0.3, scaleA - 0.08);
        steps = Math.max(56, steps - 12);
        rebuildTargets();
      }
      frames = 0; slowFrames = 0; fpsT = now;
    }
  }

  /* 调试：同步渲染 n 帧并等 GPU 完成，返回每帧毫秒数（不受标签页节流影响） */
  window.__void = {
    bench(n = 30, scale) {
      if (scale) { scaleA = scale; rebuildTargets(); }
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const s = performance.now();
      for (let i = 0; i < n; i++) render(performance.now());
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { msPerFrame: +((performance.now() - s) / n).toFixed(2), A: A.w + 'x' + A.h, B: W + 'x' + H, particles: COUNT, steps };
    }
  };

  root.classList.add('scene-ready');
  requestAnimationFrame(frame);
})();
