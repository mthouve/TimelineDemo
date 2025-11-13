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
  private earthGeometry!: THREE.SphereGeometry;
  private baseMaterial!: THREE.MeshPhongMaterial;
  private waterMaterial!: THREE.MeshPhongMaterial;
  private waterMaterialWide!: THREE.MeshPhongMaterial;
  private baseMesh!: THREE.Mesh;
  private waterMesh!: THREE.Mesh;
  private waterMeshWide!: THREE.Mesh;
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
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    this.scene.add(directionalLight);

    // Earth sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    // aoMap requires a second set of UVs (uv2). Reuse the primary uv set.
    const uv = (geometry.attributes as any).uv as THREE.BufferAttribute;
    if (uv) {
      geometry.setAttribute('uv2', new THREE.BufferAttribute(uv.array, 2));
    }
    this.earthGeometry = geometry;

    // Load NASA Blue Marble texture and convert to grayscale
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(
      'assets/earth-blue-marble.png',
      (texture) => {
        console.log('Earth texture loaded successfully', texture);
        // Build an initial water mask from the original color source before grayscaling
        const sourceImg = texture.image as HTMLImageElement;
        const initialMask = this.createWaterMaskFromSource(sourceImg);
        this.waterMaterial.alphaMap = initialMask;
        this.waterMaterial.specularMap = initialMask;
        this.waterMaterial.opacity = 1.0;
        this.waterMaterial.needsUpdate = true;

        // Convert texture to grayscale for the base material
        this.applyGrayscaleFilter(texture);
      },
      undefined,
      (error) => {
        console.error('Error loading Earth texture:', error);
      }
    );

    // Build Earth as a group of two meshes: base (unlit) + water overlay (lit/specular)
    this.earthGroup = new THREE.Group();

    // Base (land + water) diffuse-lit with orange tint, no specular on land
    this.baseMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      color: 0xff9642,
      emissive: 0x000000,
      specular: 0x000000, // disable specular on base so land doesn't glint
      shininess: 0,
    });
    this.baseMesh = new THREE.Mesh(this.earthGeometry, this.baseMaterial);
    this.earthGroup.add(this.baseMesh);

    // Water overlay with specular glint (alpha-masked to oceans)
    this.waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x000000, // no diffuse contribution; only specular will show
      transparent: true,
      specular: new THREE.Color(0xff9642), // orange glint
      shininess: 50, // tighter/brighter highlight
      blending: THREE.AdditiveBlending, // add highlight over base
      depthWrite: false,
      opacity: 0.0, // hidden until water mask loads
    });
    this.waterMesh = new THREE.Mesh(this.earthGeometry, this.waterMaterial);
    this.earthGroup.add(this.waterMesh);

    // Broader secondary lobe for more natural highlight rolloff
    this.waterMaterialWide = new THREE.MeshPhongMaterial({
      color: 0x000000,
      transparent: true,
      specular: new THREE.Color(0x8a4d20), // dimmer orange
      shininess: 18, // broad lobe
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.0,
    });
    this.waterMeshWide = new THREE.Mesh(this.earthGeometry, this.waterMaterialWide);
    this.earthGroup.add(this.waterMeshWide);

    this.scene.add(this.earthGroup);

    console.log('Earth mesh created and added to scene');

    // Try to load bathymetry as a water mask for specular (sun reflection on water)
  this.loadWaterSpecularMask(textureLoader);

    // Start render loop
    this.animate();
  }

  /**
   * Load bathymetry texture and convert to a water-only specular map.
   * Land -> black, Water -> white. This is used as material.specularMap.
   */
  private loadWaterSpecularMask(textureLoader: THREE.TextureLoader): void {
    // Prefer a local asset if present; otherwise fall back to NASA URL
    const localUrl = 'assets/gebco_08_rev_bath_3600x1800_color.jpg';
    const remoteUrl =
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73963/gebco_08_rev_bath_3600x1800_color.jpg';

    const processTexture = (texture: THREE.Texture) => {
      const img = texture.image as HTMLImageElement;
      const waterMask = this.createWaterMaskTexture(img);
      // Apply mask to water material so only oceans receive lighting/specular
      this.waterMaterial.alphaMap = waterMask;
      this.waterMaterial.specularMap = waterMask;
      this.waterMaterial.transparent = true;
      this.waterMaterial.opacity = 1.0;
      this.waterMaterial.needsUpdate = true;
      // Ensure correct encoding and update for mask textures
      waterMask.needsUpdate = true;
      // Apply same mask to wider lobe
      this.waterMaterialWide.alphaMap = waterMask;
      this.waterMaterialWide.specularMap = waterMask;
      this.waterMaterialWide.transparent = true;
      this.waterMaterialWide.opacity = 1.0;
      this.waterMaterialWide.needsUpdate = true;
    };

    // First try local path
    textureLoader.load(
      localUrl,
      (tex) => processTexture(tex),
      undefined,
      () => {
        // If local load fails, try remote with CORS
        textureLoader.setCrossOrigin('anonymous');
        textureLoader.load(
          remoteUrl,
          (tex) => processTexture(tex),
          undefined,
          (err) => {
            console.warn('Bathymetry load failed; water reflection disabled', err);
          }
        );
      }
    );
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
  private createLandAOTexture(image: HTMLImageElement): THREE.CanvasTexture {
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
      const sum = r + g + b;
      const isWater = sum > 12; // same threshold as specular mask
      const v = isWater ? 255 : 170; // land darker than water
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    const aoTexture = new THREE.CanvasTexture(c);
    aoTexture.wrapS = THREE.RepeatWrapping;
    aoTexture.wrapT = THREE.RepeatWrapping;
    aoTexture.needsUpdate = true;
    return aoTexture;
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
    } else {
  // Slow idle rotation when not animating to a target (halved speed)
  this.earthGroup.rotation.y += 0.0005;
      // Keep angle bounded to avoid very large values over time
      this.earthGroup.rotation.y = Math.atan2(
        Math.sin(this.earthGroup.rotation.y),
        Math.cos(this.earthGroup.rotation.y)
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
  localPos.applyEuler(this.earthGroup.rotation);

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

    if (this.earthGeometry) {
      this.earthGeometry.dispose();
    }
    if (this.baseMaterial) this.baseMaterial.dispose();
    if (this.waterMaterial) this.waterMaterial.dispose();
    if (this.waterMaterialWide) this.waterMaterialWide.dispose();
  }
}
