import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  NgZone,
} from '@angular/core';
import * as THREE from 'three';

type LunarLongitudeDistanceTerm = [
  d: number,
  m: number,
  mp: number,
  f: number,
  l: number,
  r: number,
];
type LunarLatitudeTerm = [d: number, m: number, mp: number, f: number, b: number];

const LUNAR_LONGITUDE_DISTANCE_TERMS: LunarLongitudeDistanceTerm[] = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

const LUNAR_LATITUDE_TERMS: LunarLatitudeTerm[] = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777],
  [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596],
  [2, -1, 1, -1, 491],
  [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422],
  [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351],
  [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315],
  [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229],
  [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220],
  [2, 1, -1, -1, -220],
  [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177],
  [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166],
  [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119],
  [4, -1, 0, -1, 115],
  [2, -2, 0, 1, 107],
];

/**
 * SpaceSceneComponent
 *
 * Renders a 3D scene containing:
 * - Earth globe with realistic textures (land, water, clouds, atmosphere)
 * - Starfield background sphere
 * - Orbiting sun light and visible sun disc
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

  @Input() earthRotationsPerSecond = 0; // Default: time progression off
  @Output() sceneReady = new EventEmitter<void>();

  constructor(private ngZone: NgZone) {}

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private earthGroup!: THREE.Group;
  private starSphere: THREE.Mesh | null = null;
  private starTexture: THREE.Texture | null = null;

  private lastTimeMs: number | null = null;

  private sunLight!: THREE.PointLight;
  private sunSprite: THREE.Sprite | null = null;
  private sunTexture: THREE.CanvasTexture | null = null;
  private sunSpriteMaterial: THREE.SpriteMaterial | null = null;
  private sunOrbitPhase = 0;
  private sunYearPhase = 0;
  private currentCelestialYearFraction = 0;
  private timeAnimation: {
    active: boolean;
    startTime: number;
    duration: number;
    startCelestialYearFraction: number;
    targetCelestialYearFraction: number;
    startSunOrbitPhase: number;
    targetSunOrbitPhase: number;
    startSunYearPhase: number;
    targetSunYearPhase: number;
  } | null = null;
  private readonly TWO_PI = Math.PI * 2;
  private readonly DAYS_PER_SOLAR_YEAR = 365.2422;
  private readonly AXIAL_TILT_RAD = THREE.MathUtils.degToRad(23.44);
  private readonly SUN_LIGHT_DISTANCE = 650;
  private readonly SUN_VISUAL_ORBIT_RADIUS = 3.8;
  private readonly SUN_CAMERA_HIDE_PAD = 0.2;
  private readonly MOON_ORBIT_RADIUS = 1.45;
  private readonly MOON_MEAN_DISTANCE_KM = 385000.56;
  private readonly MOON_RADIUS = 0.075;
  private readonly ECLIPSE_SHADOW_RADIUS = 0.32;
  private readonly ECLIPSE_SHADOW_INNER_ANGLE_RAD = THREE.MathUtils.degToRad(2);
  private readonly ECLIPSE_SHADOW_OUTER_ANGLE_RAD = THREE.MathUtils.degToRad(10);
  private readonly CLOUD_BASE_SPEED_MPH = 8;
  private readonly EARTH_EQUATORIAL_CIRCUMFERENCE_MILES = 24901;
  private readonly SIMULATED_DAY_SECONDS_AT_1X = 15;
  private readonly CLOUD_DRIFT_ROTATIONS_PER_SECOND_AT_1X =
    (this.CLOUD_BASE_SPEED_MPH * 24) /
    (this.EARTH_EQUATORIAL_CIRCUMFERENCE_MILES * this.SIMULATED_DAY_SECONDS_AT_1X);
  private readonly CLOUD_DRIFT_Y_VARIATION_RADIANS = 0.045;
  private readonly CLOUD_DRIFT_Y_VARIATION_SECONDS = 60;
  private readonly STAR_ANNUAL_AXIS = new THREE.Vector3(0, 1, 0);
  private readonly SHADOW_PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
  private readonly localSunDirection = new THREE.Vector3();
  private readonly worldSunDirection = new THREE.Vector3();
  private readonly localMoonDirection = new THREE.Vector3();
  private readonly worldMoonDirection = new THREE.Vector3();
  private readonly localShadowDirection = new THREE.Vector3();
  private readonly visualSunPosition = new THREE.Vector3();
  private readonly viewVector = new THREE.Vector3();
  private readonly sunVector = new THREE.Vector3();
  private readonly markerWorldPosition = new THREE.Vector3();
  private readonly markerCameraDirection = new THREE.Vector3();
  private readonly markerNormal = new THREE.Vector3();
  private readonly annualStarRotation = new THREE.Quaternion();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly pointerHitLocal = new THREE.Vector3();
  private earthGeometry!: THREE.SphereGeometry;
  private moonGeometry!: THREE.SphereGeometry;
  private moonTexture: THREE.Texture | null = null;
  private moonMaterial!: THREE.MeshPhongMaterial;
  private eclipseShadowGeometry!: THREE.PlaneGeometry;
  private eclipseShadowTexture: THREE.CanvasTexture | null = null;
  private eclipseShadowMaterial!: THREE.MeshBasicMaterial;
  private baseMaterial!: THREE.MeshPhongMaterial;
  private waterDiffuseMaterial!: THREE.MeshPhongMaterial;
  private waterSpecMaterial!: THREE.ShaderMaterial;
  private cloudsMaterial!: THREE.MeshPhongMaterial;

  private baseMesh!: THREE.Mesh;
  private cloudsGroup!: THREE.Group;
  private atmosphereMesh!: THREE.Mesh;
  private atmosphereMaterial!: THREE.ShaderMaterial;
  private waterDiffuseMesh!: THREE.Mesh;
  private waterSpecMesh!: THREE.Mesh;
  private cloudsMesh!: THREE.Mesh;
  private moonMesh: THREE.Mesh | null = null;
  private eclipseShadowMesh: THREE.Mesh | null = null;
  private earthTextureReady = {
    base: false,
    topography: false,
    water: false,
    clouds: false,
  };

  private animationFrameId: number | null = null;
  private locationMarker: THREE.Sprite | null = null;
  private currentMarkerPosition: { lat: number; lon: number } | null = null;
  private cloudDriftRotationsPerSecond = this.CLOUD_DRIFT_ROTATIONS_PER_SECOND_AT_1X;
  private cloudDriftElapsedSeconds = 0;
  private pointerInteraction: {
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startRotationX: number;
    startRotationY: number;
    dragging: boolean;
  } | null = null;

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
    this.registerPointerInteraction();
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

    this.unregisterPointerInteraction();

    if (this.renderer) {
      this.renderer.dispose();
    }

    // Dispose geometries and materials
    this.earthGeometry?.dispose();
    this.baseMaterial?.dispose();
    this.waterDiffuseMaterial?.dispose();
    this.waterSpecMaterial?.dispose();
    this.cloudsMaterial?.dispose();
    this.sunSpriteMaterial?.dispose();
    this.moonGeometry?.dispose();
    this.moonMaterial?.dispose();
    this.eclipseShadowGeometry?.dispose();
    this.eclipseShadowMaterial?.dispose();

    // Dispose textures
    this.starTexture?.dispose();
    this.sunTexture?.dispose();
    this.moonTexture?.dispose();
    this.eclipseShadowTexture?.dispose();
  }

  /**
   * Public API: Rotate Earth to show specific coordinates
   */
  public rotateTo(
    longitude: number,
    latitude: number,
    durationMs = 2000,
    elapsedYears = 0,
    targetYearFraction?: number,
    targetLocalTimeHours?: number
  ): void {
    if (!this.earthGroup) return;

    this.startRotationTo(longitude, latitude, durationMs);

    if (targetYearFraction != null && Number.isFinite(targetYearFraction)) {
      this.startTimeTransition(
        targetYearFraction,
        elapsedYears,
        durationMs,
        this.sunOrbitPhaseForLocalTime(longitude, targetLocalTimeHours)
      );
    } else {
      this.startTimeTransition(
        this.currentCelestialYearFraction + elapsedYears,
        elapsedYears,
        durationMs,
        this.sunOrbitPhaseForLocalTime(longitude, targetLocalTimeHours)
      );
    }

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
   * Public API: Update simulated day-cycle speed
   */
  public setEarthRotationsPerSecond(rps: number): void {
    const nextRps = THREE.MathUtils.clamp(rps, 0, 60);
    this.earthRotationsPerSecond = nextRps;
    if (this.earthRotationsPerSecond === 0) {
      this.timeAnimation = null;
    }
  }

  public setCloudDriftMultiplier(multiplier: number): void {
    const safeMultiplier = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 0;
    this.cloudDriftRotationsPerSecond =
      safeMultiplier * this.CLOUD_DRIFT_ROTATIONS_PER_SECOND_AT_1X;
  }

  public setCelestialYearFraction(yearFraction: number): void {
    if (!Number.isFinite(yearFraction)) return;
    this.timeAnimation = null;
    this.setCelestialPhasesFromYearFraction(yearFraction);
    this.applySunOrbit();
  }

  private registerPointerInteraction(): void {
    window.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
    window.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    window.addEventListener('pointerup', this.handlePointerUp, { passive: false });
    window.addEventListener('pointercancel', this.handlePointerCancel);
  }

  private unregisterPointerInteraction(): void {
    window.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);
    document.body.style.cursor = '';
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.earthGroup || !this.camera || !this.baseMesh) return;
    if (!this.pointerHitsEarth(event.clientX, event.clientY)) return;

    event.preventDefault();
    this.pointerInteraction = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startRotationX: this.earthGroup.rotation.x,
      startRotationY: this.earthGroup.rotation.y,
      dragging: false,
    };
    document.body.style.cursor = 'grabbing';
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const interaction = this.pointerInteraction;
    if (!interaction || event.pointerId !== interaction.pointerId || !this.earthGroup) return;

    event.preventDefault();
    interaction.lastX = event.clientX;
    interaction.lastY = event.clientY;

    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    const distanceSq = dx * dx + dy * dy;
    if (!interaction.dragging && distanceSq < 16) return;

    interaction.dragging = true;
    this.rotationAnimation = null;

    const sensitivity = 0.006;
    this.earthGroup.rotation.y = interaction.startRotationY + dx * sensitivity;
    this.earthGroup.rotation.x = THREE.MathUtils.clamp(
      interaction.startRotationX + dy * sensitivity,
      -Math.PI / 2,
      Math.PI / 2
    );
    this.applySunOrbit();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const interaction = this.pointerInteraction;
    if (!interaction || event.pointerId !== interaction.pointerId) return;

    event.preventDefault();
    this.pointerInteraction = null;
    document.body.style.cursor = '';

    if (interaction.dragging) return;

    const hit = this.pointerHitsEarth(event.clientX, event.clientY);
    if (!hit) return;

    const target = this.latLonFromLocalPoint(this.pointerHitLocal);
    this.startRotationTo(target.lon, target.lat, 700);
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    const interaction = this.pointerInteraction;
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    this.pointerInteraction = null;
    document.body.style.cursor = '';
  };

  private pointerHitsEarth(clientX: number, clientY: number): boolean {
    if (!this.camera || !this.earthGroup) return false;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return false;
    }

    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const earthMeshes = [this.baseMesh, this.waterDiffuseMesh].filter(
      (mesh): mesh is THREE.Mesh => !!mesh
    );
    const hits = this.raycaster.intersectObjects(earthMeshes, false);
    const hit = hits[0];
    if (!hit) return false;

    this.pointerHitLocal.copy(hit.point);
    this.earthGroup.worldToLocal(this.pointerHitLocal);
    this.pointerHitLocal.normalize();
    return true;
  }

  private latLonFromLocalPoint(point: THREE.Vector3): { lat: number; lon: number } {
    const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(point.y, -1, 1)));
    const lon = this.normalizeLongitude(THREE.MathUtils.radToDeg(Math.atan2(point.x, point.z)) - 90);
    return { lat, lon };
  }

  private normalizeLongitude(longitude: number): number {
    return THREE.MathUtils.euclideanModulo(longitude + 180, 360) - 180;
  }

  private startRotationTo(longitude: number, latitude: number, durationMs: number): void {
    if (!this.earthGroup) return;

    // Spherical coordinates: latitude (phi), longitude (theta)
    // For Three.js, y is up, z is forward, x is right.
    // The +90 offset matches the marker's math and texture alignment.
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
    this.createEclipseShadow();
    this.createMoon();
    this.createMarker();
  }

  private setupLighting(): void {
    // const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
    // this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x7fbfff, 0x05080c, 0.1);
    this.scene.add(hemiLight);

    // Sun light moves around the Earth to simulate day/night without rotating the globe.
    this.sunLight = new THREE.PointLight(0xffffff, 250000.0);
    this.sunLight.position.set(0, 80, this.SUN_LIGHT_DISTANCE);
    this.sunLight.castShadow = true;
    this.scene.add(this.sunLight);
    this.createSunSprite();
    this.applySunOrbit();
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
    this.cloudsGroup = new THREE.Group();

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
      this.markEarthTextureReady('base');
    });

    // Add topography bump map for surface relief
    const topoTexture = textureLoader.load('assets/topography_4096.jpg', () => {
      this.markEarthTextureReady('topography');
    });
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
    const waterMask = textureLoader.load('assets/land_water_2048.jpg', () => {
      this.markEarthTextureReady('water');
    });
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
    this.waterDiffuseMesh.visible = false;
    this.earthGroup.add(this.waterDiffuseMesh);

    // Clouds texture and layers
    const cloudsTexture = textureLoader.load('assets/cloud_combined_2048.jpg', () => {
      this.markEarthTextureReady('clouds');
    });
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
    this.cloudsGroup.add(this.cloudsMesh);
    this.earthGroup.add(this.cloudsGroup);

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
    this.atmosphereMesh.visible = false;
    this.earthGroup.add(this.atmosphereMesh);
    this.scene.add(this.earthGroup);
  }

  private markEarthTextureReady(texture: keyof typeof this.earthTextureReady): void {
    this.earthTextureReady[texture] = true;
    if (
      this.earthTextureReady.base &&
      this.earthTextureReady.topography &&
      this.earthTextureReady.water &&
      this.earthTextureReady.clouds
    ) {
      if (this.waterDiffuseMesh) this.waterDiffuseMesh.visible = true;
      if (this.atmosphereMesh) this.atmosphereMesh.visible = true;
    }
  }

  private createMoon(): void {
    this.moonGeometry = new THREE.SphereGeometry(this.MOON_RADIUS, 24, 12);
    this.moonTexture = new THREE.TextureLoader().load('assets/moon_1k.jpg', (texture) => {
      if ('colorSpace' in texture) {
        (texture as any).colorSpace = THREE.SRGBColorSpace;
      }
      texture.needsUpdate = true;
    });
    this.moonMaterial = new THREE.MeshPhongMaterial({
      map: this.moonTexture,
      color: 0xa8a8a8,
      shininess: 4,
    });

    this.moonMesh = new THREE.Mesh(this.moonGeometry, this.moonMaterial);
    this.moonMesh.renderOrder = 15;
    this.scene.add(this.moonMesh);
    this.applyMoonOrbit();
  }

  private createEclipseShadow(): void {
    if (!this.earthGroup) return;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.24, 'rgba(0,0,0,0.88)');
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.38)');
    gradient.addColorStop(0.82, 'rgba(0,0,0,0.12)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    this.eclipseShadowTexture = new THREE.CanvasTexture(canvas);
    this.eclipseShadowGeometry = new THREE.PlaneGeometry(1, 1);
    this.eclipseShadowMaterial = new THREE.MeshBasicMaterial({
      map: this.eclipseShadowTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
    });
    this.eclipseShadowMaterial.polygonOffset = true;
    this.eclipseShadowMaterial.polygonOffsetFactor = -3;
    this.eclipseShadowMaterial.polygonOffsetUnits = -3;

    this.eclipseShadowMesh = new THREE.Mesh(this.eclipseShadowGeometry, this.eclipseShadowMaterial);
    this.eclipseShadowMesh.renderOrder = 28;
    this.eclipseShadowMesh.visible = false;
    this.earthGroup.add(this.eclipseShadowMesh);
  }

  private createSunSprite(): void {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255,255,245,1)');
    gradient.addColorStop(0.16, 'rgba(255,245,160,1)');
    gradient.addColorStop(0.42, 'rgba(255,195,70,0.75)');
    gradient.addColorStop(0.72, 'rgba(255,130,30,0.22)');
    gradient.addColorStop(1, 'rgba(255,90,0,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    this.sunTexture = new THREE.CanvasTexture(canvas);
    this.sunTexture.colorSpace = THREE.SRGBColorSpace;

    this.sunSpriteMaterial = new THREE.SpriteMaterial({
      map: this.sunTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    this.sunSprite = new THREE.Sprite(this.sunSpriteMaterial);
    this.sunSprite.renderOrder = 5;
    this.scene.add(this.sunSprite);
  }

  private startTimeTransition(
    targetYearFraction: number,
    elapsedYears: number,
    durationMs: number,
    targetSunOrbitPhaseOverride?: number
  ): void {
    if (!Number.isFinite(elapsedYears) || Math.abs(elapsedYears) < 1e-7) {
      this.timeAnimation = null;
      this.setCelestialPhasesFromYearFraction(targetYearFraction);
      if (targetSunOrbitPhaseOverride != null) {
        this.sunOrbitPhase = targetSunOrbitPhaseOverride;
      }
      this.applySunOrbit();
      return;
    }

    const targetPhases = this.phasesForYearFraction(targetYearFraction);
    const targetSunOrbitPhase = targetSunOrbitPhaseOverride ?? targetPhases.sunOrbitPhase;
    const sunOrbitDelta = elapsedYears * this.DAYS_PER_SOLAR_YEAR * this.TWO_PI;
    const sunYearDelta = elapsedYears * this.TWO_PI;

    this.timeAnimation = {
      active: true,
      startTime: performance.now(),
      duration: durationMs,
      startCelestialYearFraction: this.currentCelestialYearFraction,
      targetCelestialYearFraction: targetYearFraction,
      startSunOrbitPhase: this.sunOrbitPhase,
      targetSunOrbitPhase: this.unwrapPhaseNear(
        targetSunOrbitPhase,
        this.sunOrbitPhase + sunOrbitDelta
      ),
      startSunYearPhase: this.sunYearPhase,
      targetSunYearPhase: this.unwrapPhaseNear(
        targetPhases.sunYearPhase,
        this.sunYearPhase + sunYearDelta
      ),
    };
  }

  private sunOrbitPhaseForLocalTime(longitude: number, localTimeHours?: number): number | undefined {
    if (localTimeHours == null || !Number.isFinite(localTimeHours)) return undefined;

    const normalizedHours = THREE.MathUtils.euclideanModulo(localTimeHours, 24);
    const hoursFromNoon = normalizedHours - 12;
    return THREE.MathUtils.degToRad(longitude + 90) + (hoursFromNoon / 24) * this.TWO_PI;
  }

  private phasesForYearFraction(yearFraction: number): {
    sunOrbitPhase: number;
    sunYearPhase: number;
  } {
    const yearProgress = THREE.MathUtils.euclideanModulo(yearFraction, 1);
    const dayProgress = THREE.MathUtils.euclideanModulo(
      yearFraction * this.DAYS_PER_SOLAR_YEAR,
      1
    );

    return {
      sunOrbitPhase: dayProgress * this.TWO_PI,
      sunYearPhase: yearProgress * this.TWO_PI,
    };
  }

  private setCelestialPhasesFromYearFraction(yearFraction: number): void {
    const phases = this.phasesForYearFraction(yearFraction);
    this.currentCelestialYearFraction = yearFraction;
    this.sunOrbitPhase = phases.sunOrbitPhase;
    this.sunYearPhase = phases.sunYearPhase;
  }

  private unwrapPhaseNear(phase: number, near: number): number {
    return phase + Math.round((near - phase) / this.TWO_PI) * this.TWO_PI;
  }

  private updateSunOrbit(deltaSeconds: number): void {
    if (!this.sunLight) return;
    if (this.earthRotationsPerSecond === 0) return;

    this.currentCelestialYearFraction +=
      (this.earthRotationsPerSecond / this.DAYS_PER_SOLAR_YEAR) * deltaSeconds;
    this.setCelestialPhasesFromYearFraction(this.currentCelestialYearFraction);

    this.applySunOrbit();
  }

  private updateTimeTransition(now: number): boolean {
    if (!this.timeAnimation?.active) return false;

    const anim = this.timeAnimation;
    const t = Math.min(1, (now - anim.startTime) / anim.duration);
    const eased = this.easeInOutCubic(t);

    this.sunOrbitPhase =
      anim.startSunOrbitPhase + (anim.targetSunOrbitPhase - anim.startSunOrbitPhase) * eased;
    this.sunYearPhase =
      anim.startSunYearPhase + (anim.targetSunYearPhase - anim.startSunYearPhase) * eased;
    this.currentCelestialYearFraction =
      anim.startCelestialYearFraction +
      (anim.targetCelestialYearFraction - anim.startCelestialYearFraction) * eased;

    if (t >= 1) {
      this.setCelestialPhasesFromYearFraction(anim.targetCelestialYearFraction);
      anim.active = false;
    }

    this.applySunOrbit();
    return true;
  }

  private applySunOrbit(): void {
    if (!this.sunLight) return;

    const declination = this.AXIAL_TILT_RAD * Math.sin(this.sunYearPhase);
    const orbitRadiusAtDeclination = Math.cos(declination);
    const orbitalX = Math.sin(this.sunOrbitPhase) * orbitRadiusAtDeclination;
    const orbitalY = Math.sin(declination);
    const orbitalZ = Math.cos(this.sunOrbitPhase) * orbitRadiusAtDeclination;
    this.localSunDirection.set(orbitalX, orbitalY, orbitalZ).normalize();
    this.worldSunDirection.copy(this.localSunDirection);
    if (this.earthGroup) {
      this.worldSunDirection.applyQuaternion(this.earthGroup.quaternion);
    }

    this.sunLight.position.copy(this.worldSunDirection).multiplyScalar(this.SUN_LIGHT_DISTANCE);

    if (this.starSphere) {
      this.annualStarRotation.setFromAxisAngle(this.STAR_ANNUAL_AXIS, -this.sunYearPhase);
      this.starSphere.quaternion.copy(this.annualStarRotation);
      if (this.earthGroup) {
        this.starSphere.quaternion.premultiply(this.earthGroup.quaternion);
      }
    }

    this.applyMoonOrbit();

    if (!this.sunSprite) return;

    const visualPosition = this.visualSunPosition
      .copy(this.worldSunDirection)
      .multiplyScalar(this.SUN_VISUAL_ORBIT_RADIUS);

    this.sunSprite.position.copy(visualPosition);

    const viewerSideAmount = THREE.MathUtils.clamp((this.worldSunDirection.z + 1) / 2, 0, 1);
    const sunScale = THREE.MathUtils.lerp(0.45, 2.8, viewerSideAmount);
    this.sunSprite.scale.set(sunScale, sunScale, 1);

    // When the sun reaches the viewer side, it passes behind the camera and out of frame.
    this.sunSprite.visible = visualPosition.z < this.camera.position.z - this.SUN_CAMERA_HIDE_PAD;
  }

  private applyMoonOrbit(): void {
    if (!this.moonMesh) return;

    const dayNumber = this.dayNumberFromYearFraction(this.currentCelestialYearFraction);
    const moonPosition = this.lunarPositionFromDayNumber(dayNumber);
    const sunLongitude = this.solarLongitudeFromDayNumber(dayNumber);
    const elongation = this.normalizeRadians(moonPosition.longitude - sunLongitude);
    const distanceScale = moonPosition.distanceKm / this.MOON_MEAN_DISTANCE_KM;

    this.localMoonDirection
      .copy(this.localSunDirection)
      .applyAxisAngle(this.STAR_ANNUAL_AXIS, elongation);
    this.localMoonDirection.y += Math.sin(moonPosition.latitude);
    this.localMoonDirection.normalize();

    this.worldMoonDirection.copy(this.localMoonDirection);
    if (this.earthGroup) {
      this.worldMoonDirection.applyQuaternion(this.earthGroup.quaternion);
    }

    this.moonMesh.position
      .copy(this.worldMoonDirection)
      .multiplyScalar(this.MOON_ORBIT_RADIUS * distanceScale);
    this.moonMesh.visible = this.worldMoonDirection.z > -0.92;
    this.applyEclipseShadow();
  }

  private lunarPositionFromDayNumber(dayNumber: number): {
    longitude: number;
    latitude: number;
    distanceKm: number;
  } {
    const t = (dayNumber - 2451545.0) / 36525;
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const lPrime = THREE.MathUtils.degToRad(
      this.normalizeDegrees(
        218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000
      )
    );
    const d = THREE.MathUtils.degToRad(
      this.normalizeDegrees(
        297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868 - t4 / 113065000
      )
    );
    const m = THREE.MathUtils.degToRad(
      this.normalizeDegrees(
        357.5291092 + 35999.0502909 * t - 0.0001536 * t2 + t3 / 24490000
      )
    );
    const mp = THREE.MathUtils.degToRad(
      this.normalizeDegrees(
        134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699 - t4 / 14712000
      )
    );
    const f = THREE.MathUtils.degToRad(
      this.normalizeDegrees(
        93.272095 + 483202.0175233 * t - 0.0036539 * t2 - t3 / 3526000 + t4 / 863310000
      )
    );
    const e = 1 - 0.002516 * t - 0.0000074 * t2;

    let longitudeCorrection = 0;
    let distanceCorrection = 0;
    for (const term of LUNAR_LONGITUDE_DISTANCE_TERMS) {
      const [dMul, mMul, mpMul, fMul, lCoeff, rCoeff] = term;
      const eFactor = Math.abs(mMul) === 1 ? e : Math.abs(mMul) === 2 ? e * e : 1;
      const arg = dMul * d + mMul * m + mpMul * mp + fMul * f;
      longitudeCorrection += eFactor * lCoeff * Math.sin(arg);
      distanceCorrection += eFactor * rCoeff * Math.cos(arg);
    }

    let latitudeCorrection = 0;
    for (const term of LUNAR_LATITUDE_TERMS) {
      const [dMul, mMul, mpMul, fMul, bCoeff] = term;
      const eFactor = Math.abs(mMul) === 1 ? e : Math.abs(mMul) === 2 ? e * e : 1;
      const arg = dMul * d + mMul * m + mpMul * mp + fMul * f;
      latitudeCorrection += eFactor * bCoeff * Math.sin(arg);
    }

    return {
      longitude: this.normalizeRadians(
        lPrime + THREE.MathUtils.degToRad(longitudeCorrection / 1e6)
      ),
      latitude: THREE.MathUtils.degToRad(latitudeCorrection / 1e6),
      distanceKm: 385000.56 + distanceCorrection / 1000,
    };
  }

  private solarLongitudeFromDayNumber(dayNumber: number): number {
    const t = (dayNumber - 2451545.0) / 36525;
    const t2 = t * t;
    const meanLongitude = this.normalizeDegrees(280.46646 + 36000.76983 * t + 0.0003032 * t2);
    const meanAnomaly = THREE.MathUtils.degToRad(
      this.normalizeDegrees(357.52911 + 35999.05029 * t - 0.0001537 * t2)
    );
    const center =
      (1.914602 - 0.004817 * t - 0.000014 * t2) * Math.sin(meanAnomaly) +
      (0.019993 - 0.000101 * t) * Math.sin(2 * meanAnomaly) +
      0.000289 * Math.sin(3 * meanAnomaly);
    return THREE.MathUtils.degToRad(this.normalizeDegrees(meanLongitude + center));
  }

  private normalizeDegrees(degrees: number): number {
    return THREE.MathUtils.euclideanModulo(degrees, 360);
  }

  private normalizeRadians(radians: number): number {
    return THREE.MathUtils.euclideanModulo(radians, this.TWO_PI);
  }

  private dayNumberFromYearFraction(yearFraction: number): number {
    const year = Math.floor(yearFraction);
    const yearProgress = yearFraction - year;
    const dayOfYear = yearProgress * this.daysInGregorianYear(year);
    return this.gregorianDayNumber(year, 1, 1) + dayOfYear;
  }

  private daysInGregorianYear(year: number): number {
    return this.isGregorianLeapYear(year) ? 366 : 365;
  }

  private isGregorianLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  private gregorianDayNumber(year: number, month: number, day: number): number {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return (
      day +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045
    );
  }

  private applyEclipseShadow(): void {
    if (!this.eclipseShadowMesh || !this.eclipseShadowMaterial) return;

    const alignmentAngle = this.localSunDirection.angleTo(this.localMoonDirection);
    if (alignmentAngle > this.ECLIPSE_SHADOW_OUTER_ANGLE_RAD) {
      this.eclipseShadowMesh.visible = false;
      this.eclipseShadowMaterial.opacity = 0;
      return;
    }

    const alignment = 1 - this.smoothstep(
      this.ECLIPSE_SHADOW_INNER_ANGLE_RAD,
      this.ECLIPSE_SHADOW_OUTER_ANGLE_RAD,
      alignmentAngle
    );
    const opacity = Math.pow(alignment, 0.65) * 0.95;

    this.localShadowDirection.copy(this.localMoonDirection).normalize();
    this.eclipseShadowMesh.position.copy(this.localShadowDirection).multiplyScalar(1.011);
    this.eclipseShadowMesh.quaternion.setFromUnitVectors(
      this.SHADOW_PLANE_NORMAL,
      this.localShadowDirection
    );
    this.eclipseShadowMesh.scale.setScalar(this.ECLIPSE_SHADOW_RADIUS);
    this.eclipseShadowMesh.visible = opacity > 0.01;
    this.eclipseShadowMaterial.opacity = opacity;
  }

  private advanceCloudDrift(deltaSeconds: number): void {
    if (!this.cloudsGroup) return;
    if (this.cloudDriftRotationsPerSecond <= 0 || deltaSeconds <= 0) return;

    this.cloudDriftElapsedSeconds += deltaSeconds;
    const driftRotations = this.cloudDriftElapsedSeconds * this.cloudDriftRotationsPerSecond;
    this.cloudsGroup.rotation.y = driftRotations * this.TWO_PI;
    this.cloudsGroup.rotation.x =
      Math.sin((this.cloudDriftElapsedSeconds / this.CLOUD_DRIFT_Y_VARIATION_SECONDS) * this.TWO_PI) *
      this.CLOUD_DRIFT_Y_VARIATION_RADIANS;
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
  }

  // Update the viewVector uniform for the atmosphere each frame
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dtSec = this.lastTimeMs == null ? 0 : (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;

    const clampedDt = Math.min(dtSec, 0.1);
    if (!this.updateTimeTransition(now)) {
      this.updateSunOrbit(clampedDt);
    }

    // Earth rotation animation
    let earthRotatedThisFrame = false;
    if (this.rotationAnimation?.active) {
      const anim = this.rotationAnimation;
      const elapsed = now - anim.startTime;
      const t = Math.min(1, elapsed / anim.duration);
      const eased = this.easeInOutCubic(t);
      this.earthGroup.rotation.x =
        anim.startRotation.x + (anim.targetRotation.x - anim.startRotation.x) * eased;
      this.earthGroup.rotation.y =
        anim.startRotation.y + (anim.targetRotation.y - anim.startRotation.y) * eased;
      earthRotatedThisFrame = true;
      if (t >= 1) {
        anim.active = false;
      }
    }

    if (earthRotatedThisFrame) {
      this.applySunOrbit();
    }

    this.advanceCloudDrift(clampedDt);

    // Update marker position
    this.updateMarkerPosition();

    // Update shader uniforms for atmosphere
    if (this.atmosphereMaterial && this.camera) {
      // viewVector: from center of Earth to camera
      this.viewVector.copy(this.camera.position).sub(this.earthGroup.position).normalize();
      this.atmosphereMaterial.uniforms['viewVector'].value = this.viewVector;
      // sunDir: from center of Earth to sun
      this.sunVector.copy(this.sunLight.position).sub(this.earthGroup.position).normalize();
      this.atmosphereMaterial.uniforms['sunDir'].value = this.sunVector;
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
    this.ngZone.runOutsideAngular(() => this.animate());
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
      this.locationMarker.getWorldPosition(this.markerWorldPosition);
      this.markerCameraDirection
        .subVectors(this.camera.position, this.markerWorldPosition)
        .normalize();
      this.markerNormal.copy(this.markerWorldPosition).normalize();
      // Dot product: >0 facing camera, <0 away
      const facingCamera = this.markerNormal.dot(this.markerCameraDirection);
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
