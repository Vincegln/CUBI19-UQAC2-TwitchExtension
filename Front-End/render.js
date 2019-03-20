var canvas = document.getElementById("renderCanvas"); // Get the canvas element 
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

var advancedTexture; //GUI context
var tutoMask; // Black masking for the 3D Model
var countdownTimer;
var countdownText;
var countdownCounter = 6;
var aBR;
var blurH;
var blurV;
var disablePointerInput = true;

var defaultPanningSensibility;
var defaultAngularSensibilityX;
var defaultAngularSensibilityY;

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

	//Instantiate the GUI
	advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
	advancedTexture.layer.layerMask = 2;

	// Change settings whether you are on a browser or a mobile device
	if(platform === "web"){
		scene.activeCamera.panningSensibility = 60;
		scene.activeCamera.wheelPrecision = 1;

		//
		aBR = new BABYLON.AutoRotationBehavior();
		aBR.idleRotationSpeed = -0.15;
		aBR.idleRotationWaitTime = 2000;
		aBR.idleRotationSpinupTime = 500;
		aBR.attach(scene.activeCamera);
		scene.activeCamera.useAutoRotationBehavior = true;

		//
		countdownText = new BABYLON.GUI.TextBlock();
		countdownText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		countdownText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		countdownText.paddingBottom = 550;
		countdownText.paddingLeft = 15;
		countdownText.text = "";
		countdownText.color = "#fee8b3";
		countdownText.fontSize = 70;
		countdownText.outlineWidth = 3;
		countdownText.outlineColor = "black";
		advancedTexture.addControl(countdownText);
	}
	else if(platform === "mobile")
	{
		//Create a Panel
		var sliderAlphaPanel = new BABYLON.GUI.StackPanel();
		sliderAlphaPanel.width = "20px";
		sliderAlphaPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		sliderAlphaPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		advancedTexture.addControl(sliderAlphaPanel);

		//Create a Slider to turn the model around
		var sliderAlpha = new BABYLON.GUI.Slider();
		sliderAlpha.isVertical = true;
		sliderAlpha.minimum = 0;
		sliderAlpha.maximum = 2 * Math.PI;
		sliderAlpha.color = "#faba3d";
		sliderAlpha.background = "#e2e2e2";
		sliderAlpha.value = 2.25;
		sliderAlpha.height = "200px";
		sliderAlpha.width = "40px";
		sliderAlpha.isThumbClamped = true;
		sliderAlpha.onValueChangedObservable.add(function(value) {
			scene.activeCamera.alpha = -value;
		});
		sliderAlphaPanel.addControl(sliderAlpha);

		countdownText = new BABYLON.GUI.TextBlock();
		countdownText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		countdownText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		countdownText.paddingBottom = 225;
		countdownText.paddingLeft = 15;
		countdownText.text = "";
		countdownText.color = "#fee8b3";
		countdownText.fontSize = 24;
		countdownText.outlineWidth = 3;
		countdownText.outlineColor = "black";
		advancedTexture.addControl(countdownText);

		//Prevent from using touch control while allowing touch selection
		scene.activeCamera.panningSensibility = 1000000;
		scene.activeCamera.angularSensibilityX = 1000000;
		scene.activeCamera.angularSensibilityY = 1000000;
	}

	//Create a mask for the 3D model while in tuto phase
	tutoMask = new BABYLON.GUI.Rectangle();
	tutoMask.thickness = 0;
	tutoMask.background = "black";
	advancedTexture.addControl(tutoMask);

    blurH = new BABYLON.BlurPostProcess("Horizontal blur", new BABYLON.Vector2(1.0, 0), 128.0, 1.0, scene.activeCamera);
    blurV = new BABYLON.BlurPostProcess("Vertical blur", new BABYLON.Vector2(0, 1.0), 128.0, 1.0, scene.activeCamera);

    scene.activeCamera.detachPostProcess(blurH);
    scene.activeCamera.detachPostProcess(blurV);

    defaultPanningSensibility = scene.activeCamera.panningSensibility;
    defaultAngularSensibilityX = scene.activeCamera.angularSensibilityX;
    defaultAngularSensibilityY = scene.activeCamera.angularSensibilityY;

	return scene;
};

// Create the scene
var scene = createScene();

// Callback for clicking/taping on a mesh
scene.onPointerPick = function (evt, pickInfo) {
	if (disablePointerInput) {}
	else {
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

//
function removeTutoMask(){
	advancedTexture.removeControl(tutoMask);
	var selectZone = $('#SelectZone');
	selectZone.prop('disabled', false);
	disablePointerInput = false;
}

//
function updateCountdown(){
	if(countdownCounter !== 0)
	{
        countdownCounter--;
        countdownText.text = countdownCounter.toString();
	}else{
        window.clearInterval(countdownTimer);
        countdownText.text = "";
        var selectZone = $('#SelectZone');
        selectZone.prop('disabled', true);
        countdownCounter = 6;
        scene.activeCamera.panningSensibility = 1000000;
        scene.activeCamera.angularSensibilityX = 1000000;
        scene.activeCamera.angularSensibilityY = 1000000;
        if(platform==="web")
        {
            aBR.idleRotationSpeed = 0;
        }
        scene.activeCamera.useAutoRotationBehavior = false;
        scene.activeCamera.attachPostProcess(blurH);
        scene.activeCamera.attachPostProcess(blurV);
        disablePointerInput = true;
        if(validatedPart!=null)
        {
            validatedPart.material = validatedMaterial;
            validatedPart = null;
            validatedMaterial = null;
        }
        if(actuallySelected!=null)
        {
            actuallySelected.material = savedMaterial;
            actuallySelected = null;
            savedMaterial = null;
        }
        var helperText = $('#helperText');
        helperText.hide();
        var voteText = $('#voteText');
        voteText.show();
	}
}

//
function startCountdown(){
	countdownTimer = window.setInterval(updateCountdown,1000);
}

//
function enableVote(){
	var selectZone = $('#SelectZone');
	selectZone.prop('disabled', false);
	scene.activeCamera.panningSensibility = defaultPanningSensibility;
	scene.activeCamera.angularSensibilityX = defaultAngularSensibilityX;
	scene.activeCamera.angularSensibilityY = defaultAngularSensibilityY;
	aBR.idleRotationSpeed = -0.15;
	scene.activeCamera.useAutoRotationBehavior = true;
    scene.activeCamera.detachPostProcess(blurH);
    scene.activeCamera.detachPostProcess(blurV);
    disablePointerInput = false;
    var helperText = $('#helperText');
    helperText.show();
    var voteText = $('#voteText');
    voteText.hide();
}

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