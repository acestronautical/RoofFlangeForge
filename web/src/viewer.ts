/*
 * Minimal three.js STL viewer.
 *
 * The scene works in millimeters (openscad-wasm exports mm-scaled STLs).
 * The grid is sized to 1-inch cells so users get an implicit scale reference.
 *
 * Public API:
 *   const viewer = new StlViewer(canvas);
 *   const dims = viewer.load(bytes);   // returns bounding-box dimensions in mm
 *   viewer.resize();                   // call on window resize
 *   viewer.dispose();                  // when tearing down
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const MM_PER_INCH = 25.4;

export interface ModelDims {
    xMm: number;
    yMm: number;
    zMm: number;
}

export class StlViewer {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;
    private currentMesh: THREE.Mesh | null = null;
    private currentGrid: THREE.GridHelper | null = null;
    private loader = new STLLoader();
    private animationFrame = 0;
    private hasFramed = false;

    constructor(private canvas: HTMLCanvasElement) {
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e2124);

        this.camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
        this.camera.position.set(300, 200, 300);

        const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.0);
        this.scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(1, 2, 1);
        this.scene.add(dir);

        // The grid is (re)built for the loaded model in `load()`; start with a
        // small default so the viewer isn't empty before anything is rendered.
        this.rebuildGrid(24);

        // 1-inch axis widget at origin so orientation is unambiguous.
        this.scene.add(this.makeAxisWidget(MM_PER_INCH));

        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 0, 0);

        this.resize();
        this.animate();
    }

    private makeAxisWidget(len: number): THREE.Group {
        const g = new THREE.Group();
        const axes: Array<{ dir: [number, number, number]; color: number }> = [
            { dir: [1, 0, 0], color: 0xff5555 }, // X red (matches STL X)
            { dir: [0, 1, 0], color: 0x55ff55 }, // Y green (matches STL Z after rotation)
            { dir: [0, 0, 1], color: 0x5599ff }, // Z blue (matches STL Y after rotation)
        ];
        for (const { dir, color } of axes) {
            const pts = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(dir[0] * len, dir[1] * len, dir[2] * len),
            ];
            const geom = new THREE.BufferGeometry().setFromPoints(pts);
            g.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color })));
        }
        return g;
    }

    // Build a grid sized to the given inch extent, with one line per inch.
    // Called from the constructor with a default extent and from load() to
    // resize for whatever's actually on screen.
    private rebuildGrid(inchesAcross: number): void {
        if (this.currentGrid) {
            this.scene.remove(this.currentGrid);
            (this.currentGrid.material as THREE.Material).dispose();
            this.currentGrid.geometry.dispose();
        }
        const sizeInches = Math.max(4, Math.ceil(inchesAcross));
        const grid = new THREE.GridHelper(
            sizeInches * MM_PER_INCH,
            sizeInches,
            0x666666,
            0x333333,
        );
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).opacity = 0.6;
        this.scene.add(grid);
        this.currentGrid = grid;
    }

    load(bytes: Uint8Array): ModelDims {
        // Uint8Array.buffer might be typed SharedArrayBuffer; force ArrayBuffer.
        const buffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        const geometry = this.loader.parse(buffer);
        geometry.computeVertexNormals();

        // Bounding box on the raw geometry gives the STL's native size (mm).
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox!;
        const size = bb.getSize(new THREE.Vector3());
        const dims: ModelDims = { xMm: size.x, yMm: size.y, zMm: size.z };

        // Center in the XY plane and rest the bottom on Z=0 (which will become
        // the grid plane after the -90 X rotation applied to the mesh).
        geometry.translate(
            -(bb.min.x + bb.max.x) / 2,
            -(bb.min.y + bb.max.y) / 2,
            -bb.min.z,
        );

        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            this.currentMesh.geometry.dispose();
            (this.currentMesh.material as THREE.Material).dispose();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0xc7d5e6,
            roughness: 0.5,
            metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geometry, material);
        // OpenSCAD's exported STL uses Z-up; three.js expects Y-up.
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        this.currentMesh = mesh;

        // Grow the grid so it visibly spans past the loaded model.
        const spanMm = Math.max(size.x, size.y);
        this.rebuildGrid((spanMm / MM_PER_INCH) * 1.5);

        // Frame the mesh only on the first render; leave the user's camera
        // alone on every subsequent load so tweaking a parameter doesn't
        // yank the view back to the default.
        if (!this.hasFramed) {
            this.frameMesh(size);
            this.hasFramed = true;
        }
        return dims;
    }

    private frameMesh(size: THREE.Vector3): void {
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = (this.camera.fov * Math.PI) / 180;
        const dist = (maxDim / 2 / Math.tan(fov / 2)) * 2.5;
        this.camera.position.set(dist, dist * 0.75, dist);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    resize(): void {
        const rect = this.canvas.getBoundingClientRect();
        this.renderer.setSize(rect.width, rect.height, false);
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
    }

    setBackgroundColor(hex: number): void {
        (this.scene.background as THREE.Color).set(hex);
    }

    private animate = (): void => {
        this.animationFrame = requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    };

    dispose(): void {
        cancelAnimationFrame(this.animationFrame);
        this.controls.dispose();
        this.renderer.dispose();
        if (this.currentMesh) {
            this.currentMesh.geometry.dispose();
            (this.currentMesh.material as THREE.Material).dispose();
        }
    }
}
