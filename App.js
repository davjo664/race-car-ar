import { AR } from 'expo';
import ExpoTHREE, { THREE, AR as ThreeAR } from 'expo-three';
import React from 'react';
import { Dimensions, StyleSheet, Animated, View } from 'react-native';
import { View as GraphicsView } from 'expo-graphics';
import { API_KEY } from './apikey';
import { MTLLoader, OBJLoader } from 'three-obj-mtl-loader';
import {
  TapGestureHandler,
  RotationGestureHandler,
  PanGestureHandler,
  State
} from 'react-native-gesture-handler';
console.disableYellowBox = true;

const { width, height } = Dimensions.get('window');

export default class App extends React.Component {

  /////////// CREATE CONTEXT ////////////////////

  _onContextCreate = async ({ gl, scale: pixelRatio, width, height }) => {

    // Allows ARKit to collect Horizontal surfaces
    AR.setPlaneDetection(AR.PlaneDetectionTypes.Horizontal);

    this.renderer = new ExpoTHREE.Renderer({ gl, width, height, pixelRatio });

    // Enable some realist rendering props: https://threejs.org/docs/#api/renderers/WebGLRenderer.physicallyCorrectLights
    this.renderer.gammaInput = this.renderer.gammaOutput = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;

    this.scene = new THREE.Scene();
    // Render the video feed behind the scene's objects
    this.scene.background = new ThreeAR.BackgroundTexture(this.renderer);

    // THREE.PerspectiveCamera that updates it's transform based on the device's orientation
    this.camera = new ThreeAR.Camera(width, height, 0.01, 10000);

    // THREE.PointLight that will update it's color and intensity based on ARKit's assumption of the room lighting.
    this.arPointLight = new ThreeAR.Light();
    this.arPointLight.position.y = 2;
    this.scene.add(this.arPointLight);

    // Add light that will cast shadows
    this.shadowLight = this._getShadowLight();
    this.scene.add(this.shadowLight);
    this.scene.add(this.shadowLight.target);
    // this.scene.add(new THREE.DirectionalLightHelper(this.shadowLight));

    
    // this.scene.add(new THREE.AmbientLight(0x404040));

    // A transparent plane that extends THREE.Mesh and receives shadows from other meshes.
    this.shadowFloor = new ThreeAR.ShadowFloor({
      width: 1,
      height: 1,
      opacity: 0.6,
    });

    // Let's us see all the raw data points.
    this.points = new ThreeAR.Points();
    this.scene.add(this.points);

    // Let's us see all horizontal planes based on the raw data points.
    this.planes = new ThreeAR.Planes();
    this.scene.add(this.planes);

    // Ray caster for hit test
    this.raycaster = new THREE.Raycaster();
  };

  _getShadowLight = () => {
    let light = new THREE.DirectionalLight(0xffffff, 0.2);

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

  //////////// GESTURE EVENTS ////////////////

  _onPanGestureEvent = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE && this.mesh) {
      this.chair.position.setY(0.1);

      // Get the size of the renderer
      const size = this.renderer.getSize();

      const x = nativeEvent.x / size.width;
      const y = nativeEvent.y / size.height;

      // Reset earlier transformations
      this.mesh.position.set(0,0,0);
      this.mesh.rotation.set(0,0,0);
      this.mesh.updateMatrix()

      // Invoke the native hit test method from ARKit
      const { hitTest } = await AR.performHitTest(
        {
          x: x,
          y: y
        },
        // Result type from intersecting a horizontal plane estimate
        AR.HitTestResultTypes.HorizontalPlane
      );

      for (let hit of hitTest) {

        const { worldTransform } = hit;
  
        const matrix = new THREE.Matrix4();
        matrix.fromArray(worldTransform);
  
        // Manually update the matrix
        this.mesh.applyMatrix(matrix);
        this.mesh.updateMatrix();
      }
    }
  };

  _onRotateGestureEvent = (event) => {
    // console.log(event.nativeEvent.rotation);
    if( event.nativeEvent.state === State.ACTIVE && this.mesh ) {
      if (event.nativeEvent.rotation > 0.1 || event.nativeEvent.rotation < -0.1) {
        if ( event.nativeEvent.rotation > 1.5) {
          this.chair.rotateY( -1.5 /30 );
        } else if ( event.nativeEvent.rotation < -1.5) {
          this.chair.rotateY( 1.5 /30 );
        } else {
          this.chair.rotateY( -event.nativeEvent.rotation /30 );
        }
      }
    }
  }

  _onSingleTap = ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      const x = nativeEvent.x;
      const y = nativeEvent.y;

      if (!this.renderer) {
        return;
      }
      // Get the size of the renderer
      const size = this.renderer.getSize();

      if (!this.mesh) {
        this._placeCube(x / size.width, y / size.height);
      } else {
        // this._runHitTest(x / size.width, y / size.height)
      }
    }
  };

  //////// HELPER FUNCTIONS FOR GESTURES ///////////

  _placeCube = async (x, y) => {

    if (!this.renderer) {
      return;
    }

    // Invoke the native hit test method
    const { hitTest } = await AR.performHitTest(
      {
        x: x,
        y: y
      },
      // Result type from intersecting a horizontal plane estimate.
      AR.HitTestResultTypes.HorizontalPlane
    );

    for (let hit of hitTest) {

      const { worldTransform } = hit;
      this._loadAsset(worldTransform );
        
    }
  };

  _loadAsset = (worldTransform ) => {

    var url = `https://poly.googleapis.com/v1/assets/7Jl72KgiRl-/?key=${API_KEY}`;

    var request = new XMLHttpRequest();
    request.open( 'GET', url, true );
    request.addEventListener( 'load', ( event ) => {

      var asset = JSON.parse( event.target.response );

      var format = asset.formats.find( format => { return format.formatType === 'OBJ'; } );

      if ( format !== undefined ) {

        var obj = format.root;
        var mtl = format.resources.find( resource => { return resource.url.endsWith( 'mtl' ) } );

        var path = obj.url.slice( 0, obj.url.indexOf( obj.relativePath ) );

        var loader = new THREE.MTLLoader();
        loader.setCrossOrigin( true );
        loader.setMaterialOptions( { ignoreZeroRGBs: true } );
        loader.setTexturePath( path );
        loader.load( mtl.url, ( materials ) => {

          var loader = new THREE.OBJLoader();
          loader.setMaterials( materials );
          loader.load( obj.url, ( object ) => {

            // Creates a box around the chair to be able to know the longest side
            var box = new THREE.Box3();
            box.setFromObject( object );

            object.rotation.set(-90*0.0174532925,0,0);

            this.chair = new THREE.Group();
            this.chair.add( object );
            // Scale the chair so that the Longest side will be 1 meter
            this.chair.scale.setScalar( 1 / box.getSize().length() );
            this.chair.position.setY(-0.005); //Correction for the chair model

            // The chair should cast shadows
            let chairMesh:THREE.Mesh = object.children[0];
            chairMesh.castShadow = true;

            this.mesh = new THREE.Object3D();
            this.mesh.add(this.chair);
            this.scene.add(this.mesh);
            this.mesh.add(this.shadowFloor);

            // Disable the matrix auto updating system
            this.mesh.matrixAutoUpdate = false;

            const matrix = new THREE.Matrix4();
            matrix.fromArray(worldTransform);

            // Manually update the matrix
            this.mesh.applyMatrix(matrix);
            this.mesh.updateMatrix();

            this.scene.add(this.mesh);

            console.log("Done loading asset");

          } );
        } );
      }
    } );
    request.send( null );
  }

  _runHitTest = (x, y) => {
    const touch = {x: x, y: y};
    this.raycaster.setFromCamera(touch, this.camera);
    const intersects = this.raycaster.intersectObjects(this.mesh.children);
    if (intersects.length > 0) {
      console.log("HIT");
    }
  };

  _onPanEnd = ( event ) => {
    this.chair.position.setY(-0.005);
  }

  //////////////////// RESIZE AND RENDER ////////////////////////////////

  _onResize = ({ x, y, scale, width, height }) => {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(width, height);
  };

  _onRender = delta => {

    // Update data points and planes
    this.points.update();
    this.planes.update();

    // Updates our light based on real light
    this.arPointLight.update();

    if (this.mesh) {
      this.shadowFloor.opacity = this.arPointLight.intensity;
      this.shadowLight.target.position.copy(this.mesh.position);
      this.shadowLight.position.copy(this.shadowLight.target.position);

      // Place the shadow light source over the object and a bit tilted
      this.shadowLight.position.x += 0.1;
      this.shadowLight.position.y += 1;
      this.shadowLight.position.z += 0.1;
    }

    this.renderer.render(this.scene, this.camera);
  };

  render() {
    return (
      <PanGestureHandler onGestureEvent={this._onPanGestureEvent} onHandlerStateChange={this._onPanEnd}>
        <Animated.View style={styles.wrapper}>
          <RotationGestureHandler onGestureEvent={this._onRotateGestureEvent}>
            <Animated.View style={styles.wrapper}>
              <TapGestureHandler onHandlerStateChange={this._onSingleTap}>
                <Animated.View style={styles.wrapper}>
                  <GraphicsView
                    style={styles.container}
                    onContextCreate={this._onContextCreate}
                    onRender={this._onRender}
                    onResize={this._onResize}
                    // ARKit config - Tracks a device's orientation and position, and detects real-world surfaces, and known images or objects.
                    arTrackingConfiguration={AR.TrackingConfigurations.World}
                    // Enables an ARKit context
                    isArEnabled
                    // Renders information related to ARKit the tracking state
                    isArCameraStateEnabled
                  />
                </Animated.View>
              </TapGestureHandler>
            </Animated.View>
            </RotationGestureHandler>
        </Animated.View>
        </PanGestureHandler>
      
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrapper: { flex: 1 }
});
