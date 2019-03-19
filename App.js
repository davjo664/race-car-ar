import { AR } from 'expo';
import ExpoTHREE, { THREE, AR as ThreeAR } from 'expo-three';
import React from 'react';
import { Dimensions, StyleSheet, Animated, View } from 'react-native';
import { View as GraphicsView } from 'expo-graphics';
import { API_KEY } from './apikey';
import { MTLLoader, OBJLoader } from 'three-obj-mtl-loader';
import Button from './Button';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  TapGestureHandler,
  RotationGestureHandler,
  PanGestureHandler,
  State,
  LongPressGestureHandler
} from 'react-native-gesture-handler';

import * as CANNON from 'cannon';
import { CannonWorld } from './cannonworld';
console.disableYellowBox = true;

/**
 * Set the steering value of a wheel.
 * @method setSteeringValue
 * @param {number} value
 * @param {integer} wheelIndex
 * @todo check coordinateSystem
 */
// Overrides setSteeringValue to use correct coordinate system
CANNON.RigidVehicle.prototype.setSteeringValue = function(value, wheelIndex){
  // Set angle of the hinge axis
  var axis = this.wheelAxes[wheelIndex];

  var c = Math.cos(value),
      s = Math.sin(value),
      x = axis.x,
      y = axis.z;
  this.constraints[wheelIndex].axisA.set(
      c*x -s*y,
      0,
      s*x +c*y
  );
};

const { width, height } = Dimensions.get('window');

export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = { vehicleShown: false };
  }

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

    // Add light that will cast shadows
    this.shadowLight = this._getShadowLight();
    this.scene.add(this.shadowLight);
    this.scene.add(this.shadowLight.target);
    
    this.scene.add(new THREE.AmbientLight(0xFFFFFF, 2));

    // A transparent plane that extends THREE.Mesh and receives shadows from other meshes.
    this.shadowFloor = new ThreeAR.ShadowFloor({
      width: 10,
      height: 10,
      opacity: 0.6,
    });
    this.shadowFloor.position.y = 0.0001;

    // Horizontal planes based on the raw data points.
    this.planes = new ThreeAR.Planes();
    this.scene.add(this.planes);

    // Ray caster for hit test
    this.raycaster = new THREE.Raycaster();

    this.cannonWorld = new CannonWorld();
    this.world = this.cannonWorld.getWorld();
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.gravity.set(0, -10, 0);
    this.world.solver.iterations = 30;
    this.world.defaultContactMaterial.friction = 0;

    this.jumps = [];
    this.shadowLights = [];
  };

  _initGround = (x, y, z) => {

    // ground
    this.groundMaterial = new CANNON.Material();
    this.groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.groundMaterial,
      position: new CANNON.Vec3(x,y,z),
    });
    this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    this.world.add(this.groundBody);

  }

  _initCar = (x,y,z) => {

    // Car
    // Based on the RigidVechicle demo from Cannon.js: https://github.com/schteppe/cannon.js/blob/master/demos/rigidVehicle.html
    var mass = 1;
    this.wheelMaterial = new CANNON.Material("wheelMaterial");
    var wheelGroundContactMaterial = new CANNON.ContactMaterial(this.wheelMaterial, this.groundMaterial, {
        friction: 0.05,
        restitution: 0,
        contactEquationStiffness: 1000
    });
    this.world.addContactMaterial(wheelGroundContactMaterial);
    var chassisShape;
    var centerOfMassAdjust = new CANNON.Vec3(0, 0, 0);
    chassisShape = new CANNON.Box(new CANNON.Vec3(0.35/6, 0.08/6, 0.20/6));
    var chassisBody = new CANNON.Body({ mass: 1, material: this.wheelMaterial });
    chassisBody.addShape(chassisShape, centerOfMassAdjust);
    chassisBody.position.set(x, y, z); //PLACE CAR

    // Create the vehicle
    this.wheelBodies = [];
    this.wheelMeshes = [];
    this.vehicle = new CANNON.RigidVehicle({
        chassisBody: chassisBody
    });
    var axisWidth = 0.5/6;
    var wheelShape = new CANNON.Cylinder(0.15/6, 0.15/6, 0.15/6, 20);
    var down = new CANNON.Vec3(0, -1, 0);
    var wheelBody = new CANNON.Body({ mass: mass, material: this.wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(0.35/6, -0.08/6, axisWidth/2).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down
    });
    this.wheelBodies.push(wheelBody);
    var wheelBody = new CANNON.Body({ mass: mass, material: this.wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(0.35/6, -0.08/6, -axisWidth/2).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down
    });
    this.wheelBodies.push(wheelBody);
    var wheelBody = new CANNON.Body({ mass: mass, material: this.wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(-0.35/6, -0.08/6, axisWidth/2).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down
    });
    this.wheelBodies.push(wheelBody);
    var wheelBody = new CANNON.Body({ mass: mass, material: this.wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(-0.35/6, -0.08/6, -axisWidth/2).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down
    });
    this.wheelBodies.push(wheelBody);
    // Some damping to not spin wheels too fast
    for(var i=0; i<this.vehicle.wheelBodies.length; i++){
      this.vehicle.wheelBodies[i].angularDamping = 0.4;
    }
    // Constrain wheels
    var constraints = [];
    // Add visuals
    this.chassiMesh = this.cannonWorld.addVisual(this.vehicle.chassisBody);
    this.chassiMesh.castShadow = true;
    this.chassiBody = this.vehicle.chassisBody;
    this.scene.add(this.chassiMesh);
    for(var i=0; i<this.vehicle.wheelBodies.length; i++){
        var mesh = this.cannonWorld.addVisual(this.vehicle.wheelBodies[i]);
        mesh.castShadow = true;
        this.wheelMeshes.push(mesh);
        this.scene.add(mesh);
    }
    this.vehicle.addToWorld(this.world);

    this.setState(previousState => (
      { vehicleShown: true }
    ))

  }

  _getShadowLight = () => {

    let light = new THREE.DirectionalLight(0xffffff, 0.2);

    light.castShadow = true;

    const shadowSize = 1;
    light.shadow.camera.left = -shadowSize;
    light.shadow.camera.right = shadowSize;
    light.shadow.camera.top = shadowSize;
    light.shadow.camera.bottom = -shadowSize;
    light.shadow.camera.near = 0.001;
    light.shadow.camera.far = 100;
    light.shadow.camera.updateProjectionMatrix();

    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = light.shadow.mapSize.width;

    return light;

  };

  //////////// GESTURE EVENTS ////////////////

  _onPanGestureEvent = async ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE && this.trackMesh) {
      var mesh;
      if (this.jumps.length == 0) {
        mesh = this.trackMesh;
      } else {
        mesh = this.jumps[this.jumps.length-1].mesh;
      }

      // Get the size of the renderer
      const size = this.renderer.getSize();

      const x = nativeEvent.x / size.width;
      const y = nativeEvent.y / size.height;

      // Reset earlier transformations
      mesh.position.set(0,0,0);
      mesh.rotation.set(0,0,0);
      mesh.updateMatrix()

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
        mesh.applyMatrix(matrix);
        mesh.updateMatrix();

        if(this.jumps.length == 0) {
          this.groundBody.position.y = this.trackMesh.position.y+0.01; //PLACE CAR
        } else {
          mesh.position.y = this.trackMesh.position.y+0.04;
          this.jumps[this.jumps.length-1].body.position.copy(mesh.position);
        }
      }
    }
  };

  _onRotateGestureEvent = (event) => {
    if( event.nativeEvent.state === State.ACTIVE && this.trackMesh) {
      if (event.nativeEvent.rotation > 0.1 || event.nativeEvent.rotation < -0.1) {
        var rotateVal = 0;
        if ( event.nativeEvent.rotation > 1.5) {
          rotateVal = -1.5 /30;
        } else if ( event.nativeEvent.rotation < -1.5) {
          rotateVal = 1.5 /30;
        } else {
          rotateVal = -event.nativeEvent.rotation /30;
        }

        if (this.jumps.length == 0) {
          this.track.rotateY( rotateVal );
        } else {
          var obj = this.jumps[this.jumps.length-1];
          // Reset earlier transformations
          var rotY = obj.mesh.rotation.y;
          obj.mesh.rotation.set(0,0,0);
          obj.mesh.updateMatrix()
          obj.mesh.rotateY( rotateVal + rotY );
          obj.mesh.rotateX( 15*0.0174532925 );
          obj.body.quaternion.copy(obj.mesh.quaternion);
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
      this._placeJump(x / size.width, y / size.height);
    }
  };

  //////// HELPER FUNCTIONS FOR GESTURES ///////////

  _placeJump = async (x, y) => {

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
      if (!this.trackMesh) {
        // Adding the track
        this._loadAsset( worldTransform );
      } else {
        var vec = new THREE.Vector3();
        this.camera.getWorldPosition(vec);
        
        const jumpPhysicsMaterial = new CANNON.Material();
        const jump = {}
        jump.body = new CANNON.Body({ 
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.15,0.001,0.15)),
        material: jumpPhysicsMaterial,
          position: new CANNON.Vec3(vec.x, this.trackMesh.position.y+0.04, vec.z),
        });
        this.world.add(jump.body);
        jump.mesh = this.cannonWorld.addVisual(jump.body);
        this.scene.add(jump.mesh);
        this.jumps.push(jump);
        this.world.addContactMaterial(new CANNON.ContactMaterial(
        this.wheelMaterial, jumpPhysicsMaterial, {
          restitution: 0,
          friction: 1
        }));

        jump.mesh.rotateX( 15*0.0174532925 );
        jump.body.quaternion.copy(jump.mesh.quaternion);

        // Add light that will cast shadows
        this.shadowLights.push(this._getShadowLight());
        this.scene.add(this.shadowLights[this.shadowLights.length-1]);
        this.scene.add(this.shadowLights[this.shadowLights.length-1].target);
      }
    }

  };

  _loadAsset = ( worldTransform ) => {

    var url = `https://poly.googleapis.com/v1/assets/bESvWAwSMwy/?key=${API_KEY}`;

    var request = new XMLHttpRequest();
    request.open( 'GET', url, true );
    request.addEventListener( 'load', ( event ) => {

      var asset = JSON.parse( event.target.response );
      var format = asset.formats.find( format => { return format.formatType === 'OBJ'; } );
      if ( format !== undefined ) {
        var obj = format.root;
        var loader = new THREE.OBJLoader();

        loader.load( obj.url, ( object ) => {

          // Creates a box around the chair to be able to know the longest side
          var box = new THREE.Box3();
          box.setFromObject( object );

          object.rotation.set(0,-90*0.0174532925,0);

          this.track = new THREE.Group();
          this.track.add( object );
          // Scale the chair so that the Longest side will be 1 meter
          this.track.scale.setScalar( 5 / box.getSize().length() );
          this.track.position.setY(-0.01); //Correction for the chair model
          
          // console.log(object.children);
          object.children[0].material = new THREE.LineBasicMaterial( { color: 0xffffff } ) 
          object.children[1].material = new THREE.MeshBasicMaterial( { color: 0x111111 } );

          this.trackMesh = new THREE.Object3D();
          this.trackMesh.add(this.track);
          this.scene.add(this.trackMesh);
          this.trackMesh.add(this.shadowFloor);

          // Disable the matrix auto updating system
          this.trackMesh.matrixAutoUpdate = false;

          const matrix = new THREE.Matrix4();
          matrix.fromArray(worldTransform);

          // Manually update the matrix
          this.trackMesh.applyMatrix(matrix);
          this.trackMesh.updateMatrix();

          this.scene.add(this.trackMesh);
          this._initGround(this.trackMesh.position.x, this.trackMesh.position.y, this.trackMesh.position.z);
          this._initCar(this.trackMesh.position.x, this.trackMesh.position.y+0.7, this.trackMesh.position.z);
          this.scene.remove(this.planes);

          console.log("Done loading asset");

        });
      }
    } );
    request.send( null );

  }

  //////////////////// RESIZE AND RENDER ////////////////////////////////

  _onResize = ({ x, y, scale, width, height }) => {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(width, height);
  };

  _onRender = delta => {

    // Update data planes
    if (!this.chassiMesh) {
      this.planes.update();
    }

    // update world
    this.world.step(1 / 60);

    // update jump objects
    if (this.jumps) {
      for (var i = 0; i < this.jumps.length; i++) {
        this.jumps[i].mesh.position.copy(this.jumps[i].body.position);
        this.jumps[i].mesh.quaternion.copy(this.jumps[i].body.quaternion);

        var shadowLight = this.shadowLights[i];
        
        shadowLight.target.position.copy(this.jumps[i].mesh.position);
        shadowLight.position.copy(shadowLight.target.position);

        // Place the shadow light source over the object and a bit tilted
        shadowLight.position.x += 0.1;
        shadowLight.position.y += 1;
        shadowLight.position.z += 0.1;
      }
    }

    // update wheel objects
    if (this.wheelBodies) {
      for(var i = 0; i < this.wheelBodies.length; i++) {
        this.wheelMeshes[i].position.copy(this.wheelBodies[i].position);
        this.wheelMeshes[i].quaternion.copy(this.wheelBodies[i].quaternion);
      }
    }

    // update chassi object
    if (this.chassiMesh) {
      this.chassiMesh.position.copy(this.chassiBody.position);
      this.chassiMesh.quaternion.copy(this.chassiBody.quaternion);
    }

    if (this.chassiMesh) {
      this.shadowLight.target.position.copy(this.chassiMesh.position);
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
      <PanGestureHandler onGestureEvent={this._onPanGestureEvent}>
        <Animated.View style={styles.wrapper}>
          <RotationGestureHandler onGestureEvent={this._onRotateGestureEvent}>
            <Animated.View style={styles.wrapper}>
              <TapGestureHandler onHandlerStateChange={this._onSingleTap}>
                <Animated.View style={styles.wrapper}>
                  <LongPressGestureHandler
                    onHandlerStateChange={({ nativeEvent }) => {
                      if (nativeEvent.state === State.ACTIVE && this.chassiMesh) {
                        // Add an impulse to the center
                        var impulse = new CANNON.Vec3(10,20,0);
                        this.chassiBody.applyImpulse(impulse,this.chassiBody.position);
                      }
                    }}
                    minDurationMs={500}>
                    <Animated.View style={styles.wrapper}>
                      <View style={{
                          flex: 1, 
                          flexDirection: 'row',
                          position: 'absolute',
                          justifyContent: 'space-between',
                          bottom: this.state.vehicleShown ? 20 : -80,
                          left: 0
                        }}>
                        <Button 
                          name={"left"}
                          handlePress={()=>{
                            // console.log("LEFT")
                            // this.vehicle.setSteeringValue(-0.1, 0); //LEFT REAR
                            //this.vehicle.setSteeringValue(10, 1); //RIGHT REAR
                            this.vehicle.setSteeringValue(-0.4, 2); //LEFT FRONT
                            this.vehicle.setSteeringValue(-0.4, 3); // RIGHT FRONT

                          }}
                          handleRelease={()=>{
                            // console.log("LEFT END")
                            this.vehicle.setSteeringValue(0, 2);
                            this.vehicle.setSteeringValue(0, 3);
                          }}
                          />

                          <Button 
                          name={"right"}
                          handlePress={()=>{
                            this.vehicle.setSteeringValue(0.3, 2); 
                            this.vehicle.setSteeringValue(0.3, 3);

                          }}
                          handleRelease={()=>{
                            this.vehicle.setSteeringValue(0, 2);
                            this.vehicle.setSteeringValue(0, 3);
                          }}
                          />

                          <Button 
                          name={"up"}
                          handlePress={()=>{
                            this.vehicle.setWheelForce(0.45, 2);
                            this.vehicle.setWheelForce(0.45, 3);
                          }}
                          handleRelease={()=>{
                            this.vehicle.setWheelForce(0, 2);
                            this.vehicle.setWheelForce(0, 3);
                          }}
                          />
                          <Button 
                          name={"down"}
                          handlePress={()=>{
                            this.vehicle.setWheelForce(-0.3, 2);
                            this.vehicle.setWheelForce(-0.3, 3);
                          }}
                          handleRelease={()=>{
                            this.vehicle.setWheelForce(0, 2);
                            this.vehicle.setWheelForce(0, 3);
                          }}
                          />
                      </View>
                      <GraphicsView
                        style={styles.container}
                        onContextCreate={this._onContextCreate}
                        onRender={this._onRender}
                        // onResize={this._onResize}
                        // ARKit config - Tracks a device's orientation and position, and detects real-world surfaces, and known images or objects.
                        arTrackingConfiguration={AR.TrackingConfigurations.World}
                        // Enables an ARKit context
                        isArEnabled
                        // Renders information related to ARKit the tracking state
                        isArCameraStateEnabled
                      />
                    </Animated.View>
                  </LongPressGestureHandler>
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
  container: { flex: 1, zIndex: -1 },
  wrapper: { flex: 1 },
  button: {
    height:80,
    position: 'absolute',
    bottom: height-200,
    left: 0
  }
});