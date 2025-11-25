import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import * as THREE from 'three';

/**
 * SpaceSceneComponent
 *
 * Renders a 3D scene containing:
 * - Earth globe with realistic textures (land, water, clouds, atmosphere)
 * - Starfield background sphere
 * - Directional sun light
 * - Location marker with animated transitions
 */
@Component({
  selector: 'app-space-scene',
  standalone: true,
  template: `<canvas #sceneCanvas class="space-scene-canvas"></canvas>`,
  styles: [
    `
      :host {
        display: block;
        position: fixed;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 0;
      }

      .space-scene-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      @media (max-width: 768px) {
        :host {
          left: 0;
          width: 100vw;
        }
      }
    `,
  ],
})
export class SpaceSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() earthRotationsPerSecond = 1 / 60; // Default: one rotation per minute
  @Output() sceneReady = new EventEmitter<void>();

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private earthGroup!: THREE.Group;
  private starSphere: THREE.Mesh | null = null;
  private starTexture: THREE.Texture | null = null;

  private readonly STAR_BG_FOLLOW = 0.18; // subtle parallax follow factor
  private starfieldRotation = 0; // accumulated starfield rotation (annual orbit simulation)
  private lastTimeMs: number | null = null;

  private sunLight!: THREE.PointLight;
  private earthGeometry!: THREE.SphereGeometry;
  private baseMaterial!: THREE.MeshPhongMaterial;
  private waterDiffuseMaterial!: THREE.MeshPhongMaterial;
  private waterSpecMaterial!: THREE.ShaderMaterial;
  private cloudsMaterial!: THREE.MeshPhongMaterial;

  private baseMesh!: THREE.Mesh;
  private atmosphereMesh!: THREE.Mesh;
  private atmosphereMaterial!: THREE.ShaderMaterial;
  private waterDiffuseMesh!: THREE.Mesh;
  private waterSpecMesh!: THREE.Mesh;
  private cloudsMesh!: THREE.Mesh;

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

  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.initScene();
    this.startAnimation();

    // Watch for canvas size changes
    this.resizeObserver = new ResizeObserver(() => {
      const canvas = this.canvasRef.nativeElement;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w > 0 && h > 0) {
        this.handleResize(w, h);
      }
    });
    this.resizeObserver.observe(this.canvasRef.nativeElement);

    this.sceneReady.emit();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    // Dispose geometries and materials
    this.earthGeometry?.dispose();
    this.baseMaterial?.dispose();
    this.waterDiffuseMaterial?.dispose();
    this.waterSpecMaterial?.dispose();
    this.cloudsMaterial?.dispose();

    // Dispose textures
    this.starTexture?.dispose();
  }

  /**
   * Public API: Rotate Earth to show specific coordinates
   */
  public rotateTo(longitude: number, latitude: number, durationMs = 2000): void {
    if (!this.earthGroup) return;

    // Spherical coordinates: latitude (phi), longitude (theta)
    // For Three.js, y is up, z is forward, x is right
    // To center a point (lat, lon) at the front (z+), rotate y by -(lon + 90), x by lat
    // The +90 offset matches the marker's math and texture alignment
    const targetY = THREE.MathUtils.degToRad(-(longitude + 90));
    const targetX = THREE.MathUtils.degToRad(latitude);

    this.rotationAnimation = {
      active: true,
      startTime: performance.now(),
      duration: durationMs,
      startRotation: {
        x: this.earthGroup.rotation.x,
        y: this.earthGroup.rotation.y,
      },
      targetRotation: { x: targetX, y: targetY },
    };

    // Update marker position
    this.currentMarkerPosition = { lat: latitude, lon: longitude };
  }

  /**
   * Public API: Set location marker opacity
   */
  public setMarkerOpacity(opacity: number): void {
    if (this.locationMarker && this.locationMarker.material) {
      (this.locationMarker.material as THREE.SpriteMaterial).opacity = opacity;
    }
  }

  /**
   * Public API: Update Earth rotation speed
   */
  public setEarthRotationsPerSecond(rps: number): void {
    this.earthRotationsPerSecond = THREE.MathUtils.clamp(rps, 0, 60);
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.offsetWidth || window.innerWidth * 0.6;
    const height = canvas.offsetHeight || window.innerHeight;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 3.0); // Center camera on Earth

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 7.15;

    this.setupLighting();
    this.loadStarfield();
    this.createEarth();
    this.createMarker();
  }

  private setupLighting(): void {
    // const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
    // this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x7fbfff, 0x0d1a26, 0.38);
    this.scene.add(hemiLight);

    // Sun (DirectionalLight) much brighter
    this.sunLight = new THREE.PointLight(0xffffff, 250000.0);
    this.sunLight.position.set(400, 400, 500);
    this.sunLight.castShadow = true;
    this.scene.add(this.sunLight);
  }

  private loadStarfield(): void {
    const starLoader = new THREE.TextureLoader();
    starLoader.load(
      'assets/starmap_2020_4k.jpg',
      (starTex) => {
        if ('colorSpace' in starTex) {
          (starTex as any).colorSpace = THREE.SRGBColorSpace;
        }
        starTex.wrapS = THREE.RepeatWrapping;
        starTex.wrapT = THREE.ClampToEdgeWrapping;
        starTex.needsUpdate = true;
        this.starTexture = starTex;

        const starGeo = new THREE.SphereGeometry(50, 64, 64);
        // Make the starfield much darker by lowering color and opacity
        const starMat = new THREE.MeshBasicMaterial({
          map: starTex,
          transparent: false,
          side: THREE.BackSide,
          depthWrite: false,
        });
        this.starSphere = new THREE.Mesh(starGeo, starMat);
        this.starSphere.renderOrder = -10;
        this.starSphere.visible = true;
        this.scene.add(this.starSphere);
      },
      undefined,
      (err) => {
        console.warn('Star map texture not found; continuing without background', err);
      }
    );
  }

  private createEarth(): void {
    // Set up geometry for Earth
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const uv = (geometry.attributes as any).uv as THREE.BufferAttribute;
    if (uv) {
      geometry.setAttribute('uv2', new THREE.BufferAttribute(uv.array, 2));
    }
    this.earthGeometry = geometry;

    // Set up group for Earth and layers
    this.earthGroup = new THREE.Group();

    // Load textures and create materials
    const textureLoader = new THREE.TextureLoader();

    // Base Earth texture
    const earthTexture = textureLoader.load('assets/land_ocean_ice_2048.jpg', (texture) => {
      if ('colorSpace' in texture) {
        (texture as any).colorSpace = THREE.SRGBColorSpace;
      }

      const sourceImg = texture.image as HTMLImageElement;
      const initialMask = this.createWaterMaskFromSource(sourceImg);

      if (this.waterDiffuseMaterial) {
        this.waterDiffuseMaterial.alphaMap = initialMask;
        this.waterDiffuseMaterial.opacity = 0.3; // This affects the specular highlight opacity
        this.waterDiffuseMaterial.needsUpdate = true;
      }

      if (this.waterSpecMaterial) {
        this.waterSpecMaterial.uniforms['maskMap'].value = initialMask;
        if (this.waterSpecMaterial.uniforms['hasMask']) {
          this.waterSpecMaterial.uniforms['hasMask'].value = true;
        }
        this.waterSpecMaterial.needsUpdate = true;
      }
    });

    // Add topography bump map for surface relief
    const topoTexture = new THREE.TextureLoader().load('assets/topography_4096.jpg');
    topoTexture.wrapS = THREE.RepeatWrapping;
    topoTexture.wrapT = THREE.RepeatWrapping;
    topoTexture.needsUpdate = true;

    // Base material with subtle specular for sun reflection and bump map
    this.baseMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: topoTexture,
      bumpScale: 5.145, // Adjust for visible but not exaggerated relief
      color: 0xffffff, // pure white for max sunlight
      emissive: 0x000000,
      //specular: new THREE.Color(0xfff000),
    });

    // Land mesh restored
    this.baseMesh = new THREE.Mesh(this.earthGeometry, this.baseMaterial);
    this.baseMesh.renderOrder = 0;
    this.earthGroup.add(this.baseMesh);

    // Water diffuse overlay and specular only on water, very subtle
    const waterMask = new THREE.TextureLoader().load('assets/land_water_2048.jpg');
    waterMask.wrapS = THREE.RepeatWrapping;
    waterMask.wrapT = THREE.RepeatWrapping;
    waterMask.needsUpdate = true;
    this.waterDiffuseMaterial = new THREE.MeshPhongMaterial({
      color: new THREE.Color(0x336699),
      specular: new THREE.Color(0x4169e1),
      shininess: 500, // This affects the size of the specular highlight. Higher is smaller and sharper.
      specularMap: waterMask,
      alphaMap: waterMask,
      transparent: false,
      blending: THREE.AdditiveBlending,
      depthWrite: true,
    });
    this.waterDiffuseMaterial.polygonOffset = true;
    this.waterDiffuseMaterial.polygonOffsetFactor = -1;
    this.waterDiffuseMaterial.polygonOffsetUnits = -1;
    this.waterDiffuseMesh = new THREE.Mesh(this.earthGeometry, this.waterDiffuseMaterial);
    this.waterDiffuseMesh.renderOrder = 10; // ensure above land
    this.earthGroup.add(this.waterDiffuseMesh);

    // Clouds texture and layers
    const cloudsTexture = new THREE.TextureLoader().load('assets/cloud_combined_2048.jpg');
    cloudsTexture.wrapS = THREE.RepeatWrapping;
    cloudsTexture.wrapT = THREE.RepeatWrapping;
    cloudsTexture.needsUpdate = true;

    // Cloud layer (white, semi-transparent)
    this.cloudsMaterial = new THREE.MeshPhongMaterial({
      map: cloudsTexture,
      alphaMap: cloudsTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.NormalBlending,
      premultipliedAlpha: true,
    });
    this.cloudsMesh = new THREE.Mesh(this.earthGeometry, this.cloudsMaterial);
    this.cloudsMesh.scale.setScalar(1.003); // just above the surface
    this.cloudsMesh.renderOrder = 20;
    this.earthGroup.add(this.cloudsMesh);

    // Add atmosphere: blue at edge, clear at center (limb-brightened)
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0x4db8ff) },
        intensity: { value: 0.6 },
        viewVector: { value: new THREE.Vector3(0, 0, 1) },
        sunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
      },
      vertexShader: `
          uniform vec3 viewVector;
          uniform vec3 sunDir;
          varying float vLimb;
          varying float vSun;
          void main() {
            vec3 vNormal = normalize(normalMatrix * normal);
            float viewDot = dot(vNormal, normalize(viewVector));
            vLimb = 1.0 - pow(abs(viewDot), 0.8); // max at limb, min at center
            vSun = max(0.3, dot(vNormal, normalize(sunDir)));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0.99);
          }
        `,
      fragmentShader: `
          uniform vec3 color;
          uniform float intensity;
          varying float vLimb;
          varying float vSun;
          void main() {
            // Fade in from center, fade out at edge
            float fadeIn = smoothstep(0.1, 0.4, vLimb);
            float fadeOut = 1.0 - smoothstep(0.3, 0.35, vLimb);
            float sunMod = pow(vSun, 1.0); // more opaque where sun shines
            float alpha = fadeIn * fadeOut * intensity * sunMod;
            gl_FragColor = vec4(color, alpha);
          }
        `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmosphereMesh = new THREE.Mesh(this.earthGeometry, this.atmosphereMaterial);
    this.atmosphereMesh.scale.setScalar(1.05);
    this.atmosphereMesh.renderOrder = 30;
    this.earthGroup.add(this.atmosphereMesh);
    this.scene.add(this.earthGroup);
  }

  // Update the viewVector uniform for the atmosphere each frame
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dtSec = this.lastTimeMs == null ? 0 : (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;

    const clampedDt = Math.min(dtSec, 0.1);
    const omega = Math.PI * 2 * this.earthRotationsPerSecond;
    const rotationDelta = omega * clampedDt;

    // Animate clouds and cloud shadows (slow rotation)
    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += 0.0015 * clampedDt; // Realistically slow
    }

    // Earth rotation animation
    if (this.rotationAnimation?.active) {
      const anim = this.rotationAnimation;
      const elapsed = now - anim.startTime;
      const t = Math.min(1, elapsed / anim.duration);
      const eased = this.easeInOutCubic(t);
      this.earthGroup.rotation.x =
        anim.startRotation.x + (anim.targetRotation.x - anim.startRotation.x) * eased;
      this.earthGroup.rotation.y =
        anim.startRotation.y + (anim.targetRotation.y - anim.startRotation.y) * eased;
      if (t >= 1) {
        anim.active = false;
      }
    } else {
      // Continuous rotation
      if (this.earthGroup) {
        this.earthGroup.rotation.y += rotationDelta;
      }
    }

    // Update marker position
    this.updateMarkerPosition();

    // Update shader uniforms for atmosphere
    if (this.atmosphereMaterial && this.camera) {
      // viewVector: from center of Earth to camera
      const viewVec = this.camera.position.clone().sub(this.earthGroup.position).normalize();
      this.atmosphereMaterial.uniforms['viewVector'].value = viewVec;
      // sunDir: from center of Earth to sun
      const sunVec = this.sunLight.position.clone().sub(this.earthGroup.position).normalize();
      this.atmosphereMaterial.uniforms['sunDir'].value = sunVec;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private createMarker(): void {
    // Marker: solid red inner circle with red blur, not affected by lighting
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Outer blur (pure red, more saturated)
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.22, // slightly larger inner radius for more red
      size / 2,
      size / 2,
      size * 0.5
    );
    // gradient.addColorStop(0, 'rgba(255,0,0,1.0)');
    // gradient.addColorStop(0.7, 'rgba(255,0,0,0.3)');
    // gradient.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.5, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Solid red inner circle (bigger)
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.22, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,0,0,1)';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    // SpriteMaterial: not affected by scene lights, color: 0xffffff ensures pure red from texture
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0x666666, // Too much brightness washes out the point color.
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
    });

    this.locationMarker = new THREE.Sprite(material);
    this.locationMarker.scale.set(0.05, 0.05, 1); // larger marker
    this.earthGroup.add(this.locationMarker);
  }

  private createWaterMaskFromSource(img: HTMLImageElement): THREE.Texture {
    // Use the provided water mask image directly
    const maskTexture = new THREE.TextureLoader().load('assets/land_water_2048.jpg');
    maskTexture.wrapS = THREE.RepeatWrapping;
    maskTexture.wrapT = THREE.RepeatWrapping;
    maskTexture.needsUpdate = true;
    return maskTexture;
  }

  private startAnimation(): void {
    this.animate();
  }

  private updateMarkerPosition(): void {
    if (!this.currentMarkerPosition || !this.locationMarker) return;

    const { lat, lon } = this.currentMarkerPosition;
    const radius = 1.015; // Match globe radius

    // Convert to radians
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon + 90); // +90 to match texture alignment

    // Spherical to Cartesian (Three.js: y up, z forward)
    const x = radius * Math.cos(latRad) * Math.sin(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.cos(lonRad);

    // Place in local Earth coordinates (earthGroup handles rotation)
    this.locationMarker.position.set(x, y, z);

    // Fade marker as it rotates away from the viewer (dot with camera forward)
    if (this.camera) {
      // Convert marker position to world space
      const markerWorldPos = this.locationMarker.getWorldPosition(new THREE.Vector3());
      const cameraDirection = new THREE.Vector3()
        .subVectors(this.camera.position, markerWorldPos)
        .normalize();
      const markerNormal = markerWorldPos.clone().normalize();
      // Dot product: >0 facing camera, <0 away
      const facingCamera = markerNormal.dot(cameraDirection);
      let opacity = 1.0;
      if (facingCamera < 0.2) {
        if (facingCamera > -0.2) {
          opacity = (facingCamera + 0.2) / 0.4;
        } else {
          opacity = 0.0;
        }
      }
      const mat = this.locationMarker.material as THREE.SpriteMaterial;
      mat.opacity = opacity;
    }
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private handleResize(width: number, height: number): void {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
