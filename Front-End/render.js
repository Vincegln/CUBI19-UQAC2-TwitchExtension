var canvas = document.getElementById("renderCanvas"); // Get the
// canvas element
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D
// engine

var advancedTexture; // GUI context
var tutoMask; // Black masking for the 3D model
var countdownTimer; // Timer for the pin countdown
var countdownText; // Text to display the pin countdown
var countdownCounter = 6; // Number of iterations for the pin countdown
// (5*1000ms)

var autoRotationBehavior; // Manager of the auto-rotation feature for the
// 3D model

var blurH; // Horizontal blur value
var blurV; // Vertical blur value

var disablePointerInput = true; // Keep the viewer from selecting parts when
// not in vote phase

var defaultAngularSensibilityX; // Default angular sensibility on X-axis
var defaultAngularSensibilityY; // Default angular sensibility on Y-axis


var plushParts =  ["LFLegZone", "LBLegZone", "RFLegZone",
	"RBLegZone", "TailZone", "ChestZone"]; // Denomination of the 3D model
// parts


var selectedMesh; // Mesh actually selected
var votedMesh; // Mesh actually validated
var plushMaterials = {}; //List of materials for each part of the 3D model
var plushSelectedMaterials = {}; // List of materials for each part of the
// 3D model, adjusted with a highlight (emissive color) feature


var selectedPin; // Mesh of the pin corresponding to the selectedMesh
var votedPin; // Mesh of the pin corresponding to the validatedMesh
var pinMaterial = null; // Material of the votedPin
var fresnelMaterial; // Material with a fresnel effect for the selectedPin

var perc = -1; // Percentage temp value of a part's votes
var percentageDisplays = []; // List of the meshes onto which the votes
// percentages are displayed
var percentageTexts = [];  // List of the text elements displaying the
// percentages
var percentageAdvancedTextures = []; // List of GUI containers for the
// percentages
var mostVotedIndex = []; // List of indexes for the most voted parts
var mostVotedValue; // Percentage value of the most voted part(s)

var originalHelperText = "Un rite mystique va se dérouler devant vos yeux." +
	"			L’ennemi possède des points faibles qui s'allument sur son" +
	" 			corps, soyez alerte et repérez-les.</br></br>" +
	"           Patience pendant que notre combattant se prépare...";

/*
*	Create the scene and import the 3D models
*/
var createScene = function () {
	document.getElementsByTagName("body")[0].setAttribute(
		"oncontextmenu", "return false");
	
	// Initializes the scene
	var scene = new BABYLON.Scene(engine);

	// Adds a light
	var light = new BABYLON.HemisphericLight(); 

	canvas.setAttribute("touch-action", "none");

	// Adds an Arc Rotate Camera
	var camera = new BABYLON.ArcRotateCamera(
		"Camera", 0, 0.8, 10, BABYLON.Vector3.Zero(), scene);
	
	// Sets the active camera target (lookAt)
	scene.activeCamera.target = new BABYLON.Vector3(0, 50, 0);
	
	// Sets the active camera position
	scene.activeCamera.setPosition(new BABYLON.Vector3(-201,98,-192));
	
	// Sets the controls attached to the camera
	scene.activeCamera.attachControl(canvas, false);

	// The first parameter can be used to specify which mesh to import.
	// Here, we import all meshes
	BABYLON.SceneLoader.Append("./assets/plushie/",
		"Boss_Plushie.gltf", scene, function (loadedMeshes) {});

	// Sets the Background color (RGBA)
	scene.clearColor = new BABYLON.Color4(0,0,0,0);

	// Setup of the skybox
	var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
	var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
	skyboxMaterial.backFaceCulling = false;
	skyboxMaterial.reflectionTexture
		= new BABYLON.CubeTexture("assets/skybox/skybox", scene);
	skyboxMaterial.reflectionTexture.coordinatesMode
		= BABYLON.Texture.SKYBOX_MODE;
	skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
	skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
	skybox.material = skyboxMaterial;

	//Instantiates the GUI
	advancedTexture
		= BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
	advancedTexture.layer.layerMask = 2;

	// Changes settings whether you are on a browser or a mobile device
	if(platform === "web"){
		scene.activeCamera.panningSensibility = 60;
		scene.activeCamera.wheelPrecision = 1;

		// Sets the zooming feature
		scene.activeCamera.radius = 190;

		// Restrains the zooming feature
		scene.activeCamera.lowerRadiusLimit = 190;
		scene.activeCamera.upperRadiusLimit = 190;

		// Restrains the camera up-down rotation
		scene.activeCamera.lowerBetaLimit = 0.674982;
		scene.activeCamera.upperBetaLimit = 2.188532;

		// Sets the auto-rotation manager
		autoRotationBehavior = new BABYLON.AutoRotationBehavior();
		autoRotationBehavior.idleRotationSpeed = -0.15;
		autoRotationBehavior.idleRotationWaitTime = 2000;
		autoRotationBehavior.idleRotationSpinupTime = 500;
		autoRotationBehavior.attach(scene.activeCamera);
		scene.activeCamera.useAutoRotationBehavior = true;

		// Sets the text element for the pin countdown
		countdownText = new BABYLON.GUI.TextBlock();
		countdownText.textHorizontalAlignment
			= BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		countdownText.textVerticalAlignment
			= BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		countdownText.paddingBottom = 20;
		countdownText.paddingLeft = 20;
		countdownText.text = "";
		countdownText.color = "#fee8b3";
		countdownText.fontSize = 70;
		countdownText.outlineWidth = 3;
		countdownText.outlineColor = "black";
		advancedTexture.addControl(countdownText);
	}
	else if(platform === "mobile")
	{
		// Makes the engine render 4 times bigger than the actual
		// resolution. Needed for basic display sharpness on mobile devices
		engine.setHardwareScalingLevel(0.25);

		// Sets the text element for the pin countdown
		countdownText = new BABYLON.GUI.TextBlock();
		countdownText.textHorizontalAlignment
			= BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		countdownText.textVerticalAlignment
			= BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
		countdownText.paddingBottom = 40;
		countdownText.paddingLeft = 40;
		countdownText.text = "";
		countdownText.color = "#fee8b3";
		countdownText.fontSize = 96;
		countdownText.outlineWidth = 4;
		countdownText.outlineColor = "black";
		advancedTexture.addControl(countdownText);

		// Creates the Slider Panel
		var sliderAlphaPanel = new BABYLON.GUI.StackPanel();
		sliderAlphaPanel.width = "208px";
		sliderAlphaPanel.horizontalAlignment
			= BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		sliderAlphaPanel.verticalAlignment
			= BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		advancedTexture.addControl(sliderAlphaPanel);

		// Creates an Image display for the slider indication
		var image = new BABYLON.GUI.Image("arrows", "assets/icon360.png");
		image.height = "128px";
		image.width = "128px";
		sliderAlphaPanel.addControl(image);

		// Creates a Slider to turn the model around
		var sliderAlpha = new BABYLON.GUI.Slider();
		sliderAlpha.isVertical = true;
		sliderAlpha.minimum = 0;
		sliderAlpha.maximum = 2 * Math.PI*10;
		sliderAlpha.color = "#faba3d";
		sliderAlpha.background = "#e2e2e2";
		sliderAlpha.value = 2.25;
		sliderAlpha.height = "600px";
		sliderAlpha.width = "60px";
		sliderAlpha.isThumbCircle = true;
		sliderAlpha.thumbWidth = "65px";
		sliderAlpha.borderColor = "#000000";
		sliderAlpha.onValueChangedObservable.add(function(value) {
			scene.activeCamera.alpha = -value/10;
		});
		sliderAlphaPanel.addControl(sliderAlpha);

		// Sets the zooming feature
		scene.activeCamera.radius = 210;

		// Restrains the zooming feature
		scene.activeCamera.lowerRadiusLimit = 210;
		scene.activeCamera.upperRadiusLimit = 210;

		// Prevents from using touch control while allowing touch selection
		scene.activeCamera.angularSensibilityX = 1000000;
		scene.activeCamera.angularSensibilityY = 1000000;
		scene.activeCamera.zoomingSensibility = 1000000;
	}

	// Prevents camera panning
	scene.activeCamera.panningSensibility = 1000000;

	// Creates a mask for the 3D model while in tuto phase
	tutoMask = new BABYLON.GUI.Rectangle();
	tutoMask.thickness = 0;
	tutoMask.background = "black";
	advancedTexture.addControl(tutoMask);

	// Creates a blur effect, both on vertical and horizontal axis
    blurH = new BABYLON.BlurPostProcess("Horizontal blur",
		new BABYLON.Vector2(1.0, 0), 128.0, 1.0, scene.activeCamera);
    blurV = new BABYLON.BlurPostProcess("Vertical blur",
		new BABYLON.Vector2(0, 1.0), 128.0, 1.0, scene.activeCamera);

    // Puts the blur effect at rest for now
    scene.activeCamera.detachPostProcess(blurH);
    scene.activeCamera.detachPostProcess(blurV);

    // Sets the default angular sensibility on both X and Y axis
    defaultAngularSensibilityX = scene.activeCamera.angularSensibilityX;
    defaultAngularSensibilityY = scene.activeCamera.angularSensibilityY;

    // Creates vote percentage display meshes
	var i;
	if(platform === "web"){
		for(i = 0; i < 6; i++){
			percentageDisplays[i] = BABYLON.MeshBuilder.CreatePlane(
				"percentage_"+i, {width: 50, height: 50}, scene);
		}
	}else if(platform === "mobile"){
		for(i = 0; i < 6; i++){
			percentageDisplays[i] = BABYLON.MeshBuilder.CreatePlane(
				"percentage_"+i, {width: 75, height: 75}, scene);
		}
	}

	// Left front leg percentage position
	percentageDisplays[0].position = new BABYLON.Vector3(35,-10,-17.5);
	// Left back leg percentage position
	percentageDisplays[1].position = new BABYLON.Vector3(15,-5,40);
	// Right front leg percentage position
	percentageDisplays[2].position = new BABYLON.Vector3(-35,-10,-17.5);
	// Right back leg percentage position
	percentageDisplays[3].position = new BABYLON.Vector3(-15,-5,40);
	// Tail percentage position
	percentageDisplays[4].position = new BABYLON.Vector3(0,20,100);
	// Chest percentage position
	percentageDisplays[5].position = new BABYLON.Vector3(0,80,25);

	// Creates the GUI container and text elements for the vote percentage
	// display feature
	percentageDisplays.forEach(function (item, index) {
		percentageAdvancedTextures[index]
			= BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
				percentageDisplays[index], 2048, 2048);

		percentageTexts[index] = new BABYLON.GUI.TextBlock();
		percentageTexts[index].text = "";
		percentageTexts[index].color = "white";
		percentageTexts[index].fontSize = 240;
		percentageTexts[index].outlineWidth = 50;
		percentageTexts[index].outlineColor = "black";
		percentageAdvancedTextures[index].addControl(percentageTexts[index]);

		item.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
		item.isPickable = false;
	});

	// Creates the material for the fresnel effect on the selectedPin
	fresnelMaterial = new BABYLON.StandardMaterial("fresnel", scene);
	fresnelMaterial.reflectionTexture
		= new BABYLON.CubeTexture("./assets/skybox/skybox", scene);
	fresnelMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
	fresnelMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
	fresnelMaterial.alpha = 0.5;
	fresnelMaterial.specularPower = 16;

	// Sets the reflection fresnel parameters for the fresnelMaterial
	fresnelMaterial.reflectionFresnelParameters
		= new BABYLON.FresnelParameters();
	fresnelMaterial.reflectionFresnelParameters.bias = 0.1;

	// Sets the emissive fresnel parameters for the fresnelMaterial
	fresnelMaterial.emissiveFresnelParameters
		= new BABYLON.FresnelParameters();
	fresnelMaterial.emissiveFresnelParameters.bias = 0.1;
	fresnelMaterial.emissiveFresnelParameters.power = 16;
	fresnelMaterial.emissiveFresnelParameters.leftColor
		= BABYLON.Color3.Green();
	fresnelMaterial.emissiveFresnelParameters.rightColor
		= BABYLON.Color3.Black();

	// Sets the opacity fresnel parameters for the fresnelMaterial
	fresnelMaterial.opacityFresnelParameters = new BABYLON.FresnelParameters();
	fresnelMaterial.opacityFresnelParameters.leftColor
		= BABYLON.Color3.Green();
	fresnelMaterial.opacityFresnelParameters.rightColor
		= BABYLON.Color3.Black();

	return scene;
};

// Creates the scene
var scene = createScene();

// Is executed once every action in createScene() has ended
scene.executeWhenReady(function () {
	scene.meshes.forEach(function (item, index) {
		// Sets 3D model meshes to be rendered according to their depth
		// parameter
		if (item.material !== undefined
			&& !item.name.startsWith("percentage_"))
		{
			item.material.needDepthPrePass = true;
		}

		// Hides every pin mesh and sets the pinMaterial
		if(item.name.endsWith("Pin")){
			item.visibility = 0;
			if(pinMaterial == null)
			{
				pinMaterial = item.material;
			}
			item.isPickable = false;
		} else if(plushParts.includes(item.name))
		{
			// Fill the list of the 3D model materials
			plushMaterials[item.name] = item.material;
		}
	});

	// Clones 3D model materials and adds to the copy an emissive color for
	// highlight effect
	for (var part in plushMaterials) {
		if(plushMaterials.hasOwnProperty(part))
		{
			plushSelectedMaterials[part] = plushMaterials[part].clone(
				plushMaterials[part].name+"_selected");
			plushSelectedMaterials[part].emissiveColor
				= BABYLON.Color3.Purple();
			plushSelectedMaterials[part].emissiveIntensity = 0.25;
			plushSelectedMaterials[part].directIntensity = 1;
		}
	}
});

// Callback for clicking/taping on a mesh
scene.onPointerPick = function (evt, pickInfo) {
	if (disablePointerInput) {}
	else {
        // Checks if the mesh is selectable
        if(!pickInfo.pickedMesh.name.startsWith("NoZone")
			&& !pickInfo.pickedMesh.name.startsWith("skyBox")
			&& !pickInfo.pickedMesh.name.startsWith("FeatherZone")
			&& !pickInfo.pickedMesh.name.startsWith("EarringZone"))
        {
            //Checks if a mesh as already been selected
            if(selectedMesh)
            {
            	//Checks if the previously selected mesh is voted
                if(selectedMesh === votedMesh)
                {
					//Resets the previously selected pin to actual pin material
					selectedPin.material = pinMaterial;
				}
                else
                {
                    // Resets the previously selected mesh with its original
					// material
                    selectedPin.visibility = 0;
                }
				// Resets the previous selected mesh to its original material
				selectedMesh.material = plushMaterials[selectedMesh.name];
            }

            // Updates the selected mesh value
            selectedMesh = pickInfo.pickedMesh;

            // Updates the selected mesh name value
            meshName = pickInfo.pickedMesh.name;

            // Updates the selected pin value, show the corresponding mesh
			// and apply to it the fresnelMaterial
            selectedPin = scene.getMeshByName(meshName+"_Pin");
            selectedPin.material = fresnelMaterial;
			selectedPin.visibility = 1;

            //Add a purple emissive color to the newly selected mesh
			selectedMesh.material = plushSelectedMaterials[selectedMesh.name];
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

// Manages the transition of the extension from tuto to vote phase
function removeTutoMask(){
	advancedTexture.removeControl(tutoMask);
	var selectZone = $('#SelectZone');
	selectZone.prop('disabled', false);
	disablePointerInput = false;
	$('#helperText').text('Repérez l’endroit que vous notez comme ' +
		'le point faible du boss (zone illuminée),' +
		' sélectionnez-le et validez votre vote.');
}

// Updates the pin countdown and at the end of it, manages the transition of the
// extension from vote to pinned phase
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
        scene.activeCamera.angularSensibilityX = 1000000;
        scene.activeCamera.angularSensibilityY = 1000000;
        if(platform==="web")
        {
            autoRotationBehavior.idleRotationSpeed = 0;
        }
        scene.activeCamera.useAutoRotationBehavior = false;
        scene.activeCamera.attachPostProcess(blurH);
        scene.activeCamera.attachPostProcess(blurV);
        disablePointerInput = true;
        isFrozen = true;
        if(votedMesh!=null)
        {
			votedPin.visibility = 0;
        }
        if(selectedMesh!=null)
        {
			selectedPin.visibility = 0;
			selectedMesh.material = plushMaterials[selectedMesh.name];
		}
		var helperText = $('#helperText');
        helperText.hide();
        var voteText = $('#voteText');
        voteText.show();
        percentageTexts.forEach(function (item) {
			item.text = "";
		})
	}
}

// Starts the pin countdown
function startCountdown(){
	countdownTimer = window.setInterval(updateCountdown,1000);
}

// Manages the transition of the extension from pinned to vote phase
function enableVote(){
	if(platform === "web")
	{
		scene.activeCamera.angularSensibilityX = defaultAngularSensibilityX;
		scene.activeCamera.angularSensibilityY = defaultAngularSensibilityY;
		autoRotationBehavior.idleRotationSpeed = -0.15;
		scene.activeCamera.useAutoRotationBehavior = true;
	}
    scene.activeCamera.detachPostProcess(blurH);
    scene.activeCamera.detachPostProcess(blurV);
    disablePointerInput = false;
    var helperText = $('#helperText');
    helperText.show();
    var voteText = $('#voteText');
    voteText.hide();
	$('#SelectZoneText').text(buttonText);
	var reminderText = $('#reminder');
	reminderText.hide();
	var selectZone = $('#SelectZone');
	selectZone.prop('disabled', false);
	isFrozen = false;
}

// Manages the update of the votes percentage value and display
function updatePercentage(parsedMessage){
	if(parsedMessage[7] !== 0){
		mostVotedIndex = [];
		mostVotedValue = -1;
		perc = -1;
		percentageTexts.forEach(function (item, index) {
			perc = ((parsedMessage[index+1]/parsedMessage[7])*100);
			perc = Math.floor(perc);
			if(perc > mostVotedValue)
			{
				mostVotedValue = perc;
				mostVotedIndex = [];
				mostVotedIndex.push(index);
			}
			else if(perc === mostVotedValue)
			{
				mostVotedIndex.push(index);
			}
			if(!isNaN(perc)) {
				if (perc === 0) {
					item.text = "";
				} else {
					item.text = perc.toString() + "%";
				}
			}
		});
		percentageTexts.forEach(function (item) {
			item.color = "white";
		});

		mostVotedIndex.forEach(function (item) {
			percentageTexts[item].color = "red";
		});
	}
}

function resetToTuto(){
	advancedTexture.addControl(tutoMask);
	enableVote();
	var selectZone = $('#SelectZone');
	selectZone.prop('disabled', true);
	if(votedMesh!=null)
	{
		votedPin.visibility = 0;
	}
	if(selectedMesh!=null)
	{
		selectedPin.visibility = 0;
		selectedMesh.material = plushMaterials[selectedMesh.name];
	}
	var helperText = $('#helperText');
	helperText.html(originalHelperText);
	helperText.show();
	var reminderText = $('#reminder');
	reminderText.hide();
	percentageTexts.forEach(function (item) {
		item.text = "";
	})
}

function resetVote() {
	if(votedMesh!=null)
	{
		votedPin.visibility = 0;
	}
	if(selectedMesh!=null)
	{
		selectedPin.visibility = 0;
		selectedMesh.material = plushMaterials[selectedMesh.name];
	}
	meshName = "";
	percentageTexts.forEach(function (item) {
		item.text = "";
	})
	var reminderText = $('#reminder');
	reminderText.hide();
}

// Manages the synchronisation between the game phase and the extension
// phase when a viewer joins mid-game
function gameStatusHandler(status){
	switch(status){
		case "null":
		case "tuto":
			break;
		case "vote":
			removeTutoMask();
			break;
		case "pinned":
			removeTutoMask();
			countdownCounter = 0;
			updateCountdown();
			break;
	}
}

// Listens to user inputs on the vote button
$(function() {
	$('#SelectZone').click(function() {
		//Check if a mesh is selected
		if(selectedMesh)
		{
			// Checks if a mesh has already been validated
			if(votedMesh && votedMesh.name !== meshName)
			{
					votedPin.visibility = 0;
			}

			// Updates the validated part value
			votedMesh = selectedMesh;
			votedPin = selectedPin;

			votedMesh.material = plushMaterials[votedMesh.name];
			votedPin.material = pinMaterial;

			// Resets the actually selected value
			selectedMesh = null;
			selectedPin = null;
		}
	});
});