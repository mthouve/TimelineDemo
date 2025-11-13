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

    // Slow rotation for visual interest
    this.earthMesh.rotation.y += 0.001;

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Rotate Earth to show a specific longitude/latitude
   * @param lon Longitude in degrees (-180 to 180)
   * @param lat Latitude in degrees (-90 to 90)
   */
  rotateTo(lon: number, lat: number): void {
    if (!this.earthMesh) return;

    // Convert to radians and apply rotation
    // Note: Earth texture has 0° longitude at the center, so we rotate to bring target to front
    const lonRad = THREE.MathUtils.degToRad(-lon);
    const latRad = THREE.MathUtils.degToRad(lat);

    this.earthMesh.rotation.y = lonRad;
    this.earthMesh.rotation.x = latRad;
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
