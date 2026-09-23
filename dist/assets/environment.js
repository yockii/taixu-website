/* 场景视觉陈设：星野、远景网格、门心水纹、上升浮尘。每帧更新统一走 update()。 */

import * as THREE from 'three';

export const CYAN = 0x28f1dd;
export const VIOLET = 0x9277ff;

export function buildEnvironment(scene, { mobile }) {
  /* 星野 */
  const starCount = mobile ? 650 : 1700;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const radius = 5 + Math.random() * 55;
    const a = Math.random() * Math.PI * 2;
    starPos.set([Math.cos(a) * radius, (Math.random() - 0.5) * 25, -Math.random() * 65 + 8], i * 3);
    const c = new THREE.Color(Math.random() > 0.75 ? VIOLET : CYAN);
    starCol.set([c.r, c.g, c.b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.035, vertexColors: true, transparent: true, opacity: 0.72
  }));
  scene.add(stars);

  /* 远景网格与随机连线 */
  const grid = new THREE.GridHelper(80, 100, 0x28636a, 0x10262c);
  grid.position.set(0, -5.2, -18);
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  scene.add(grid);

  for (let i = 0; i < 36; i++) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 15, -Math.random() * 40),
      new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 15, -Math.random() * 40)
    ]);
    scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({
      color: i % 4 ? VIOLET : CYAN, transparent: true, opacity: 0.08
    })));
  }

  /* 门心水纹：空间扰动的涟漪与旋臂 */
  const rippleUniforms = {
    uTime: { value: 0 },
    uCyan: { value: new THREE.Color(CYAN) },
    uViolet: { value: new THREE.Color(VIOLET) }
  };
  const rippleMaterial = new THREE.ShaderMaterial({
    uniforms: rippleUniforms, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 vUv;uniform float uTime;uniform vec3 uCyan;uniform vec3 uViolet;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){
        vec2 p=vUv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);
        float sw=a+(1.3-r)*0.9*sin(uTime*.22+r*5.5)+uTime*.10*(1.2-r);
        float ripple=sin(r*24.0-uTime*2.0+sin(sw*3.0+r*9.0)*.85);
        float crest=smoothstep(.45,1.0,ripple);
        float shimmer=noise(vec2(sw*2.2,r*7.0-uTime*.5));
        float arm=smoothstep(.35,.95,sin(sw*2.0-r*10.0+uTime*.7)*.5+.5);
        vec3 col=mix(uViolet*.55,uCyan,clamp(crest+shimmer*.35,0.,1.));
        col+=vec3(.85,1.,.97)*pow(crest,3.0)*.75;
        float core=smoothstep(.55,.18,r);
        float fade=smoothstep(1.02,.80,r)*smoothstep(.02,.26,r);
        float alpha=(0.08+crest*.5+shimmer*.10+arm*.14)*fade*(1.0-core*.9);
        gl_FragColor=vec4(col*(0.75+crest*1.7),alpha);}`
  });
  const membrane = new THREE.Mesh(new THREE.CircleGeometry(1.3, 96), rippleMaterial);
  membrane.position.z = 0.02;
  membrane.renderOrder = 5;
  membrane.visible = false;
  scene.add(membrane);

  /* 上升浮尘 */
  const moteCount = mobile ? 60 : 150;
  const motePos = new Float32Array(moteCount * 3);
  const moteSpd = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    const r = 0.7 + Math.random() * 3.1;
    const a = Math.random() * Math.PI * 2;
    motePos.set([Math.cos(a) * r, -3 + Math.random() * 7.5, Math.sin(a) * r * 0.6 - 0.5], i * 3);
    moteSpd[i] = 0.12 + Math.random() * 0.3;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: 0x9ff5ec, size: 0.045, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(motes);

  return {
    membrane,
    setMembraneVisible(v) { membrane.visible = v; },
    update(t, dt) {
      rippleUniforms.uTime.value = t;
      const mp = moteGeo.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        mp[i * 3 + 1] += moteSpd[i] * dt;
        if (mp[i * 3 + 1] > 4.6) mp[i * 3 + 1] = -3;
      }
      moteGeo.attributes.position.needsUpdate = true;
      stars.rotation.y += dt * 0.003;
    }
  };
}
