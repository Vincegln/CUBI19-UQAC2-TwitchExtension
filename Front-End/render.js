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
	
	// Set the controls attached to the camera
	scene.activeCamera.attachControl(canvas, false);
	
	// Restrain the zooming feature, so that we don't collide with the model (empirical value here)
	scene.activeCamera.lowerRadiusLimit = 180;

	// The first parameter can be used to specify which mesh to import. Here we import all meshes
	BABYLON.SceneLoader.Append("./assets/", "Zones.gltf", scene, function (loadedMeshes) {
	});

	// Set the Background color (RGBA)
	scene.clearColor = new BABYLON.Color4(0,0,0,0);

	//Setup of the skybox
	var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
	var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
	skyboxMaterial.backFaceCulling = false;
	skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("assets/skybox/skybox", scene);
	skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
	skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
	skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
	skybox.material = skyboxMaterial;

	// Change active camera settings whether you are on a browser or a mobile device
	if(platform === "web"){
		scene.activeCamera.panningSensibility = 60;
		scene.activeCamera.wheelPrecision = 1;
	}
	else if(platform === "mobile")
	{
		var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
		advancedTexture.layer.layerMask = 2;

		var sliderAlphaPanel = new BABYLON.GUI.StackPanel();
		sliderAlphaPanel.height = "30px";
		sliderAlphaPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		sliderAlphaPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		advancedTexture.addControl(sliderAlphaPanel);

		var sliderAlpha = new BABYLON.GUI.Slider();
		sliderAlpha.minimum = 0;
		sliderAlpha.maximum = 2 * Math.PI;
		sliderAlpha.color = "#faba3d";
		sliderAlpha.background = "#e2e2e2";
		sliderAlpha.value = 2.25;
		sliderAlpha.height = "40px";
		sliderAlpha.width = "200px";
		sliderAlpha.paddingTop = "10px";
		sliderAlpha.isThumbClamped = true;
		sliderAlpha.onValueChangedObservable.add(function(value) {
			scene.activeCamera.alpha = -value;
		});
		sliderAlphaPanel.addControl(sliderAlpha);

		var sliderBetaPanel = new BABYLON.GUI.StackPanel();
		sliderBetaPanel.width = "20px";
		sliderBetaPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		sliderBetaPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		advancedTexture.addControl(sliderBetaPanel);

		var sliderBeta = new BABYLON.GUI.Slider();
		sliderBeta.isVertical = true;
		sliderBeta.minimum = 0;
		sliderBeta.maximum = Math.PI;
		sliderBeta.color = "#faba3d";
		sliderBeta.background = "#e2e2e2";
		sliderBeta.value = scene.activeCamera.beta;
		sliderBeta.height = "200px";
		sliderBeta.width = "40px";
		sliderBeta.isThumbClamped = true;
		sliderBeta.onValueChangedObservable.add(function(value) {
			scene.activeCamera.beta = value;
		});
		sliderBetaPanel.addControl(sliderBeta);

		scene.activeCamera.inputs.clear();
	}

	return scene;
};

// Create the scene
var scene = createScene();

scene.registerBeforeRender(function()
{
	if(platform === "web")
	{
		scene.activeCamera.alpha += 0.0005;
	}
});

// Callback for clicking/taping on a mesh
scene.onPointerPick = function (evt, pickInfo) {
	
	// Check if the mesh is selectable
	if(!pickInfo.pickedMesh.name.startsWith("NoZone") && !pickInfo.pickedMesh.name.startsWith("skyBox"))
	{
		//Check if a mesh as already been selected
		if(actuallySelected)
		{
			if(actuallySelected === validatedPart)
			{
				//Reset the previously selected mesh to validated material
				tempMaterial.emissiveColor = new BABYLON.Color3.Green;
				tempMaterial.emissiveIntensity = 0.1;
				tempMaterial.directIntensity = 10.0;
			}
			else
			{
				//Reset the previously selected mesh with its original material
				actuallySelected.material = savedMaterial;
			}
		}

		//Update the selected mesh value
		actuallySelected = pickInfo.pickedMesh;

		//Update the selected mesh name value
		meshName = pickInfo.pickedMesh.name;

		//Check if a validated part exists and is the one actually selected
		if(validatedPart && validatedPart === actuallySelected)
		{
			//Sync original materials for the validated/selected part
			savedMaterial = validatedMaterial;
		}
		else
		{
			//Save a copy of the original mesh to savedMaterial
			savedMaterial = pickInfo.pickedMesh.material.clone(meshName+"_mat");
		}
		//Get a copy original mesh for modifications
		tempMaterial = pickInfo.pickedMesh.material.clone(meshName+"_matTemp");
		//Add a sandy emissive color
		tempMaterial.emissiveColor = new BABYLON.Color3(208,147,2);
		tempMaterial.emissiveIntensity = 0.0005;
		tempMaterial.directIntensity = 5.0;
		//Updating material
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
		//Check if a mesh is selected
		if(actuallySelected)
		{
			//Check if a mesh has already been validated
			if(validatedPart)
			{
				//Check if the last validated part is different from the actually selected part
				if(validatedPart.name !== meshName)
				{
					//Reset the last validated part to its original material
					validatedPart.material = validatedMaterial;
				}
			}
			//Add a greenish emissive color
			tempMaterial.emissiveColor = new BABYLON.Color3.Green;
			tempMaterial.emissiveIntensity = 0.1;
			tempMaterial.directIntensity = 10.0;
			//Update the validated part value
			validatedPart = actuallySelected;
			//Sync the original material between validated and saved materials
			validatedMaterial = savedMaterial;
			//Reset the actually selected value
			actuallySelected = null;
			//Reset the actually selected material value
			savedMaterial = null;
		}
	});
});
