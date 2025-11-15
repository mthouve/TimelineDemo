import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class EarthGlobeService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private earthGroup!: THREE.Group;
  // Star background sphere (sky)
  private starSphere: THREE.Mesh | null = null;
  private starTexture: THREE.Texture | null = null;
  private readonly STAR_BG_FOLLOW = 0.18; // subtle parallax follow factor (0..1)
  private starfieldRotation = 0; // accumulated starfield rotation (simulates annual orbit)
  private earthRotationCount = 0; // track Earth rotations for annual starfield cycle
  private lastEarthRotationY = 0; // previous Earth Y rotation to detect full rotations
  private sunLight!: THREE.DirectionalLight;
  private earthGeometry!: THREE.SphereGeometry;
  private baseMaterial!: THREE.MeshPhongMaterial;
  private waterDiffuseMaterial!: THREE.MeshPhongMaterial;
  private waterSpecMaterial!: THREE.ShaderMaterial;
  private cloudsMaterial!: THREE.MeshPhongMaterial;
  private cloudShadowMaterial!: THREE.ShaderMaterial;
  private baseMesh!: THREE.Mesh;
  private waterDiffuseMesh!: THREE.Mesh;
  private waterSpecMesh!: THREE.Mesh;
  private cloudsMesh!: THREE.Mesh;
  private cloudShadowMesh!: THREE.Mesh;
  private atmosphereMesh!: THREE.Mesh;
  private atmosphereMaterial!: THREE.ShaderMaterial;
  private innerAtmosphereMaterial!: THREE.ShaderMaterial;

  /**
   * Toggle a debug mode that makes the topography much easier to see by:
   *  - Removing the color texture (so lighting+shading dominate)
   *  - Setting a neutral gray albedo
   *  - Greatly exaggerating bumpScale
   *  - Optionally repositions the sun for more grazing light
   */
  public setTopographyDebugMode(enabled: boolean): void {
    if (!this.baseMaterial) return;
    if (enabled) {
      if (this.baseMaterial.map) {
        this.baseMaterial.map = null;
      }
      this.baseMaterial.color = new THREE.Color(0x888888);
      if (this.baseMaterial.bumpScale < 0.5) {
        this.baseMaterial.bumpScale = 0.6; // dramatic exaggeration
      }
      this.baseMaterial.needsUpdate = true;
      if (this.sunLight) {
        this.sunLight.position.set(5, 0.5, 0); // low angle for raking light
      }
      console.log('[TopoDebug] Enabled. bumpScale=', this.baseMaterial.bumpScale);
    } else {
      // Restore texture (reload if needed)
      if (!this.baseMaterial.map) {
        const loader = new THREE.TextureLoader();
        loader.load('assets/land_ocean_ice_2048.jpg', (tex) => {
          if ('colorSpace' in tex) {
            (tex as any).colorSpace = THREE.SRGBColorSpace;
          }
          this.baseMaterial.map = tex;
          this.baseMaterial.needsUpdate = true;
          console.log('[TopoDebug] Restored base map texture');
        });
      }
      this.baseMaterial.color = new THREE.Color(0xffffff);
      // dial back exaggeration if it was extreme
      if (this.baseMaterial.bumpScale > 0.2) {
        this.baseMaterial.bumpScale = 0.12; // still a bit high until final tuning
      }
      if (this.sunLight) {
        this.sunLight.position.set(5, 3, 5); // original position
      }
      console.log('[TopoDebug] Disabled. bumpScale=', this.baseMaterial.bumpScale);
    }
  }
  private animationFrameId: number | null = null;
  private locationMarker: THREE.Sprite | null = null;
  private currentMarkerPosition: { lat: number; lon: number } | null = null;

  // Rotation animation state
  private rotationAnimation: {
    active: boolean;
    startTime: number;
    duration: number;
    startRotation: { x: number; y: number };
    targetRotation: { x: number; y: number };
  } | null = null;

  constructor() {}

  /**
   * Initialize the Three.js scene, camera, renderer, and Earth sphere
   */
  init(canvas: HTMLCanvasElement, width: number, height: number): void {
    // Init

    // Scene
    this.scene = new THREE.Scene();

    // Camera - wider FOV and further back to show full sphere
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.z = 3.0; // Moved back to show full Earth
    // Offset camera to center Earth between left edge of screen and right edge
    // Canvas is 60vw wide starting at 40vw, so canvas center is at 70vw from left
    // To center Earth at 50vw (middle of screen), shift camera RIGHT (positive X)
    // Offset proportion: (70vw - 50vw) / 60vw = 1/3
    this.camera.position.x = 0.67; // Shift camera right to center Earth on full screen

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true, // Transparent background to blend with starfield
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    // Tone mapping & exposure to better match photographic highlights
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.08); // slight global lift
    this.scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0x7fbfff, 0x0d1a26, 0.18); // subtle skylight fill
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.9); // intensified sun for brighter day side
    this.sunLight.position.set(5, 3, 5);
    this.scene.add(this.sunLight);

    // Star background sphere (wrapped around scene)
    try {
      const starLoader = new THREE.TextureLoader();
      starLoader.load(
        'assets/starmap_2020_4k.jpg',
        (starTex) => {
          if ('colorSpace' in starTex) {
            (starTex as any).colorSpace = THREE.SRGBColorSpace;
          }
          // Use ClampToEdgeWrapping to prevent tiling/repeating the texture
          // This makes the full starmap wrap around the sphere without seams
          starTex.wrapS = THREE.ClampToEdgeWrapping;
          starTex.wrapT = THREE.ClampToEdgeWrapping;
          starTex.needsUpdate = true;
          this.starTexture = starTex;

          const starGeo = new THREE.SphereGeometry(50, 64, 64);
          const starMat = new THREE.MeshBasicMaterial({
            map: starTex,
            side: THREE.BackSide,
            depthWrite: false,
          });
          this.starSphere = new THREE.Mesh(starGeo, starMat);
          this.starSphere.renderOrder = -10; // ensure drawn behind everything
          this.starSphere.visible = true; // enable 3D star background
          this.scene.add(this.starSphere);
        },
        undefined,
        (err) => {
          console.warn('Star map texture not found; continuing without background', err);
        }
      );
    } catch (e) {
      console.warn('Failed to initialize star background', e);
    }

    // Earth sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    // aoMap requires a second set of UVs (uv2). Reuse the primary uv set.
    const uv = (geometry.attributes as any).uv as THREE.BufferAttribute;
    if (uv) {
      geometry.setAttribute('uv2', new THREE.BufferAttribute(uv.array, 2));
    }
    this.earthGeometry = geometry;

    // Load base color map (realistic land/ocean/ice)
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(
      'assets/land_ocean_ice_2048.jpg',
      (texture) => {
        // Ensure correct color space for photographic textures
        if ('colorSpace' in texture) {
          (texture as any).colorSpace = THREE.SRGBColorSpace;
        }
        // Base map loaded
        // Build an initial water mask from the original color source
        const sourceImg = texture.image as HTMLImageElement;
        const initialMask = this.createWaterMaskFromSource(sourceImg);
        // Apply to water overlays: assign masks (specular shader + diffuse only)

        if (this.waterDiffuseMaterial) {
          this.waterDiffuseMaterial.alphaMap = initialMask;
          this.waterDiffuseMaterial.opacity = 0.14; // subtle brighten of oceans on day side
          this.waterDiffuseMaterial.needsUpdate = true;
        }

        // Shader-based specular overlay mask
        if (this.waterSpecMaterial) {
          this.waterSpecMaterial.uniforms['maskMap'].value = initialMask;
          if (this.waterSpecMaterial.uniforms['hasMask']) {
            this.waterSpecMaterial.uniforms['hasMask'].value = true;
          }
          this.waterSpecMaterial.needsUpdate = true;
        }

        // No grayscale conversion - keep natural colors
      },
      undefined,
      (error) => {
        console.warn('Error loading base map:', error);
      }
    );

    // Build Earth as a group of two meshes: base (unlit) + water overlay (lit/specular)
    this.earthGroup = new THREE.Group();

    // Base (land + water) diffuse-lit, no color tint
    this.baseMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      color: 0xffffff, // white (no tint) - shows true colors
      emissive: 0x000000,
      specular: 0x000000, // disable specular on base so land doesn't glint
      shininess: 0,
    });
    this.baseMesh = new THREE.Mesh(this.earthGeometry, this.baseMaterial);
    this.baseMesh.renderOrder = 0;
    this.earthGroup.add(this.baseMesh);

    // Load topography/elevation bump map for surface relief
    const topoUrl = 'assets/earth-topography.png';
    textureLoader.load(
      topoUrl,
      (bumpTex) => {
        // Topography bump loaded

        // Already grayscale, just configure wrapping
        bumpTex.wrapS = THREE.RepeatWrapping;
        bumpTex.wrapT = THREE.RepeatWrapping;
        bumpTex.needsUpdate = true;

        this.baseMaterial.bumpMap = bumpTex;
        this.baseMaterial.bumpScale = 0.35; // Further exaggerated for visibility during tuning
        this.baseMaterial.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn('Topography bump map not found; surface will be smooth', err);
      }
    );

    // (Legacy Phong specular overlay removed; using shader-based layer below)

    // Day-side ocean diffuse brightening overlay (lit diffuse, no specular)
    this.waterDiffuseMaterial = new THREE.MeshPhongMaterial({
      color: new THREE.Color(0x58b3ff), // light ocean tint to add to base
      specular: new THREE.Color(0x000000), // no specular in this layer
      shininess: 0,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.0, // enabled after mask applies
    });
    // Nudge forward to avoid any depth edge artifacts with base mesh
    this.waterDiffuseMaterial.polygonOffset = true;
    this.waterDiffuseMaterial.polygonOffsetFactor = -1;
    this.waterDiffuseMaterial.polygonOffsetUnits = -1;
    this.waterDiffuseMesh = new THREE.Mesh(this.earthGeometry, this.waterDiffuseMaterial);
    this.waterDiffuseMesh.renderOrder = 1;
    this.earthGroup.add(this.waterDiffuseMesh);

    // (Legacy broad Phong lobe removed)

    // Custom shader-based specular overlay for oceans: smaller, brighter sun glint
    this.waterSpecMaterial = new THREE.ShaderMaterial({
      uniforms: {
        lightDir: { value: new THREE.Vector3(0, 0, 1) }, // from surface to sun
        specColor: { value: new THREE.Color(0xffffff) },
        shininess: { value: 180.0 }, // much wider highlight for gradual falloff
        footprint: { value: 1.3 }, // broader footprint for smoother gradient
        brightness: { value: 1.5 }, // keep brightness (spot on)
        maskMap: { value: null as any },
        hasMask: { value: false },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 lightDir; // direction from surface to light
        uniform vec3 specColor;
        uniform float shininess;
        uniform float footprint;
        uniform float brightness;
        uniform sampler2D maskMap;
        uniform bool hasMask;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          float mask = hasMask ? texture2D(maskMap, vUv).r : 1.0;
          if (mask < 0.001) discard;

          vec3 N = normalize(vNormal);
          vec3 V = normalize(cameraPosition - vWorldPosition);
          vec3 L = normalize(lightDir);
          float dotNL = max(dot(N, L), 0.0);
          vec3 H = normalize(L + V);
          float dotNH = max(dot(N, H), 0.0);
          float spec = pow(dotNH, shininess);
          spec *= pow(dotNL, footprint);
          spec *= mask; // apply mask to intensity as well
          // Soft-knee tone map to reduce harsh white peak but keep area bright
          spec = spec / (1.0 + spec); // Reinhard tone mapping
          vec3 color = specColor * (spec * brightness);
          float alpha = spec * brightness;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // Nudge forward slightly and enforce stable draw order
    this.waterSpecMaterial.polygonOffset = true as any;
    (this.waterSpecMaterial as any).polygonOffsetFactor = -1;
    (this.waterSpecMaterial as any).polygonOffsetUnits = -1;
    this.waterSpecMesh = new THREE.Mesh(this.earthGeometry, this.waterSpecMaterial);
    this.waterSpecMesh.renderOrder = 2;
    this.earthGroup.add(this.waterSpecMesh);

    // Clouds layer: alpha-driven white layer on a slightly larger sphere
    textureLoader.load(
      'assets/cloud_combined_2048.jpg',
      (cloudsTex) => {
        if ('colorSpace' in cloudsTex) {
          (cloudsTex as any).colorSpace = THREE.SRGBColorSpace;
        }
        cloudsTex.needsUpdate = true;

        this.cloudsMaterial = new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          alphaMap: cloudsTex,
          alphaTest: 0.12, // discard very faint values to reduce haze
          depthWrite: false,
          blending: THREE.NormalBlending,
          shininess: 0,
          specular: new THREE.Color(0x000000),
          opacity: 0.85,
        });
        this.cloudsMesh = new THREE.Mesh(this.earthGeometry, this.cloudsMaterial);
        this.cloudsMesh.scale.setScalar(1.01);
        this.cloudsMesh.renderOrder = 3; // draw before atmospheres
        this.earthGroup.add(this.cloudsMesh);

        // Cloud shadow overlay: darkens the surface below clouds on day side
        this.cloudShadowMaterial = new THREE.ShaderMaterial({
          uniforms: {
            cloudMap: { value: cloudsTex },
            sunDir: { value: new THREE.Vector3(0, 0, 1) },
            shadowStrength: { value: 0.4 }, // subtle darkening
            shadowSoftness: { value: 0.6 }, // fade at shadow edge
          },
          vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vUv = uv;
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D cloudMap;
            uniform vec3 sunDir;
            uniform float shadowStrength;
            uniform float shadowSoftness;
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              float cloudDensity = texture2D(cloudMap, vUv).r;
              // Only cast shadow on day side
              vec3 N = normalize(vNormal);
              float dayFactor = max(dot(N, -sunDir), 0.0); // sunDir is from sun toward Earth; -sunDir gives direction from surface toward sun for day/night calculation
              dayFactor = smoothstep(0.0, shadowSoftness, dayFactor);
              float shadow = cloudDensity * shadowStrength * dayFactor;
              gl_FragColor = vec4(0.0, 0.0, 0.0, shadow); // black shadow
            }
          `,
          transparent: true,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.ZeroFactor,
          blendDst: THREE.OneMinusSrcAlphaFactor,
          depthWrite: false,
        });
        this.cloudShadowMesh = new THREE.Mesh(this.earthGeometry, this.cloudShadowMaterial);
        this.cloudShadowMesh.scale.setScalar(1.002); // just above surface, below clouds
        this.cloudShadowMesh.renderOrder = 1; // render after base but before water overlays
        this.earthGroup.add(this.cloudShadowMesh);
      },
      undefined,
      (err) => {
        console.warn('Cloud texture not found; continuing without clouds', err);
      }
    );

    // Subtle atmospheric halo (natural blue-white glow)
    const glowColor = new THREE.Color(0xadd8e6); // light blue like real atmosphere
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Vector3(glowColor.r, glowColor.g, glowColor.b) },
        intensity: { value: 2.0 }, // much brighter for visibility
        power: { value: 2.0 }, // softer falloff
        rimStart: { value: 0.3 }, // start immediately at surface (no gap)
        rimEnd: { value: 0.99 }, // end of rim (near silhouette)
        outerStart: { value: 0.92 }, // begin softening the outer border
        outerEnd: { value: 1.0 }, // fully faded at 1.0
        sunDir: { value: new THREE.Vector3(0, 0, 1) }, // filled each frame from directional light
        dayPower: { value: 1.0 },
        minDay: { value: 0.2 }, // higher minimum so night side is also visible
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float power;
        uniform float rimStart;
        uniform float rimEnd;
        uniform float outerStart;
        uniform float outerEnd;
  uniform vec3 sunDir;
  uniform float dayPower;
  uniform float minDay;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          // For BackSide, flip the normal so it points outward
          vec3 n = normalize(-vNormal);
          float rim = 1.0 - dot(viewDir, n);
          rim = clamp(rim, 0.0, 1.0);
          
          // For atmospheric glow: brightest near surface, fades with altitude
          // rim = 0.0 at center (looking straight at surface)
          // rim = 1.0 at silhouette edge (90 degrees)
          // We want glow to be visible throughout but fade toward space
          
          // Start with base visibility across the whole shell
          float density = 1.0;
          
          // Fade out as we approach the outer edge (space)
          // Only fade at high rim values (near silhouette)
          float altitudeFade = 1.0 - smoothstep(0.5, 1.0, rim);
          density *= altitudeFade;
          
          // Apply gentle power curve for smooth falloff
          density = pow(density, power * 0.5);
          
          // Day/night modulation: brightest where atmosphere is illuminated by sun
          vec3 sunDirNorm = normalize(sunDir);
          float sunDot = dot(n, sunDirNorm);
          
          float dayFactor = clamp(sunDot, 0.0, 1.0);
          dayFactor = pow(dayFactor, dayPower);
          dayFactor = mix(minDay, 1.0, dayFactor);
          
          float alpha = intensity * density * dayFactor;
          gl_FragColor = vec4(glowColor * alpha, alpha);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmosphereMesh = new THREE.Mesh(this.earthGeometry, this.atmosphereMaterial);
    this.atmosphereMesh.scale.setScalar(1.03); // thinner shell for more realistic height
    this.atmosphereMesh.renderOrder = 4; // render after clouds and water
    this.earthGroup.add(this.atmosphereMesh);

    // Add inner atmospheric glow (FrontSide) to soften Earth's edges
    this.innerAtmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Vector3(glowColor.r, glowColor.g, glowColor.b) },
        intensity: { value: 0.8 }, // visible but not overpowering
        power: { value: 2.0 }, // softer falloff for wider glow
        sunDir: { value: new THREE.Vector3(0, 0, 1) },
        dayPower: { value: 1.2 },
        minDay: { value: 0.4 }, // keep it visible on night side too
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float power;
        uniform vec3 sunDir;
        uniform float dayPower;
        uniform float minDay;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 n = normalize(vNormal); // FrontSide: use normal as-is
          float rim = 1.0 - dot(viewDir, n);
          rim = clamp(rim, 0.0, 1.0);
          
          // Glow at the edges - start earlier for more visibility
          float edgeGlow = smoothstep(0.3, 1.0, rim);
          float density = pow(edgeGlow, power);
          
          // Day/night modulation
          vec3 sunDirNorm = normalize(sunDir);
          float sunDot = dot(n, sunDirNorm);
          // FrontSide normals point OUTWARD (away from the center), so we need to negate the dot product
          // because sunDir is FROM the sun TO earth; negation makes the day side bright
          float dayFactor = clamp(-sunDot, 0.0, 1.0);
          dayFactor = pow(dayFactor, dayPower);
          dayFactor = mix(minDay, 1.0, dayFactor);
          
          float alpha = intensity * density * dayFactor;
          gl_FragColor = vec4(glowColor * alpha, alpha);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const innerAtmosphereMesh = new THREE.Mesh(this.earthGeometry, this.innerAtmosphereMaterial);
    innerAtmosphereMesh.scale.setScalar(1.003); // very tight to Earth surface
    innerAtmosphereMesh.renderOrder = 5; // render last
    this.earthGroup.add(innerAtmosphereMesh);

    this.scene.add(this.earthGroup);

    // Bathymetry-based water mask disabled (we now rely on initial mask from base map)

    // Start render loop
    this.animate();
  }

  /**
   * Create a canvas texture mask where water is white and land is black.
   * The GEBCO image has land as black and water as blue->white; we treat any non-black as water
   * and clamp to white to drive specular highlights only over oceans.
   */
  private createWaterMaskTexture(image: HTMLImageElement): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const sum = r + g + b; // land is black ~0, water is blue/white > 0
      const isWater = sum > 12; // small threshold to include deep blue
      const v = isWater ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255; // opaque
    }

    // Erode mask by 1px to avoid coastline glints
    this.erodeBinaryMask(imageData.data, c.width, c.height);
    ctx.putImageData(imageData, 0, 0);
    const maskTexture = new THREE.CanvasTexture(c);
    maskTexture.flipY = true; // align with loader default for uv orientation
    maskTexture.wrapS = THREE.RepeatWrapping;
    maskTexture.wrapT = THREE.RepeatWrapping;
    maskTexture.needsUpdate = true;
    return maskTexture;
  }

  /**
   * Erode a 1-channel binary mask encoded in RGBA (R=G=B=0 or 255). Shrinks white regions by 1px.
   */
  private erodeBinaryMask(rgba: Uint8ClampedArray, width: number, height: number): void {
    const copy = new Uint8ClampedArray(rgba); // copy source
    const idx = (x: number, y: number) => (y * width + x) * 4;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y);
        if (copy[i] === 255) {
          // If any 8-neighbor is black, set to black
          let keep = true;
          for (let dy = -1; dy <= 1 && keep; dy++) {
            for (let dx = -1; dx <= 1 && keep; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ni = idx(x + dx, y + dy);
              if (copy[ni] === 0) keep = false;
            }
          }
          if (!keep) {
            rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
          }
        }
      }
    }
  }

  /**
   * Create an AO map that slightly darkens land while leaving water at full intensity.
   * Land (black in source) -> mid-gray (e.g., 170), Water -> white (255).
   */
  // (Removed unused helpers: createLandAOTexture, applyGrayscaleFilter)

  /**
   * Create a quick water mask from the original Blue Marble color image by detecting blue-dominant pixels.
   * This is a fallback if GEBCO bathymetry isn't available. Water -> white, Land -> black.
   */
  private createWaterMaskFromSource(image: HTMLImageElement): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Heuristic: ocean pixels are significantly blue-dominant and not very bright green/red
      const isBlueDominant = b > g + 10 && b > r + 10;
      const isBrightEnough = b > 40; // avoid labeling dark coastline/shadow as water
      const isWater = isBlueDominant && isBrightEnough;
      const v = isWater ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    const maskTexture = new THREE.CanvasTexture(c);
    maskTexture.flipY = true; // align with texture loader defaults
    maskTexture.wrapS = THREE.RepeatWrapping;
    maskTexture.wrapT = THREE.RepeatWrapping;
    maskTexture.needsUpdate = true;
    return maskTexture;
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Update atmosphere sun direction uniform each frame
    if (this.atmosphereMaterial && this.sunLight) {
      const sunPos = new THREE.Vector3();
      this.sunLight.getWorldPosition(sunPos);
      // NEGATED: We need the direction FROM sun TO earth, not earth TO sun
      // This makes the dot product work correctly with the outward normals
      const sunDirection = sunPos.clone().normalize().negate();
      if (this.atmosphereMaterial.uniforms['sunDir']) {
        (this.atmosphereMaterial.uniforms['sunDir'].value as THREE.Vector3).copy(sunDirection);
      }
      // Update inner atmosphere sun direction too
      if (this.innerAtmosphereMaterial?.uniforms?.['sunDir']) {
        (this.innerAtmosphereMaterial.uniforms['sunDir'].value as THREE.Vector3).copy(sunDirection);
      }
      // Update water specular shader with light direction (surface -> sun)
      if (this.waterSpecMaterial?.uniforms?.['lightDir']) {
        (this.waterSpecMaterial.uniforms['lightDir'].value as THREE.Vector3)
          .copy(sunDirection)
          .multiplyScalar(-1);
      }
      // Update cloud shadow shader with sun direction
      if (this.cloudShadowMaterial?.uniforms?.['sunDir']) {
        (this.cloudShadowMaterial.uniforms['sunDir'].value as THREE.Vector3).copy(sunDirection);
      }
      // Debug: log once to verify
      if (!this.atmosphereMaterial.userData['debugLogged']) {
        this.atmosphereMaterial.userData['debugLogged'] = true;
      }
    }

    // Handle rotation animation
    if (this.rotationAnimation?.active) {
      const now = performance.now();
      const elapsed = now - this.rotationAnimation.startTime;
      const progress = Math.min(elapsed / this.rotationAnimation.duration, 1);

      // Ease in-out cubic
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Interpolate rotation
      this.earthGroup.rotation.x =
        this.rotationAnimation.startRotation.x +
        (this.rotationAnimation.targetRotation.x - this.rotationAnimation.startRotation.x) * eased;

      this.earthGroup.rotation.y =
        this.rotationAnimation.startRotation.y +
        (this.rotationAnimation.targetRotation.y - this.rotationAnimation.startRotation.y) * eased;

      if (progress >= 1) {
        this.rotationAnimation.active = false;
      }

      // Update marker position to match Earth rotation
      if (this.locationMarker && this.currentMarkerPosition) {
        this.updateMarkerPosition();
      }

      // Subtle star background follow to preserve depth without distracting motion
      if (this.starSphere) {
        this.starSphere.rotation.x = this.earthGroup.rotation.x * this.STAR_BG_FOLLOW;
        this.starSphere.rotation.y =
          this.earthGroup.rotation.y * this.STAR_BG_FOLLOW + this.starfieldRotation;
      }
    } else {
      // Slow idle rotation when not animating to a target (halved speed)
      this.earthGroup.rotation.y += 0.0205;

      // Annual starfield rotation: advance by 1/365th of Earth's rotation rate
      // This accumulates smoothly without jumps or resets
      this.starfieldRotation += 0.0205 / 365;

      // Keep angles bounded to avoid very large values over time
      this.earthGroup.rotation.y = Math.atan2(
        Math.sin(this.earthGroup.rotation.y),
        Math.cos(this.earthGroup.rotation.y)
      );
      // Also keep starfield rotation bounded for seamless continuity
      this.starfieldRotation = Math.atan2(
        Math.sin(this.starfieldRotation),
        Math.cos(this.starfieldRotation)
      );

      // Update marker position during idle rotation too
      if (this.locationMarker && this.currentMarkerPosition) {
        this.updateMarkerPosition();
      }

      if (this.starSphere) {
        this.starSphere.rotation.x = this.earthGroup.rotation.x * this.STAR_BG_FOLLOW;
        this.starSphere.rotation.y =
          this.earthGroup.rotation.y * this.STAR_BG_FOLLOW + this.starfieldRotation;
      }
    }

    // Subtle cloud drift relative to Earth rotation
    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += 0.0001;
      // Keep shadow layer in sync with clouds
      if (this.cloudShadowMesh) {
        this.cloudShadowMesh.rotation.y = this.cloudsMesh.rotation.y;
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Adjust the perceived blur radius of the sun glint on oceans.
   * radius: 0 (tight, small) .. 1 (wide, soft)
   * Internally remaps to shader uniforms: shininess, footprint, and brightness.
   */
  public setWaterSpecBlur(radius: number): void {
    if (!this.waterSpecMaterial) return;
    const r = THREE.MathUtils.clamp(radius, 0, 1);
    // Map radius to wider highlight by lowering shininess and footprint
    const shininess = THREE.MathUtils.lerp(650, 160, r); // lower = wider
    const footprint = THREE.MathUtils.lerp(5.0, 1.2, r); // lower = broader footprint
    // Maintain perceived brightness as the highlight spreads but avoid blowout
    const brightness = THREE.MathUtils.lerp(1.35, 1.8, r);

    if (this.waterSpecMaterial.uniforms['shininess']) {
      this.waterSpecMaterial.uniforms['shininess'].value = shininess;
    }
    if (this.waterSpecMaterial.uniforms['footprint']) {
      this.waterSpecMaterial.uniforms['footprint'].value = footprint;
    }
    if (this.waterSpecMaterial.uniforms['brightness']) {
      this.waterSpecMaterial.uniforms['brightness'].value = brightness;
    }
    this.waterSpecMaterial.needsUpdate = true;
  }

  /**
   * Compute the shortest signed angular delta from angle a to angle b.
   * Result is in [-PI, PI]. Adding this to a moves along the minimal path to b.
   */
  private shortestAngleDelta(a: number, b: number): number {
    const twoPi = Math.PI * 2;
    let diff = (b - a) % twoPi;
    if (diff > Math.PI) diff -= twoPi;
    if (diff < -Math.PI) diff += twoPi;
    return diff;
  }

  /**
   * Rotate Earth to show a specific longitude/latitude with smooth animation
   * @param lon Longitude in degrees (-180 to 180)
   * @param lat Latitude in degrees (-90 to 90)
   * @param duration Animation duration in milliseconds (default: 2000)
   */
  rotateTo(lon: number, lat: number, duration: number = 2000): void {
    if (!this.earthGroup) return;

    // Convert to radians
    // Y rotation: negative longitude brings location to front
    // X rotation: positive latitude tilts northern hemisphere forward
    const targetLonRad = THREE.MathUtils.degToRad(-lon - 90);
    const targetLatRad = THREE.MathUtils.degToRad(lat);

    // Compute shortest angular difference so we never spin more than necessary
    const currentY = this.earthGroup.rotation.y;
    const currentX = this.earthGroup.rotation.x;
    const deltaY = this.shortestAngleDelta(currentY, targetLonRad);
    const deltaX = this.shortestAngleDelta(currentX, targetLatRad);
    const resolvedTargetY = currentY + deltaY; // at most PI in magnitude
    const resolvedTargetX = currentX + deltaX;

    // Start animation from current rotation
    this.rotationAnimation = {
      active: true,
      startTime: performance.now(),
      duration,
      startRotation: {
        x: currentX,
        y: currentY,
      },
      targetRotation: {
        x: resolvedTargetX,
        y: resolvedTargetY,
      },
    };

    // Create/update location marker
    this.setLocationMarker(lon, lat);
  }

  /**
   * Create or update location marker at specific coordinates
   */
  private setLocationMarker(lon: number, lat: number): void {
    this.currentMarkerPosition = { lat, lon };

    // Remove existing marker if any
    if (this.locationMarker) {
      this.scene.remove(this.locationMarker);
      if (this.locationMarker.material) {
        this.locationMarker.material.dispose();
      }
    }

    // Create canvas for red circle (styled like timeline data point)
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Failed to get 2D context for location marker canvas.');
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, 128, 128);

    // Outer glow (faint red) - adjust for larger dot (2x diameter)
    // Dot radius -> 30; keep a thin halo of ~13px thickness: outer radius ~43
    const gradient = ctx.createRadialGradient(64, 64, 30, 64, 64, 43);
    gradient.addColorStop(0, 'rgba(200, 0, 0, 0.3)');
    gradient.addColorStop(0.6, 'rgba(200, 0, 0, 0.15)');
    gradient.addColorStop(1, 'rgba(200, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    // Solid red circle (darker red, fully opaque) - doubled radius
    ctx.fillStyle = 'rgb(200, 0, 0)';
    ctx.beginPath();
    ctx.arc(64, 64, 30, 0, Math.PI * 2);
    ctx.fill();

    // Create sprite from canvas
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      color: 0xffffff, // Pure white to prevent any color tinting
      blending: THREE.NormalBlending, // Ensure normal blending, not affected by lighting
    });
    this.locationMarker = new THREE.Sprite(material);
    this.locationMarker.scale.set(0.1, 0.1, 1); // Small, like a timeline point

    // Position marker - will be updated in world space during animation
    this.updateMarkerPosition();

    // Add to scene (not as child of Earth) to avoid orange tint
    this.scene.add(this.locationMarker);
  }

  /**
   * Update marker position based on current lat/lon and Earth rotation
   */
  private updateMarkerPosition(): void {
    if (!this.locationMarker || !this.currentMarkerPosition) return;

    const { lat, lon } = this.currentMarkerPosition;
    const radius = 1.0; // On Earth surface

    // Calculate position in Earth's local space
    // The marker is a child of earthGroup, so we position it in local coordinates
    // The Earth's rotation will automatically transform it to world space
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon + 90); // +90 offset to match texture alignment
    const localX = radius * Math.cos(latRad) * Math.sin(lonRad);
    const localY = radius * Math.sin(latRad);
    const localZ = radius * Math.cos(latRad) * Math.cos(lonRad);

    const localPos = new THREE.Vector3(localX, localY, localZ);

    // Convert to world space using Earth's rotation
    const worldPos = localPos.clone();
    worldPos.applyEuler(this.earthGroup.rotation);

    this.locationMarker.position.copy(worldPos);

    // Calculate visibility based on whether marker is facing the camera
    // Simple approach: check if the surface normal at marker position points toward camera
    const markerNormal = worldPos.clone().normalize(); // Normal points outward from Earth center
    const cameraDirection = new THREE.Vector3()
      .subVectors(this.camera.position, worldPos)
      .normalize();

    // Dot product between normal and camera direction
    // > 0 means facing camera (visible)
    // < 0 means facing away (behind Earth)
    const facingCamera = markerNormal.dot(cameraDirection);

    // Create smooth transition
    // Full visibility when facingCamera > 0.2
    // Fade out between 0.2 and -0.2
    // Very dim when facingCamera < -0.2
    let visibilityFactor = 1.0;

    if (facingCamera < 0.2) {
      if (facingCamera > -0.2) {
        // In transition zone
        visibilityFactor = (facingCamera + 0.2) / 0.4; // Smooth fade from 1.0 to 0.0
      } else {
        // Fully behind
        visibilityFactor = 0.0;
      }
    }

    // Store the base opacity if we haven't already (for first frame)
    if (this.locationMarker.userData['baseOpacity'] === undefined) {
      this.locationMarker.userData['baseOpacity'] = 1.0;
    }

    // Apply visibility masking while preserving the fade effect from setMarkerOpacity
    this.locationMarker.material.opacity =
      this.locationMarker.userData['baseOpacity'] * visibilityFactor;
  }

  /**
   * Set marker opacity (0-1) for fade effect
   */
  setMarkerOpacity(opacity: number): void {
    if (this.locationMarker && this.locationMarker.material) {
      const clampedOpacity = Math.max(0, Math.min(1, opacity));
      this.locationMarker.userData['baseOpacity'] = clampedOpacity;
      // The actual opacity will be updated in updateMarkerPosition with masking applied
    }
  }

  /**
   * Update canvas size when window resizes
   */
  resize(width: number, height: number): void {
    if (!this.camera || !this.renderer) {
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** Toggle the atmospheric halo on/off */
  setAtmosphereEnabled(enabled: boolean): void {
    if (!this.atmosphereMesh) return;
    this.atmosphereMesh.visible = enabled;
  }

  /** Adjust atmospheric halo intensity at runtime (0..1 recommended) */
  setAtmosphereIntensity(value: number): void {
    if (!this.atmosphereMaterial) return;
    const v = Math.max(0, Math.min(1, value));
    if (this.atmosphereMaterial.uniforms && this.atmosphereMaterial.uniforms['intensity']) {
      this.atmosphereMaterial.uniforms['intensity'].value = v;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.earthGeometry) {
      this.earthGeometry.dispose();
    }
    if (this.baseMaterial) this.baseMaterial.dispose();
    if (this.waterDiffuseMaterial) this.waterDiffuseMaterial.dispose();
    if (this.waterSpecMaterial) this.waterSpecMaterial.dispose();
    if (this.cloudsMaterial) this.cloudsMaterial.dispose();
    if (this.cloudShadowMaterial) this.cloudShadowMaterial.dispose();
    if (this.atmosphereMaterial) this.atmosphereMaterial.dispose();

    // Dispose star background resources
    if (this.starSphere) {
      if (this.starSphere.geometry) (this.starSphere.geometry as THREE.SphereGeometry).dispose();
      const mat = this.starSphere.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
      this.scene.remove(this.starSphere);
      this.starSphere = null;
    }
    if (this.starTexture) {
      this.starTexture.dispose();
      this.starTexture = null;
    }
  }
}
