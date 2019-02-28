var canvas = document.getElementById("renderCanvas"); // Get the canvas element 
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

var actuallySelected; // Mesh actually selected
var savedMaterial; // Original material of the mesh actually selected
var tempMaterial; // Temporary material used to alter the material of the actually selected mesh or the validated mesh

var validatedMaterial; // Original material of the validated mesh
var validatedPart; // Mesh validated

/*
*	Create the scene and import the 3D models
*/
var createScene = function () {
	document.getElementsByTagName("body")[0].setAttribute("oncontextmenu", "return false");
	
	// Initialize the scene
	var scene = new BABYLON.Scene(engine); 

	// Adding a light
	var light = new BABYLON.HemisphericLight(); 

	canvas.setAttribute("touch-action", "none");

	// Adding an Arc Rotate Camera
	var camera = new BABYLON.ArcRotateCamera("Camera", 0, 0.8, 10, BABYLON.Vector3.Zero(), scene); 
	
	// Set the active camera target (lookAt)
	scene.activeCamera.target = new BABYLON.Vector3(0, 50, 0);
	
	// Set the active camera position
	scene.activeCamera.setPosition(new BABYLON.Vector3(-201,98,-192));
	
	// Change active camera settings whether you are on a browser or a mobile device
	if(platform == "web"){
		scene.activeCamera.panningSensibility = 60;
	scene.activeCamera.wheelPrecision = 1;
	}
	
	// Set the controls attached to the camera
	scene.activeCamera.attachControl(canvas, false);
	
	// Restrain the zooming feature, so that we don't collide with the model (empirical value here)
	scene.activeCamera.lowerRadiusLimit = 180;

	// The first parameter can be used to specify which mesh to import. Here we import all meshes
	BABYLON.SceneLoader.Append("./assets/", "Zones.gltf", scene, function (scene) {
	});

	// Set the Background color (RGBA)
	scene.clearColor = new BABYLON.Color4(0,0,0,0);

	return scene;
}

// Create the scene
var scene = createScene(); 

// Callback for clicking/taping on a mesh
scene.onPointerPick = function (evt, pickInfo) {
	
	// Check if the mesh is selectable
	if(!pickInfo.pickedMesh.name.startsWith("NoZone"))
	{
		if(actuallySelected)
		{
			actuallySelected.material = savedMaterial;
		}
		actuallySelected = pickInfo.pickedMesh;
		meshName = pickInfo.pickedMesh.name;
		if(validatedPart && validatedPart.name==meshName)
		{
			savedMaterial = validatedMaterial;
		}
		else
		{
			savedMaterial = pickInfo.pickedMesh.material.clone(meshName+"_mat");
		}
		tempMaterial = pickInfo.pickedMesh.material.clone(meshName+"_matTemp");
		tempMaterial.emissiveColor = new BABYLON.Color3(208,147,2);
		tempMaterial.emissiveIntensity = 0.0005;
		tempMaterial.directIntensity = 5.0;
		pickInfo.pickedMesh.material = tempMaterial;
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
		if(actuallySelected)
		{
			if(validatedPart)
			{
				if(validatedPart.name !== meshName)
				{
					validatedPart.material = validatedMaterial;
				}
			}
			tempMaterial.emissiveColor = new BABYLON.Color3.Green;
			tempMaterial.emissiveIntensity = 0.1;
			tempMaterial.directIntensity = 10.0;
			validatedPart = actuallySelected;
			validatedMaterial = savedMaterial;
			actuallySelected = null;
			savedMaterial = null;
		}
	});
});
