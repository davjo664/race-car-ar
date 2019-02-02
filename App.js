import { AR } from 'expo';
import ExpoTHREE, { THREE, AR as ThreeAR } from 'expo-three';
import React from 'react';
import { Dimensions, StyleSheet, Animated, View } from 'react-native';
import { View as GraphicsView } from 'expo-graphics';
import TouchableView from './TouchableView';
import {
  PanGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  State,
} from 'react-native-gesture-handler';
console.disableYellowBox = true;

const { width, height } = Dimensions.get('window');

// A good read on lighting: https://threejs.org/examples/#webgl_lights_physical
export default class App extends React.Component {
  screenCenter = new THREE.Vector2(0.5, 0.5);

  _onRotateGestureEvent = (event) => {
    console.log(event.nativeEvent.rotation);
    if(this.mesh) {
      if (event.nativeEvent.rotation > 0.1 || event.nativeEvent.rotation < -0.1) {
        if ( event.nativeEvent.rotation > 1.5) {
          this.mesh.rotateY( -1.5 /20 );
        } else if ( event.nativeEvent.rotation < -1.5) {
          this.mesh.rotateY( 1.5 /20 );
        } else {
          this.mesh.rotateY( -event.nativeEvent.rotation /20 );
        }
      }
    }
  }

  render() {
    return (
      <RotationGestureHandler
      onGestureEvent={this._onRotateGestureEvent}
      >
      
      <Animated.View style={styles.wrapper}>
      {/* <TouchableView
        style={{ flex: 1 }}
        shouldCancelWhenOutside={false}
        onTouchesBegan={this.onTouchesBegan}> */}
        <GraphicsView
          style={styles.container}
          onContextCreate={this.onContextCreate}
          onRender={this.onRender}
          onResize={this.onResize}
          arTrackingConfiguration={AR.TrackingConfigurations.World}
          isArEnabled
          isArCameraStateEnabled
        />
        {/* </TouchableView> */}
      </Animated.View>
      </RotationGestureHandler>
    );
  }

  onTouchesBegan = async ({ locationX: x, locationY: y }) => {

    if (!this.renderer) {
      return;
    }
    // Get the size of the renderer
    const size = this.renderer.getSize();

    // Invoke the native hit test method
    const { hitTest } = await AR.performHitTest(
      {
        x: x / size.width,
        y: y / size.height,
      },
      // Result type from intersecting a horizontal plane estimate, determined for the current frame.
      AR.HitTestResultTypes.HorizontalPlane
    );

    // Create a new zone
    const geometry = new THREE.BoxGeometry( 0.7,0.04, 0.9);
    const material = new THREE.MeshPhongMaterial({
        color: 0xe5e5e5,
    });

    for (let hit of hitTest) {

      const { worldTransform } = hit;

      if (this.cube) {
        this.scene.remove(this.cube);
        this.scene.remove(this.mesh);
      }
        
      this.cube = new THREE.Mesh(geometry, material);
      this.cube.position.set(0, 0.5, 0);

      // mesh.rotation.z = Math.PI;
      this.cube.castShadow = true;

      this.mesh.add(this.cube);

      // Add the cube to the scene
      this.scene.add(this.mesh);

      // Disable the matrix auto updating system
      this.mesh.matrixAutoUpdate = false;

      const matrix = new THREE.Matrix4();
      matrix.fromArray(worldTransform);

      // Manually update the matrix
      this.mesh.applyMatrix(matrix);
      this.mesh.updateMatrix();
    }
  };

  onContextCreate = async ({ gl, scale: pixelRatio, width, height }) => {
    AR.setPlaneDetection(AR.PlaneDetectionTypes.Horizontal);

    this.renderer = new ExpoTHREE.Renderer({ gl, width, height, pixelRatio });

    // Enable some realist rendering props: https://threejs.org/docs/#api/renderers/WebGLRenderer.physicallyCorrectLights
    this.renderer.gammaInput = this.renderer.gammaOutput = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    // this.renderer.toneMappingExposure = Math.pow(0.68, 5.0); // to allow for very bright scenes.

    this.scene = new THREE.Scene();
    this.scene.background = new ThreeAR.BackgroundTexture(this.renderer);

    this.camera = new ThreeAR.Camera(width, height, 0.01, 1000);

    // Create ARKit lighting
    this.arPointLight = new ThreeAR.Light();
    this.arPointLight.position.y = 2;

    this.mesh = new THREE.Object3D();

    const geometry = new THREE.BoxGeometry( 0.7,0.04, 0.9);
    const material = new THREE.MeshPhongMaterial({
        color: 0xe5e5e5,
    });
      this.cube = new THREE.Mesh(geometry, material);
      this.cube.position.set(0, 0.05, 0);

      // mesh.rotation.z = Math.PI;
      this.cube.castShadow = true;

      this.mesh.add(this.cube);

      // Add the cube to the scene
      this.scene.add(this.mesh);

    this.scene.add(this.arPointLight);
    this.shadowLight = this.getShadowLight();
    this.scene.add(this.shadowLight);
    this.scene.add(this.shadowLight.target);
    // this.scene.add(new THREE.DirectionalLightHelper(this.shadowLight));

    this.scene.add(new THREE.AmbientLight(0x404040));

    this.shadowFloor = new ThreeAR.ShadowFloor({
      width: 1,
      height: 1,
      opacity: 0.6,
    });
    this.mesh.add(this.shadowFloor);

    // Create this cool utility function that let's us see all the raw data points.
    this.points = new ThreeAR.Points();
    // Add the points to our scene...
    this.scene.add(this.points);

    // Create this cool utility function that let's us see all the raw data points.
    this.planes = new ThreeAR.Planes();
    // Add the planes to our scene...
    this.scene.add(this.planes);
  };

  loadModel = async () => {
    const geometry = new THREE.BoxGeometry( 0.7,0.04, 0.9);
    const material = new THREE.MeshPhongMaterial({
        color: 0xe5e5e5,
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0.5, 0);

    mesh.castShadow = true;

    this.mesh.add(mesh);
  };

  onResize = ({ x, y, scale, width, height }) => {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(width, height);
  };

  onRender = delta => {

    // this.emissiveIntensity = this.intensity / Math.pow( 0.02, 2.0 ); // convert from intensity to irradiance at bulb surface

    // This will make the points get more rawDataPoints from Expo.AR
    this.points.update();
    this.planes.update();

    this.arPointLight.update();

    this.shadowFloor.opacity = this.arPointLight.intensity;

    this.shadowLight.target.position.copy(this.mesh.position);
    this.shadowLight.position.copy(this.shadowLight.target.position);
    this.shadowLight.position.x += 0.1;
    this.shadowLight.position.y += 1;
    this.shadowLight.position.z += 0.1;

    this.renderer.render(this.scene, this.camera);
  };

  getShadowLight = () => {
    let light = new THREE.DirectionalLight(0xffffff, 0.6);

    light.castShadow = true;

    // default is 50
    const shadowSize = 1;
    light.shadow.camera.left = -shadowSize;
    light.shadow.camera.right = shadowSize;
    light.shadow.camera.top = shadowSize;
    light.shadow.camera.bottom = -shadowSize;
    light.shadow.camera.near = 0.001;
    light.shadow.camera.far = 100;
    light.shadow.camera.updateProjectionMatrix();

    // default is 512
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = light.shadow.mapSize.width;

    return light;
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  wrapper: {
    flex: 1,
  },
});
