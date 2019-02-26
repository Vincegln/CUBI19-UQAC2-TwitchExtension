var canvas = document.getElementById("renderCanvas"); // Get the canvas element 
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

var previouslySelected;
var previousMaterial;
var validatedMaterial;
var validatedPart;

/******* Add the create scene function ******/
var createScene = function () {
	document.getElementsByTagName("body")[0].setAttribute("oncontextmenu", "return false");
	var scene = new BABYLON.Scene(engine);

	//Adding a light
	var light = new BABYLON.HemisphericLight();

	canvas.setAttribute("touch-action", "none");

	//Adding an Arc Rotate Camera
	var camera = new BABYLON.ArcRotateCamera("Camera", 0, 0.8, 10, BABYLON.Vector3.Zero(), scene);
	scene.activeCamera.target = new BABYLON.Vector3(0, 50, 0);
	scene.activeCamera.setPosition(new BABYLON.Vector3(-201,98,-192));
	if(platform == "web"){
		scene.activeCamera.panningSensibility = 60;
	scene.activeCamera.wheelPrecision = 1;
	}
	scene.activeCamera.attachControl(canvas, false);
	scene.activeCamera.lowerRadiusLimit = 180;

	// The first parameter can be used to specify which mesh to import. Here we import all meshes
	BABYLON.SceneLoader.Append("./assets/", "Zones.gltf", scene, function (scene) {
	});

	//--------------------------------------------------------------------------------SET BACKGROUND COLOR (RGBA)
	scene.clearColor = new BABYLON.Color4(0,0,0,0.0000000000001);

	return scene;
}
/******* End of the create scene function ******/    

var scene = createScene(); //Call the createScene function

scene.onPointerPick = function (evt, pickInfo) {
	if(!pickInfo.pickedMesh.name.startsWith("NoZone"))
	{
		if(previouslySelected)
		{
			previouslySelected.material = previousMaterial;
		}
		previouslySelected = pickInfo.pickedMesh;
		meshName = pickInfo.pickedMesh.name;
		previousMaterial = pickInfo.pickedMesh.material.clone(meshName+"_mat");
		materialPicked = pickInfo.pickedMesh.material.clone(meshName+"_matTemp");
		//materialPicked.albedoColor = new BABYLON.Color3(0,10,0);
		materialPicked.emissiveColor = new BABYLON.Color3(208,147,2);
		materialPicked.emissiveIntensity = 0.0005;
		materialPicked.directIntensity = 5.0;
		pickInfo.pickedMesh.material = materialPicked;
	}
};

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () { 
		scene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function () { 
		engine.resize();
});

$(function() {
	$('#SelectZone').click(function() {
		if(previouslySelected)
		{
			if(validatedPart)
			{
				validatedPart.material = validatedMaterial;
			}
			materialPicked.emissiveColor = new BABYLON.Color3.Green;
			materialPicked.emissiveIntensity = 0.1;
			materialPicked.directIntensity = 10.0;
			validatedPart = previouslySelected;
			validatedMaterial = previousMaterial;
			previouslySelected = null;
			previousMaterial = null;
		}
	});
});
