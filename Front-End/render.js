var canvas = document.getElementById("renderCanvas"); // Get the canvas element 
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

var previouslySelected;

/******* Add the create scene function ******/
var createScene = function () {
	document.getElementsByTagName("body")[0].setAttribute("oncontextmenu", "return false");
	var scene = new BABYLON.Scene(engine);

	//Adding a light
	var light = new BABYLON.HemisphericLight();

	//Adding an Arc Rotate Camera
	var camera = new BABYLON.ArcRotateCamera("Camera", 0, 0.8, 10, BABYLON.Vector3.Zero(), scene);
	camera.attachControl(canvas, false);

	// The first parameter can be used to specify which mesh to import. Here we import all meshes
	BABYLON.SceneLoader.Append("./assets/", "Boss_Zones.gltf", scene, function (scene) {
		scene.activeCamera = null;
		scene.createDefaultCameraOrLight(true);
		scene.activeCamera.attachControl(canvas, false);
	});

	return scene;
}
/******* End of the create scene function ******/    

var scene = createScene(); //Call the createScene function

scene.debugLayer.show();

scene.onPointerPick = function (evt, pickInfo) {
	if(previouslySelected)
	{
		previouslySelected.material.albedoColor = new BABYLON.Color3.Gray();
	}
	previouslySelected = pickInfo.pickedMesh;
	meshName = pickInfo.pickedMesh.name;
	materialPicked = pickInfo.pickedMesh.material.clone(meshName+"_mat");
	materialPicked.albedoColor = new BABYLON.Color3.Green();
	pickInfo.pickedMesh.material = materialPicked;
};

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () { 
		scene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function () { 
		engine.resize();
});