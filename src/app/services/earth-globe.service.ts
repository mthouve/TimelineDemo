import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class EarthGlobeService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private earthMesh!: THREE.Mesh;
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
    console.log('EarthGlobeService.init called', { canvas, width, height });

    // Scene
    this.scene = new THREE.Scene();

    // Camera - wider FOV and further back to show full sphere
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.z = 3.0; // Moved back to show full Earth

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true, // Transparent background to blend with starfield
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0); // Transparent background

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    this.scene.add(directionalLight);

    // Earth sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // Load NASA Blue Marble texture and convert to grayscale
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(
      'assets/earth-blue-marble.png',
      (texture) => {
        console.log('Earth texture loaded successfully', texture);
        // Convert texture to grayscale
        this.applyGrayscaleFilter(texture);
      },
      undefined,
      (error) => {
        console.error('Error loading Earth texture:', error);
      }
    );

    // Material with orange tint overlay (applied to grayscale texture)
    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      color: 0xff9642, // Orange tint to match HUD color scheme
      emissive: 0x000000,
      specular: 0x222222,
      shininess: 5,
    });

    this.earthMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.earthMesh);

    console.log('Earth mesh created and added to scene');

    // Start render loop
    this.animate();
  }

  /**
   * Convert texture to grayscale by manipulating image data
   */
  private applyGrayscaleFilter(texture: THREE.Texture): void {
    const image = texture.image as HTMLImageElement;

    // Create a canvas to manipulate the image
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Draw the original image
    ctx.drawImage(image, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale using luminosity method
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray; // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      // data[i + 3] is alpha, leave unchanged
    }

    // Put the grayscale data back
    ctx.putImageData(imageData, 0, 0);

    // Update the texture with the grayscale canvas
    texture.image = canvas;
    texture.needsUpdate = true;

    console.log('Grayscale filter applied to Earth texture');
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

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
      this.earthMesh.rotation.x =
        this.rotationAnimation.startRotation.x +
        (this.rotationAnimation.targetRotation.x - this.rotationAnimation.startRotation.x) * eased;

      this.earthMesh.rotation.y =
        this.rotationAnimation.startRotation.y +
        (this.rotationAnimation.targetRotation.y - this.rotationAnimation.startRotation.y) * eased;

      if (progress >= 1) {
        this.rotationAnimation.active = false;
      }

      // Update marker position to match Earth rotation
      if (this.locationMarker && this.currentMarkerPosition) {
        this.updateMarkerPosition();
      }
    } else {
      // Slow idle rotation when not animating to a target
      this.earthMesh.rotation.y += 0.001;
      // Keep angle bounded to avoid very large values over time
      this.earthMesh.rotation.y = Math.atan2(
        Math.sin(this.earthMesh.rotation.y),
        Math.cos(this.earthMesh.rotation.y)
      );

      // Update marker position during idle rotation too
      if (this.locationMarker && this.currentMarkerPosition) {
        this.updateMarkerPosition();
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

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
    if (!this.earthMesh) return;

    // Convert to radians
    // Y rotation: negative longitude brings location to front
    // X rotation: positive latitude tilts northern hemisphere forward
    const targetLonRad = THREE.MathUtils.degToRad(-lon - 90);
    const targetLatRad = THREE.MathUtils.degToRad(lat);

    // Compute shortest angular difference so we never spin more than necessary
    const currentY = this.earthMesh.rotation.y;
    const currentX = this.earthMesh.rotation.x;
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
      this.locationMarker.material.dispose();
    }

    // Create canvas for red circle (styled like timeline data point)
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

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
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon + 90); // Add 90 to compensate for texture offset

    const localX = radius * Math.cos(latRad) * Math.sin(lonRad);
    const localY = radius * Math.sin(latRad);
    const localZ = radius * Math.cos(latRad) * Math.cos(lonRad);

    // Convert to world space using Earth's rotation
    const localPos = new THREE.Vector3(localX, localY, localZ);
    localPos.applyEuler(this.earthMesh.rotation);

    this.locationMarker.position.copy(localPos);

    // Calculate visibility based on whether marker is facing the camera
    // Simple approach: check if the surface normal at marker position points toward camera
    const markerNormal = localPos.clone().normalize(); // Normal points outward from Earth center
    const cameraDirection = new THREE.Vector3()
      .subVectors(this.camera.position, localPos)
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
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
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

    if (this.earthMesh) {
      this.earthMesh.geometry.dispose();
      if (this.earthMesh.material instanceof THREE.Material) {
        this.earthMesh.material.dispose();
      }
    }
  }
}
