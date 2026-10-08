import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { VideoVRSettings } from '../../types/scene';

export interface VRCanvasHandle {
  getYaw: () => number;
  getPitch: () => number;
  getFov: () => number;
  setOrientation: (yaw: number, pitch: number, fov?: number) => void;
}

interface VRCanvasProps {
  videoElement: HTMLVideoElement | null;
  vrSettings: VideoVRSettings;
  onFovChange?: (fov: number) => void;
  onOrientationChange?: (yaw: number, pitch: number) => void;
  initialYaw?: number;
  initialPitch?: number;
  initialFov?: number;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D map;
  uniform vec2 uvOffset;
  uniform vec2 uvRepeat;
  uniform float isFishEye;
  varying vec2 vUv;

  void main() {
    vec2 baseUv = vUv;

    // Apply Fish Eye lens barrel transformation if lens is set to fisheye
    if (isFishEye > 0.5) {
      vec2 centered = baseUv * 2.0 - 1.0;
      float r = length(centered);
      if (r > 0.0001) {
        float theta = atan(centered.y, centered.x);
        float distortion = 0.26;
        float rDistorted = r * (1.0 + distortion * r * r);
        vec2 p = vec2(cos(theta), sin(theta)) * rDistorted;
        baseUv = p * 0.5 + 0.5;
      }
    }

    baseUv = clamp(baseUv, 0.0, 1.0);

    // Apply stereo eye offset and repeat (Mono / Left / Right)
    vec2 finalUv = baseUv * uvRepeat + uvOffset;

    gl_FragColor = texture2D(map, finalUv);
  }
`;

export const VRCanvas = forwardRef<VRCanvasHandle, VRCanvasProps>(
  (
    {
      videoElement,
      vrSettings,
      onFovChange,
      onOrientationChange,
      initialYaw,
      initialPitch,
      initialFov,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);
    const textureRef = useRef<THREE.VideoTexture | null>(null);

    // Camera angles in degrees (default 0° starts center of selected eye/half)
    const yawRef = useRef<number>(initialYaw ?? 0);
    const pitchRef = useRef<number>(initialPitch ?? 0);
    const fovRef = useRef<number>(initialFov ?? vrSettings.fov ?? 75);

    // Pointer Drag State
    const isDraggingRef = useRef<boolean>(false);
    const previousPointerXRef = useRef<number>(0);
    const previousPointerYRef = useRef<number>(0);

    // Key Pressed State for smooth WASD navigation
    const keysPressedRef = useRef<Record<string, boolean>>({});

    // Expose imperative handle for orientation and fov
    useImperativeHandle(ref, () => ({
      getYaw: () => yawRef.current,
      getPitch: () => pitchRef.current,
      getFov: () => fovRef.current,
      setOrientation: (yaw: number, pitch: number, fov?: number) => {
        yawRef.current = yaw;
        pitchRef.current = Math.max(-85, Math.min(85, pitch));
        if (cameraRef.current) {
          cameraRef.current.rotation.y = THREE.MathUtils.degToRad(yaw);
          cameraRef.current.rotation.x = THREE.MathUtils.degToRad(pitchRef.current);
        }
        if (fov !== undefined) {
          fovRef.current = Math.max(30, Math.min(115, fov));
          if (cameraRef.current) {
            cameraRef.current.fov = fovRef.current;
            cameraRef.current.updateProjectionMatrix();
          }
        }
      },
    }));

    // Synchronize camera viewpoint when initialYaw / initialPitch props change
    useEffect(() => {
      if (initialYaw !== undefined || initialPitch !== undefined) {
        yawRef.current = initialYaw ?? 0;
        pitchRef.current = initialPitch ?? 0;
        if (cameraRef.current) {
          cameraRef.current.rotation.y = THREE.MathUtils.degToRad(yawRef.current);
          cameraRef.current.rotation.x = THREE.MathUtils.degToRad(pitchRef.current);
        }
      }
      if (initialFov !== undefined) {
        fovRef.current = initialFov;
        if (cameraRef.current) {
          cameraRef.current.fov = initialFov;
          cameraRef.current.updateProjectionMatrix();
        }
      }
    }, [initialYaw, initialPitch, initialFov]);

    // Synchronize FOV when prop changes
    useEffect(() => {
      if (vrSettings.fov && vrSettings.fov !== fovRef.current) {
        fovRef.current = vrSettings.fov;
        if (cameraRef.current) {
          cameraRef.current.fov = vrSettings.fov;
          cameraRef.current.updateProjectionMatrix();
        }
      }
    }, [vrSettings.fov]);

    // Synchronize Shader Uniforms (Stereo Eye Mode, Fisheye Lens)
    useEffect(() => {
      if (!materialRef.current) return;

      const mat = materialRef.current;
      mat.uniforms.isFishEye.value = vrSettings.lens === 'fisheye' ? 1.0 : 0.0;

      if (vrSettings.eyeMode === 'mono') {
        mat.uniforms.uvRepeat.value.set(1.0, 1.0);
        mat.uniforms.uvOffset.value.set(0.0, 0.0);
      } else if (vrSettings.eyeMode === 'left') {
        // Left half of Side-by-Side (SBS) - maps horizontal center to 0.25 (center of left half)
        mat.uniforms.uvRepeat.value.set(0.5, 1.0);
        mat.uniforms.uvOffset.value.set(0.0, 0.0);
      } else if (vrSettings.eyeMode === 'right') {
        // Right half of Side-by-Side (SBS) - maps horizontal center to 0.75 (center of right half)
        mat.uniforms.uvRepeat.value.set(0.5, 1.0);
        mat.uniforms.uvOffset.value.set(0.5, 0.0);
      }
    }, [vrSettings.eyeMode, vrSettings.lens]);

    // Rebuild Geometry when Projection (360 vs 180) changes
    useEffect(() => {
      if (!meshRef.current) return;
      meshRef.current.geometry.dispose();

      if (vrSettings.projection === '180') {
        // 180 degree dome / hemisphere facing forward
        meshRef.current.geometry = new THREE.SphereGeometry(
          500,
          64,
          40,
          Math.PI / 2,
          Math.PI,
          0,
          Math.PI
        );
      } else {
        // Full 360 degree sphere
        meshRef.current.geometry = new THREE.SphereGeometry(500, 64, 40);
      }
      // Keep center of video (u = 0.5) facing straight ahead (-Z)
      meshRef.current.rotation.y = -Math.PI / 2;
    }, [vrSettings.projection]);

    // Initialize Three.js Scene, Camera, Texture, Renderer, and Animation Loop
    useEffect(() => {
      if (!containerRef.current || !videoElement) return;

      const container = containerRef.current;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 450;

      // 1. Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // 2. Camera inside sphere
      const camera = new THREE.PerspectiveCamera(fovRef.current, width / height, 0.1, 1000);
      camera.position.set(0, 0, 0);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = THREE.MathUtils.degToRad(yawRef.current);
      camera.rotation.x = THREE.MathUtils.degToRad(pitchRef.current);
      cameraRef.current = camera;

      // 3. Video Texture
      const texture = new THREE.VideoTexture(videoElement);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = texture;

      // 4. Custom Shader Material for Stereo SBS & Fisheye lens support
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          map: { value: texture },
          uvOffset: { value: new THREE.Vector2(0, 0) },
          uvRepeat: { value: new THREE.Vector2(1, 1) },
          isFishEye: { value: vrSettings.lens === 'fisheye' ? 1.0 : 0.0 },
        },
        side: THREE.BackSide, // Look from inside the sphere
      });
      materialRef.current = material;

      // Initialize stereo eye uniforms
      if (vrSettings.eyeMode === 'left') {
        material.uniforms.uvRepeat.value.set(0.5, 1.0);
        material.uniforms.uvOffset.value.set(0.0, 0.0);
      } else if (vrSettings.eyeMode === 'right') {
        material.uniforms.uvRepeat.value.set(0.5, 1.0);
        material.uniforms.uvOffset.value.set(0.5, 0.0);
      }

      // 5. Geometry (360 sphere or 180 dome)
      const geometry =
        vrSettings.projection === '180'
          ? new THREE.SphereGeometry(500, 64, 40, Math.PI / 2, Math.PI, 0, Math.PI)
          : new THREE.SphereGeometry(500, 64, 40);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(-1, 1, 1); // Invert so texture is right-reading inside
      mesh.rotation.y = -Math.PI / 2; // Orient center (u = 0.5) to face straight ahead (-Z)
      scene.add(mesh);
      meshRef.current = mesh;

      // 6. WebGL Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 7. Mouse & Pointer Event Listeners for dragging/looking around
      const onPointerDown = (e: PointerEvent) => {
        isDraggingRef.current = true;
        previousPointerXRef.current = e.clientX;
        previousPointerYRef.current = e.clientY;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;

        const deltaX = e.clientX - previousPointerXRef.current;
        const deltaY = e.clientY - previousPointerYRef.current;

        previousPointerXRef.current = e.clientX;
        previousPointerYRef.current = e.clientY;

        const sensitivity = 0.22;
        yawRef.current += deltaX * sensitivity;
        pitchRef.current = Math.max(-85, Math.min(85, pitchRef.current + deltaY * sensitivity));

        if (onOrientationChange) {
          onOrientationChange(yawRef.current, pitchRef.current);
        }
      };

      const onPointerUp = () => {
        isDraggingRef.current = false;
      };

      // Mouse Wheel for FOV / Zoom
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomDelta = e.deltaY * 0.05;
        const nextFov = Math.max(30, Math.min(115, fovRef.current + zoomDelta));
        fovRef.current = nextFov;
        camera.fov = nextFov;
        camera.updateProjectionMatrix();

        if (onFovChange) {
          onFovChange(nextFov);
        }
      };

      // WASD Keyboard Camera Controls (Smooth held key movement)
      const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }

        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd'].includes(key)) {
          keysPressedRef.current[key] = true;
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd'].includes(key)) {
          keysPressedRef.current[key] = false;
        }
      };

      const domElem = renderer.domElement;
      domElem.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      domElem.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      // 8. Animation Render Loop
      let animId: number;
      const keySpeed = 1.6; // Speed in degrees per frame

      const animate = () => {
        animId = requestAnimationFrame(animate);

        // Process smooth WASD camera navigation
        let orientationChanged = false;
        if (keysPressedRef.current['w']) {
          pitchRef.current = Math.min(85, pitchRef.current + keySpeed);
          orientationChanged = true;
        }
        if (keysPressedRef.current['s']) {
          pitchRef.current = Math.max(-85, pitchRef.current - keySpeed);
          orientationChanged = true;
        }
        if (keysPressedRef.current['a']) {
          yawRef.current += keySpeed;
          orientationChanged = true;
        }
        if (keysPressedRef.current['d']) {
          yawRef.current -= keySpeed;
          orientationChanged = true;
        }

        if (orientationChanged && onOrientationChange) {
          onOrientationChange(yawRef.current, pitchRef.current);
        }

        // Apply camera rotation
        camera.rotation.y = THREE.MathUtils.degToRad(yawRef.current);
        camera.rotation.x = THREE.MathUtils.degToRad(pitchRef.current);

        renderer.render(scene, camera);
      };

      animate();

      // 9. Resize Observer
      const resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      });
      resizeObserver.observe(container);

      // 10. Clean up
      return () => {
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();

        domElem.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        domElem.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);

        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }

        renderer.dispose();
        geometry.dispose();
        material.dispose();
        texture.dispose();
      };
    }, [videoElement]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing bg-black select-none overflow-hidden"
        title="VR Viewport: Click & Drag to Look Around • WASD to Navigate • Wheel to Zoom"
      />
    );
  }
);
