import { AR } from 'expo';
import ExpoTHREE, { THREE, AR as ThreeAR } from 'expo-three';
import React from 'react';
import { Dimensions, StyleSheet, Animated, View } from 'react-native';
import { View as GraphicsView } from 'expo-graphics';
import { API_KEY } from './apikey';
import { MTLLoader, OBJLoader } from 'three-obj-mtl-loader';
import Button from './Button';
import {
  TapGestureHandler,
  RotationGestureHandler,
  PanGestureHandler,
  State,
  LongPressGestureHandler
} from 'react-native-gesture-handler';

import * as CANNON from 'cannon';
import { Demo } from './cannon.demo';
console.disableYellowBox = true;

/**
 * Set the steering value of a wheel.
 * @method setSteeringValue
 * @param {number} value
 * @param {integer} wheelIndex
 * @todo check coordinateSystem
 */
CANNON.RigidVehicle.prototype.setSteeringValue = function(value, wheelIndex){
  console.log("STEERSSS");
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

    // this.world = new CANNON.World();
    // this.world.gravity.set(0,-10,0);
    // this.world.broadphase = new CANNON.NaiveBroadphase();
    // this.world.solver.iterations = 10;
    var geometry = new THREE.BoxGeometry( 0.4, 0.4, 0.4 );
    var material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false } );
    this.objects = [];

    var demo = new Demo();
    // this.world = new CANNON.World();
    this.world = demo.getWorld();
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.gravity.set(0, -10, 0);
    this.world.defaultContactMaterial.friction = 0;

    // ground
    const groundMaterial = new CANNON.Material();
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: groundMaterial,
      position: new CANNON.Vec3(0,-0.7, 0),
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    this.world.add(groundBody);

    this.mesh3 = new THREE.Mesh( new THREE.BoxGeometry( 5, 0.05, 5 ), new THREE.MeshBasicMaterial( { color: 0x0000ff, wireframe: false } ) );
    this.mesh3.position.set(0,-0.7, 0);
    this.scene.add( this.mesh3 );

    // Car
    var mass = 5;
    var wheelMaterial = new CANNON.Material("wheelMaterial");
    var wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
        friction: 0.3,
        restitution: 0,
        contactEquationStiffness: 1000
    });
    // We must add the contact materials to the world
    this.world.addContactMaterial(wheelGroundContactMaterial);
    var chassisShape;
    var centerOfMassAdjust = new CANNON.Vec3(0, 0, 0);
    chassisShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.01, 0.20));
    var chassisBody = new CANNON.Body({ mass: 100 });
    chassisBody.addShape(chassisShape, centerOfMassAdjust);
    chassisBody.position.set(0, 50, 0); //PLACE CAR

    // Create the vehicle
    this.wheelBodies = [];
    this.wheelMeshes = [];
    this.vehicle = new CANNON.RigidVehicle({
        chassisBody: chassisBody
    });
    var axisWidth = 0.6;
    // var wheelShape = new CANNON.Sphere(0.125);
    var wheelShape = new CANNON.Cylinder(0.125, 0.125, 0.125 / 2, 20);
    var down = new CANNON.Vec3(0, -1, 0);
    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(0.5, -0.1, axisWidth/2).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down
    });
    this.wheelBodies.push(wheelBody);
    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(0.5, -0.1, -axisWidth/2).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down
    });
    this.wheelBodies.push(wheelBody);
    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(-0.5, -0.1, axisWidth/2).vadd(centerOfMassAdjust),
        axis: new CANNON.Vec3(0, 0, 1),
        direction: down
    });
    this.wheelBodies.push(wheelBody);
    var wheelBody = new CANNON.Body({ mass: mass, material: wheelMaterial });
    wheelBody.addShape(wheelShape);
    this.vehicle.addWheel({
        body: wheelBody,
        position: new CANNON.Vec3(-0.5, -0.1, -axisWidth/2).vadd(centerOfMassAdjust),
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
    this.chassiMesh = demo.addVisual(this.vehicle.chassisBody);
    this.chassiBody = this.vehicle.chassisBody;
    this.scene.add(this.chassiMesh);
    for(var i=0; i<this.vehicle.wheelBodies.length; i++){
        var mesh = demo.addVisual(this.vehicle.wheelBodies[i]);
        this.wheelMeshes.push(mesh);
        this.scene.add(mesh);
    }
    this.vehicle.addToWorld(this.world);

    // var wheelMaterial = new CANNON.Material("wheelMaterial");
    // var wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
    //     friction: 0.3,
    //     restitution: 0,
    //     contactEquationStiffness: 1000
    // });

    // // We must add the contact materials to the world
    // this.world.addContactMaterial(wheelGroundContactMaterial);

    // var chassiShape;
    // chassiShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.25,0.125));
    // this.chassiBody = new CANNON.Body({ mass: 150 });
    // this.chassiBody.addShape(chassiShape);
    // this.chassiBody.position.set(0, 6, 0);
    // // this.chassiBody.angularVelocity.set(0, 0.5, 0);
    // // this.chassiMesh = new THREE.Mesh( new THREE.BoxGeometry( 1, 0.5, 0.25 ), new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: false } ) );
    // // this.scene.add( this.chassiMesh );
    // this.chassiMesh = demo.addVisual(this.chassiBody);
    // // this.scene.add(this.chassiMesh);

    // var options = {
    //     radius: 0.125,
    //     directionLocal: new CANNON.Vec3(1, 0, 0),
    //     suspensionStiffness: 30,
    //     suspensionRestLength: 0.3,
    //     frictionSlip: 5,
    //     dampingRelaxation: 2.3,
    //     dampingCompression: 4.4,
    //     maxSuspensionForce: 100000,
    //     rollInfluence:  0.01,
    //     axleLocal: new CANNON.Vec3(0, 1, 0),
    //     chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
    //     maxSuspensionTravel: 0.3,
    //     customSlidingRotationalSpeed: -30,
    //     useCustomSlidingRotationalSpeed: true
    // };

    // // Create the vehicle
    // vehicle = new CANNON.RaycastVehicle({
    //     chassisBody: this.chassiBody,
    // });

    // options.chassisConnectionPointLocal.set(0.25, 0.25, 0);
    // vehicle.addWheel(options);

    // options.chassisConnectionPointLocal.set(0.25, -0.25, 0);
    // vehicle.addWheel(options);

    // options.chassisConnectionPointLocal.set(-0.25, 0.25, 0);
    // vehicle.addWheel(options);

    // options.chassisConnectionPointLocal.set(-0.25, -0.25, 0);
    // vehicle.addWheel(options);

    // vehicle.addToWorld(this.world);

    // this.wheelBodies = [];
    // this.wheelMeshes = [];
    // for(var i=0; i<vehicle.wheelInfos.length; i++){
    //     var wheel = vehicle.wheelInfos[i];
    //     var cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
    //     var wheelBody = new CANNON.Body({
    //         mass: 0
    //     });
    //     wheelBody.type = CANNON.Body.KINEMATIC;
    //     wheelBody.collisionFilterGroup = 0; // turn off collisions
    //     var q = new CANNON.Quaternion();
    //     q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    //     wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
    //     this.wheelBodies.push(wheelBody);
    //     // this.wheelMesh = new THREE.Mesh( new THREE.BoxGeometry( 1, 0.5, 0.25 ), new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: false } ) );
    //     // this.scene.add( this.chassiMesh );
    //     // demo.addVisual(wheelBody);
    //     var wheelMesh = demo.addVisual(wheelBody);
    //     this.wheelMeshes.push(wheelMesh);
    //     this.scene.add(wheelMesh);
    //     this.world.addBody(wheelBody);
    // }

      // Update wheels
      this.world.addEventListener('postStep', () => {
        // for (var i = 0; i < vehicle.wheelInfos.length; i++) {
        //     vehicle.updateWheelTransform(i);
        //     var t = vehicle.wheelInfos[i].worldTransform;
        //     var wheelBody = this.wheelBodies[i];
        //     wheelBody.position.copy(t.position);
        //     wheelBody.quaternion.copy(t.quaternion);
        // }
        // // console.log("poststep");
        // vehicle.applyEngineForce(-1, 2);
        // this.vehicle.setSteeringValue(10, 1);
        // this.vehicle.setSteeringValue(10, 3);
        // this.vehicle.setWheelForce(-10, 1);
        // this.vehicle.setWheelForce(-10, 3);
    });

    // ball
    // const ballPhysicsMaterial = new CANNON.Material();
    // for (let i = 0; i < 5; ++i) {
    //   const ball = {}
    //   // ball.mesh = new THREE.Mesh( geometry, material );
    //   // this.scene.add(ball.mesh);
    //   ball.body = new CANNON.Body({
    //     mass: 2,
    //     shape: new CANNON.Box(new CANNON.Vec3(0.2,0.2,0.2)),
    //     material: ballPhysicsMaterial,
    //     position: new CANNON.Vec3(Math.random()*0.5, 1, -1 + Math.random()*0.5),
    //   });
    //   this.world.add(ball.body);
    //   ball.mesh = demo.addVisual(ball.body);
    //   this.scene.add(ball.mesh);
    //   this.objects.push(ball);
    // }
    // this.world.addContactMaterial(new CANNON.ContactMaterial(
    //   groundMaterial, ballPhysicsMaterial, {
    //     restitution: 0.7,
    //     friction: 0.6,
    //   }));
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
    console.log("pan");
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

    // update world
    this.world.step(1 / 60);

    // // update objects
    // this.objects.forEach(({ mesh, body }) => {
    //   mesh.position.copy(body.position);
    //   mesh.quaternion.copy(body.quaternion);
    // });

    // update objects
    for(var i = 0; i < this.wheelBodies.length; i++) {
      this.wheelMeshes[i].position.copy(this.wheelBodies[i].position);
      this.wheelMeshes[i].quaternion.copy(this.wheelBodies[i].quaternion);
    }

    this.chassiMesh.position.copy(this.chassiBody.position);
    this.chassiMesh.quaternion.copy(this.chassiBody.quaternion);
    

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
                <Animated.View style={styles.container}>
                  <Button container={{
                    flex: 1, 
                    flexDirection: 'row',
                    position: 'absolute',
                    bottom: 0,
                    left: 0
                  }}
                  label={"LEFT"}
                  handlePress={()=>{
                    console.log("LEFT")
                    // this.vehicle.setSteeringValue(-0.1, 0); //LEFT REAR
                    //this.vehicle.setSteeringValue(10, 1); //RIGHT REAR
                    this.vehicle.setSteeringValue(-0.5, 2); //LEFT FRONT
                    this.vehicle.setSteeringValue(-0.5, 3); // RIGHT FRONT

                    // this.vehicle.setWheelForce(0, 2);
                    // this.vehicle.setWheelForce(200, 3);
                  }}
                  handleRelease={()=>{
                    console.log("LEFT END")
                    this.vehicle.setSteeringValue(0, 2);
                    this.vehicle.setSteeringValue(0, 3);
                    // this.vehicle.setSteeringValue(0, 1);
                    // this.vehicle.setSteeringValue(0, 2);
                    // this.vehicle.setSteeringValue(0, 3);
                    // this.vehicle.setSteeringValue(0, 0);
                  }}
                  />

                  <Button container={{
                    flex: 1, 
                    flexDirection: 'row',
                    position: 'absolute',
                    bottom: 0,
                    right: 0
                  }}
                  label={"GO"}
                  handlePress={()=>{
                    console.log("GO")
                    // this.vehicle.setWheelForce(1, 0);
                    // this.vehicle.setWheelForce(1, 1);
                    this.vehicle.setWheelForce(100, 2);
                    this.vehicle.setWheelForce(100, 3);
                    // this.vehicle.setWheelForce(50, 3);
                  }}
                  handleRelease={()=>{
                    console.log("GO END")
                    this.vehicle.setWheelForce(0, 2);
                    this.vehicle.setWheelForce(0, 3);
                    // this.vehicle.setMotorSpeed(0,0);
                    // this.vehicle.setMotorSpeed(0,2);
                    // this.vehicle.setWheelForce(0, 0);
                    // this.vehicle.setWheelForce(0, 1);
                    // this.vehicle.setWheelForce(0, 2);
                    // this.vehicle.setWheelForce(0, 3);
                  }}
                  />
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
  container: { flex: 1, zIndex: -1 },
  wrapper: { flex: 1 }
});