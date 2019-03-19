import * as CANNON from 'cannon';

// Based on cannon demo scene: https://github.com/schteppe/cannon.js/blob/master/build/cannon.demo.js
export const CannonWorld = function(){

    // Global settings
    var settings = this.settings = {
        rendermode: "solid",
    };

    var bodies = this.bodies = [];
    var visuals = this.visuals = [];

    // Material
    var materialColor = 0xdddddd;
    var solidMaterial = new THREE.MeshLambertMaterial( { color: materialColor } );
    var wireframeMaterial = new THREE.MeshLambertMaterial( { color: 0xffffff, wireframe:true } );
    this.currentMaterial = solidMaterial;

    // Create physics world
    var world = this.world = new CANNON.World();
    world.broadphase = new CANNON.NaiveBroadphase();

};
CannonWorld.prototype = new CANNON.EventTarget();
CannonWorld.constructor = CannonWorld;

CannonWorld.prototype.getWorld = function(){
    return this.world;
};

CannonWorld.prototype.addVisual = function(body){
    var s = this.settings;
    // What geometry should be used?
    var mesh;
    if(body instanceof CANNON.Body){
        mesh = this.shape2mesh(body);
    }
    if(mesh) {
        // Add body
        this.bodies.push(body);
        this.visuals.push(mesh);
        body.visualref = mesh;
        body.visualref.visualId = this.bodies.length - 1;
        //mesh.useQuaternion = true;
        return mesh;
    }
};

CannonWorld.prototype.addVisuals = function(bodies){
    for (var i = 0; i < bodies.length; i++) {
        this.addVisual(bodies[i]);
    }
};


CannonWorld.prototype.shape2mesh = function(body){
    var wireframe = this.settings.renderMode === "wireframe";
    var obj = new THREE.Object3D();

    for (var l = 0; l < body.shapes.length; l++) {
        var shape = body.shapes[l];

        var mesh;

        switch(shape.type){

        case CANNON.Shape.types.PLANE:
            var geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
            mesh = new THREE.Object3D();
            var submesh = new THREE.Object3D();
            var ground = new THREE.Mesh( geometry, this.currentMaterial );
            ground.scale.set(100, 100, 100);
            submesh.add(ground);

            ground.castShadow = true;
            ground.receiveShadow = true;

            mesh.add(submesh);
            break;

        case CANNON.Shape.types.BOX:
            var box_geometry = new THREE.BoxGeometry(  shape.halfExtents.x*2,
                                                        shape.halfExtents.y*2,
                                                        shape.halfExtents.z*2 );
            console.log(shape.halfExtents.y);
            var color = shape.halfExtents.y > 0.006 ? { color: 0x0000dd } : { color: 0xff0000 };
            mesh = new THREE.Mesh( box_geometry, new THREE.MeshLambertMaterial( color ) );
            break;

        case CANNON.Shape.types.CONVEXPOLYHEDRON:
            var geo = new THREE.Geometry();

            // Add vertices
            for (var i = 0; i < shape.vertices.length; i++) {
                var v = shape.vertices[i];
                geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
            }

            for(var i=0; i < shape.faces.length; i++){
                var face = shape.faces[i];

                // add triangles
                var a = face[0];
                for (var j = 1; j < face.length - 1; j++) {
                    var b = face[j];
                    var c = face[j + 1];
                    geo.faces.push(new THREE.Face3(a, b, c));
                }
            }
            geo.computeBoundingSphere();
            geo.computeFaceNormals();
            mesh = new THREE.Mesh( geo, new THREE.MeshLambertMaterial( { color: 0x999999 } ) );
            break;


        default:
            throw "Visual type not recognized: "+shape.type;
        }

        mesh.receiveShadow = true;
        mesh.castShadow = true;
        if(mesh.children){
            for(var i=0; i<mesh.children.length; i++){
                mesh.children[i].castShadow = true;
                mesh.children[i].receiveShadow = true;
                if(mesh.children[i]){
                    for(var j=0; j<mesh.children[i].length; j++){
                        mesh.children[i].children[j].castShadow = true;
                        mesh.children[i].children[j].receiveShadow = true;
                    }
                }
            }
        }

        var o = body.shapeOffsets[l];
        var q = body.shapeOrientations[l];
        mesh.position.set(o.x, o.y, o.z);
        mesh.quaternion.set(q.x, q.y, q.z, q.w);

        obj.add(mesh);
    }

    return obj;
};
