// Procedural sun and planets for Project Orbit.
// Everything is generated in shaders (no image textures), lit by the sun at the world origin.

// 3D simplex noise by Ian McEwan / Ashima Arts (MIT), plus fBm helpers.
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float a=0.5,s=0.0;
  for(int i=0;i<5;i++){s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}
  return s;
}
float ridged(vec3 p){
  float a=0.5,s=0.0;
  for(int i=0;i<4;i++){s+=a*(1.0-abs(snoise(p)));p=p*2.1+vec3(4.1,1.3,7.7);a*=0.5;}
  return s;
}
`;

const PLANET_VERT = /* glsl */`
varying vec3 vObj;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main(){
  vObj = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// Shared lighting header: the sun sits at the world origin.
const LIGHT = /* glsl */`
uniform float uTime;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
struct Lit { vec3 N; vec3 L; vec3 V; float ndl; float diff; float mu; };
Lit light(){
  Lit o;
  o.N = normalize(vWorldNormal);
  o.L = normalize(-vWorldPos);
  o.V = normalize(cameraPosition - vWorldPos);
  o.ndl = dot(o.N, o.L);
  o.diff = smoothstep(-0.12, 0.85, o.ndl);
  o.mu = max(dot(o.N, o.V), 0.0);
  return o;
}
const vec3 SUNLIGHT = vec3(1.0, 0.94, 0.86);
`;

const KIND_SHADERS = {
  // Earth-like ocean world with continents, clouds, ice caps and city lights.
  earth: /* glsl */`
  void main(){
    Lit l = light();
    vec3 p = vObj + uSeed;
    float h = fbm(p * 1.9);
    float land = smoothstep(0.02, 0.06, h);
    float lat = abs(vObj.y);
    float dry = smoothstep(-0.1, 0.35, fbm(p * 3.1 + 5.0)) * (1.0 - smoothstep(0.35, 0.6, lat));
    vec3 forest = vec3(0.06, 0.16, 0.05);
    vec3 plains = vec3(0.20, 0.24, 0.09);
    vec3 desert = vec3(0.55, 0.42, 0.24);
    vec3 landCol = mix(mix(forest, plains, smoothstep(0.0, 0.4, h)), desert, dry);
    landCol *= 0.8 + 0.4 * ridged(p * 6.0);
    vec3 ocean = mix(vec3(0.01, 0.05, 0.16), vec3(0.02, 0.12, 0.26), smoothstep(-0.4, 0.04, h));
    vec3 col = mix(ocean, landCol, land);
    float ice = smoothstep(0.80, 0.86, lat + 0.06 * snoise(p * 5.0));
    col = mix(col, vec3(0.85, 0.9, 0.95), ice);
    float cl = fbm(vec3(vObj.x * cos(uTime * 0.012) - vObj.z * sin(uTime * 0.012), vObj.y * 1.6, vObj.x * sin(uTime * 0.012) + vObj.z * cos(uTime * 0.012)) * 2.6 + 11.0);
    float clouds = smoothstep(0.05, 0.45, cl) * 0.9;
    col = mix(col, vec3(0.95), clouds);
    vec3 H = normalize(l.L + l.V);
    float spec = pow(max(dot(l.N, H), 0.0), 70.0) * (1.0 - land) * (1.0 - clouds) * step(0.0, l.ndl);
    vec3 lit = col * l.diff * SUNLIGHT + spec * vec3(0.9, 0.85, 0.7) * 0.8;
    float city = smoothstep(0.55, 0.9, snoise(p * 38.0)) * land * (1.0 - ice) * (1.0 - smoothstep(-0.25, 0.05, l.ndl)) * (1.0 - clouds * 0.7);
    lit += city * vec3(1.0, 0.62, 0.25) * 0.9;
    float rim = pow(1.0 - l.mu, 3.0);
    lit += vec3(0.25, 0.5, 1.0) * rim * smoothstep(-0.3, 0.5, l.ndl) * 0.9;
    lit += col * 0.07 * (1.0 - l.diff) + col * 0.02;
    gl_FragColor = vec4(lit, 1.0);
  }`,

  // Rusty desert world with dark plains, canyons and a small polar cap.
  mars: /* glsl */`
  void main(){
    Lit l = light();
    vec3 p = vObj + uSeed;
    float h = fbm(p * 2.4);
    float r = ridged(p * 5.5);
    vec3 col = mix(vec3(0.42, 0.16, 0.07), vec3(0.72, 0.38, 0.19), smoothstep(-0.4, 0.5, h));
    col = mix(col, vec3(0.24, 0.12, 0.08), smoothstep(0.15, 0.55, fbm(p * 1.6 + 3.0)) * 0.7);
    col *= 0.75 + 0.4 * r;
    float crater = smoothstep(0.72, 0.8, snoise(p * 9.0));
    col *= 1.0 - crater * 0.35;
    float cap = smoothstep(0.88, 0.93, vObj.y + 0.04 * snoise(p * 6.0));
    col = mix(col, vec3(0.92, 0.9, 0.88), cap);
    float limb = mix(0.75, 1.0, pow(l.mu, 0.35));
    vec3 lit = col * l.diff * limb * SUNLIGHT;
    lit += vec3(0.9, 0.5, 0.3) * pow(1.0 - l.mu, 4.0) * smoothstep(-0.2, 0.5, l.ndl) * 0.25;
    lit += col * 0.07 * (1.0 - l.diff) + col * 0.02;
    gl_FragColor = vec4(lit, 1.0);
  }`,

  // Gas and ice giants: latitude bands warped by turbulence.
  neptune: /* glsl */`
  void main(){
    Lit l = light();
    vec3 p = vObj + uSeed;
    float warp = fbm(vec3(p.x * 2.0, p.y * 9.0, p.z * 2.0) + uTime * 0.01) * 0.35;
    float band = sin((vObj.y + warp * 0.25) * 14.0) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.02, 0.06, 0.30), vec3(0.07, 0.19, 0.58), band);
    col = mix(col, vec3(0.30, 0.45, 0.85), smoothstep(0.6, 0.95, fbm(vec3(p.x * 2.5, p.y * 10.0, p.z * 2.5))) * 0.3);
    vec2 sp = vec2(atan(vObj.z, vObj.x) - 0.6, vObj.y + 0.32);
    float spot = 1.0 - smoothstep(0.08, 0.16, length(sp * vec2(0.8, 1.8)));
    col = mix(col, vec3(0.01, 0.02, 0.12), spot * 0.85);
    float limb = mix(0.55, 1.0, pow(l.mu, 0.45));
    vec3 lit = col * l.diff * limb * SUNLIGHT;
    lit += vec3(0.3, 0.5, 1.0) * pow(1.0 - l.mu, 3.0) * smoothstep(-0.3, 0.5, l.ndl) * 0.7;
    lit += col * 0.07 * (1.0 - l.diff) + col * 0.02;
    gl_FragColor = vec4(lit, 1.0);
  }`,

  uranus: /* glsl */`
  void main(){
    Lit l = light();
    vec3 p = vObj + uSeed;
    float warp = fbm(vec3(p.x * 1.5, p.y * 6.0, p.z * 1.5)) * 0.2;
    float band = sin((vObj.y + warp * 0.2) * 9.0) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.42, 0.72, 0.76), vec3(0.58, 0.85, 0.86), band);
    col = mix(col, vec3(0.75, 0.93, 0.92), smoothstep(0.7, 0.95, vObj.y) * 0.6);
    float limb = mix(0.5, 1.0, pow(l.mu, 0.5));
    vec3 lit = col * l.diff * limb * SUNLIGHT;
    lit += vec3(0.5, 0.9, 0.95) * pow(1.0 - l.mu, 3.0) * smoothstep(-0.3, 0.5, l.ndl) * 0.45;
    lit += col * 0.07 * (1.0 - l.diff) + col * 0.02;
    gl_FragColor = vec4(lit, 1.0);
  }`,

  saturn: /* glsl */`
  void main(){
    Lit l = light();
    vec3 p = vObj + uSeed;
    float warp = fbm(vec3(p.x * 2.0, p.y * 12.0, p.z * 2.0) + uTime * 0.008) * 0.25;
    float y = vObj.y + warp * 0.12;
    float b1 = sin(y * 22.0) * 0.5 + 0.5;
    float b2 = sin(y * 47.0 + 1.3) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.62, 0.48, 0.30), vec3(0.86, 0.74, 0.52), b1);
    col = mix(col, vec3(0.74, 0.60, 0.40), b2 * 0.35);
    col = mix(col, vec3(0.52, 0.50, 0.42), smoothstep(0.75, 0.95, abs(vObj.y)) * 0.6);
    float limb = mix(0.55, 1.0, pow(l.mu, 0.45));
    vec3 lit = col * l.diff * limb * SUNLIGHT;
    lit += col * 0.07 * (1.0 - l.diff) + col * 0.02;
    gl_FragColor = vec4(lit, 1.0);
  }`
};

const SUN_VERT = /* glsl */`
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main(){
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const SUN_FRAG = /* glsl */`
uniform float uTime;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main(){
  vec3 p = vObj;
  float t = uTime;
  float large = fbm(p * 3.0 + vec3(0.0, t * 0.02, t * 0.015));
  float cells = 1.0 - abs(snoise(p * 26.0 + vec3(t * 0.08, -t * 0.05, t * 0.06)));
  cells = pow(cells, 2.0);
  float fine = snoise(p * 60.0 - t * 0.12) * 0.5 + 0.5;
  float g = clamp(0.45 * large + 0.45 * cells + 0.15 * fine + 0.25, 0.0, 1.0);
  vec3 hot = vec3(1.0, 0.70, 0.26);
  vec3 warm = vec3(0.95, 0.30, 0.03);
  vec3 col = mix(warm, hot, g);
  float sn = snoise(p * 3.2 + vec3(3.0, t * 0.004, 1.0)) * (0.6 + 0.4 * snoise(p * 1.1 + 9.0));
  float spots = smoothstep(0.70, 0.78, sn);
  float penumbra = smoothstep(0.60, 0.70, sn);
  col *= 1.0 - penumbra * 0.45 - spots * 0.45;
  float facula = smoothstep(0.35, 0.7, fbm(p * 7.0 + 2.0)) * 0.35;
  float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
  float limb = 0.22 + 0.78 * pow(mu, 0.6);
  col = mix(col * vec3(1.0, 0.62, 0.32), col, smoothstep(0.0, 0.55, mu));
  col += facula * (1.0 - mu) * vec3(1.0, 0.7, 0.35);
  gl_FragColor = vec4(col * limb * 1.15, 1.0);
}
`;

// Billboarded corona: soft glow plus slowly moving streamers around the disc.
const CORONA_VERT = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const CORONA_FRAG = /* glsl */`
uniform float uTime;
uniform float uInner;
varying vec2 vUv;
void main(){
  float r = length(vUv);
  if (r < uInner * 0.96) discard;
  float a = atan(vUv.y, vUv.x);
  float d = max(r - uInner, 0.0);
  float rays = fbm(vec3(cos(a) * 2.2, sin(a) * 2.2, uTime * 0.05 - d * 1.5));
  rays = smoothstep(-0.2, 0.7, rays);
  float glow = exp(-d * 12.0) * 0.8 + exp(-d * 5.0) * 0.07;
  float streak = exp(-d * (6.5 - rays * 3.5)) * rays * 0.22;
  float edge = 1.0 - smoothstep(0.82, 1.0, r);
  vec3 col = mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.78, 0.45), exp(-d * 6.0));
  gl_FragColor = vec4(col * (glow + streak) * edge, 1.0);
}
`;

const ATMO_VERT = /* glsl */`
varying vec3 vWorldPos;
varying vec3 vCenter;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
// Glow is brightest right at the planet limb and fades out to the shell edge, only on the day side.
const ATMO_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uStrength;
uniform float uRatio;
varying vec3 vWorldPos;
varying vec3 vCenter;
void main(){
  // direction toward the viewer (camera z axis for orthographic renders)
  vec3 V = isOrthographic ? normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])) : normalize(cameraPosition - vWorldPos);
  vec3 oc = vWorldPos - vCenter;
  float shellR = length(oc);
  float planetR = shellR / uRatio;
  float h = length(oc - dot(oc, V) * V);
  float t = clamp((h - planetR) / (shellR - planetR), 0.0, 1.0);
  float glow = pow(1.0 - t, 2.2) * step(planetR * 0.985, h);
  vec3 L = normalize(-vCenter);
  vec3 side = normalize(oc - dot(oc, V) * V);
  float day = smoothstep(-0.45, 0.6, dot(side, L));
  gl_FragColor = vec4(uColor * glow * day * uStrength, 1.0);
}
`;

const RING_VERT = /* glsl */`
varying vec3 vWorldPos;
varying float vR;
uniform float uInner;
uniform float uOuter;
void main(){
  vR = (length(position.xy) - uInner) / (uOuter - uInner);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const RING_FRAG = /* glsl */`
uniform vec3 uCenter;
uniform float uRadius;
varying vec3 vWorldPos;
varying float vR;
float hash(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float r = clamp(vR, 0.0, 1.0);
  float fine = 0.0;
  for (int i = 0; i < 6; i++) {
    float f = pow(2.0, float(i)) * 9.0;
    fine += hash(floor(r * f) + float(i) * 13.0) / pow(1.6, float(i));
  }
  fine /= 2.4;
  float density = smoothstep(0.0, 0.08, r) * (1.0 - smoothstep(0.92, 1.0, r));
  density *= 0.35 + 0.65 * fine;
  density *= 1.0 - (smoothstep(0.55, 0.57, r) - smoothstep(0.62, 0.64, r)) * 0.92;
  density *= mix(0.55, 1.0, smoothstep(0.1, 0.35, r));
  vec3 col = mix(vec3(0.55, 0.47, 0.36), vec3(0.88, 0.80, 0.66), fine);
  vec3 L = normalize(-vWorldPos);
  vec3 oc = vWorldPos - uCenter;
  float b = dot(oc, L);
  float c = dot(oc, oc) - uRadius * uRadius;
  float shadow = (b < 0.0 && b * b - c > 0.0) ? 0.12 : 1.0;
  gl_FragColor = vec4(col * shadow * 0.9, min(density * 1.05, 0.95));
}
`;

export function createBodies(THREE) {
  const uTime = { value: 0 };

  function sun(radius) {
    const group = new THREE.Group();
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 96, 64),
      new THREE.ShaderMaterial({ uniforms: { uTime }, vertexShader: SUN_VERT, fragmentShader: NOISE + SUN_FRAG })
    );
    group.add(surface);

    const size = radius * 6.0;
    const corona = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.ShaderMaterial({
        uniforms: { uTime, uInner: { value: (radius * 2) / size } },
        vertexShader: CORONA_VERT,
        fragmentShader: NOISE + CORONA_FRAG,
        // drawn first in the opaque pass, so planets and the sun disc always paint over it
        transparent: false,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
      })
    );
    corona.renderOrder = -1;
    group.add(corona);
    return { group, surface, corona };
  }

  function planet(kind, radius, seed = 0) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { uTime, uSeed: { value: seed } },
        vertexShader: PLANET_VERT,
        fragmentShader: NOISE + LIGHT + KIND_SHADERS[kind]
      })
    );
    group.add(body);

    const atmoColor = { earth: [0.35, 0.6, 1.0], neptune: [0.35, 0.55, 1.0], uranus: [0.55, 0.95, 1.0], mars: [0.9, 0.55, 0.35] }[kind];
    if (atmoColor) {
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.12, 48, 32),
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(...atmoColor) }, uStrength: { value: kind === 'mars' ? 0.3 : 0.75 }, uRatio: { value: 1.12 } },
          vertexShader: ATMO_VERT,
          fragmentShader: ATMO_FRAG,
          side: THREE.BackSide,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      group.add(atmo);
    }

    let ring = null;
    if (kind === 'saturn') {
      const inner = radius * 1.3, outer = radius * 2.35;
      ring = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 160, 1),
        new THREE.ShaderMaterial({
          uniforms: {
            uInner: { value: inner }, uOuter: { value: outer },
            uCenter: { value: new THREE.Vector3() }, uRadius: { value: radius }
          },
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2 + THREE.MathUtils.degToRad(24);
      ring.rotation.y = THREE.MathUtils.degToRad(12);
      group.add(ring);
    }

    const tilt = { earth: 23, mars: 25, neptune: 28, uranus: 82, saturn: 18 }[kind] || 0;
    group.rotation.z = THREE.MathUtils.degToRad(tilt);

    const tmp = new THREE.Vector3();
    const scaleTmp = new THREE.Vector3();
    function update() {
      if (!ring) return;
      body.getWorldPosition(tmp);
      body.getWorldScale(scaleTmp);
      ring.material.uniforms.uCenter.value.copy(tmp);
      ring.material.uniforms.uRadius.value = radius * scaleTmp.x;
    }
    return { group, body, ring, update };
  }

  return { uTime, sun, planet };
}
