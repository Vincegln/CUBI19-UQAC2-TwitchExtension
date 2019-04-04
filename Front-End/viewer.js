var token = "";
var tuid = "";
var tcId = "";
var ebs = "";
var meshName = "";
var tokenInitiated = false;
var buttonText = "Valider votre vote";
var buttonTextError = "Erreur, veuillez réessayer";
var buttonTextConfirmed = "Vote comptabilisé";
var buttonTextChange = "Changer votre vote";
var voteOK = false;
var reminderText = "Votre vote actuel est: </br>";
var isFrozen = false;

let params = (new URL(document.location)).searchParams;
let platform = params.get("platform");

// Essential for debug using the developer rig
var twitch = window.Twitch.ext;

// Creates the request options for our EBS calls
var requests = {
    setHeadZone:
        createRequest('POST', 'cubi/HeadZone', displayTotalVotes),
    setLFLegZone:
        createRequest('POST', 'cubi/LFLegZone', displayTotalVotes),
    setLBLegZone:
        createRequest('POST', 'cubi/LBLegZone', displayTotalVotes),
    setRFLegZone:
        createRequest('POST', 'cubi/RFLegZone', displayTotalVotes),
    setRBLegZone:
        createRequest('POST', 'cubi/RBLegZone', displayTotalVotes),
    setTailZone:
        createRequest('POST', 'cubi/TailZone', displayTotalVotes),
	setChestZone:
        createRequest('POST', 'cubi/ChestZone', displayTotalVotes),
    getGameStatus:
        createRequest('POST', 'cubi/gameStatus', checkGameStatus)
};

// Creates a request
function createRequest(type, method, successMethod) {
	twitch.rig.log(method);
    return {
        type: type,
        // url: 'http://localhost:8005/' + method,
        url: 'https://cubi19uqac2.finch4.xyz/' + method,
        success: successMethod,
        error: logError
    }
}

// Sets auth headers values
function setAuth(token) {
    Object.keys(requests).forEach((req) => {
        twitch.rig.log('Setting auth headers');
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}

twitch.onContext(function(context) {
    twitch.rig.log(context);
});

// Updates auth values
twitch.onAuthorized(function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    tcId = auth.channelId;

    setAuth(token);
    $.ajax(requests.get);
    tokenInitiated = true;
});

// Acknowledges that the server received the vote correctly
function displayTotalVotes(votes) {
    voteOK = true;
    twitch.rig.log('Number of votes : ' + votes);
}

// Transmit the game status to the renderer
function checkGameStatus(status) {
    gameStatusHandler(status);
}

// Logs error messages
function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

// Wait for auth values to be set for asking the EBS for the game status
function gameStatusCheckLoop(){
    if(!token || !tokenInitiated){setTimeout(gameStatusCheckLoop,1000)}
    else{
        console.log("request sent for channel " + tcId);
        $.ajax(requests.getGameStatus);
    }
}

// Manages the reminder text for the last voted part
function getReminder(){
    var msg = reminderText;
    switch(meshName){
        case "LFLegZone":
            msg += "La patte avant gauche.";
            break;
        case "LBLegZone":
            msg += "La patte arrière gauche.";
            break;
        case "RFLegZone":
            msg += "La patte avant droite.";
            break;
        case "RBLegZone":
            msg += "La patte arrière droite.";
            break;
        case "TailZone":
            msg += "La queue.";
            break;
        case "ChestZone":
            msg += "Le torse";
            break;
    }
    meshName = "";
    return msg;
}

$(function() {

    // Checks the game actual status to be synced with it
    gameStatusCheckLoop();

    var reminder = $('#reminder');

    // Listens to user inputs on the vote button
	$('#SelectZone').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('SelectZone button pressed by ' + tuid);
		twitch.rig.log( meshName + ' selected.');
		switch(meshName){
			case "HeadZone":
				$.ajax(requests.setHeadZone);
				break;
			case "LFLegZone":
				$.ajax(requests.setLFLegZone);
				break;
			case "LBLegZone":
				$.ajax(requests.setLBLegZone);
				break;
			case "RFLegZone":
				$.ajax(requests.setRFLegZone);
				break;
			case "RBLegZone":
				$.ajax(requests.setRBLegZone);
				break;
			case "TailZone":
				$.ajax(requests.setTailZone);
				break;
			case "ChestZone":
				$.ajax(requests.setChestZone);
				break;
			default:

                reminder.html("Vous devez d'abord sélectionner une zone !");
                reminder.show();
				break;
		}

		// Adds a loading effect to give some feedback to the viewer after
        // its vote
		if(meshName !== ""){
            reminder.hide();
            var button = $('#SelectZone');
            button.prop('disabled', true);
            var text = $('#SelectZoneText');
            text.hide();
            var loader = $('#loader');
            loader.addClass("lds-ring");
            window.setTimeout(function () {
                loader.removeClass("lds-ring");
                text.show();
                if(voteOK)
                {
                    text.text(buttonTextConfirmed);
                }else{
                    text.text(buttonTextError);
                }
                window.setTimeout(function () {
                    if(voteOK)
                    {
                        text.text(buttonTextChange);
                        voteOK = false;
                        reminder.html(getReminder());
                        reminder.show();
                    }else{
                        text.text(buttonText);
                    }
                    if(!isFrozen){
                        button.prop('disabled', false);
                    }
                }, 1000)
            }, 1000)
        }
    });

    // Listens for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, message) {
        console.log(message);
        var parsedMessage = (message.split(" "));
        switch (parsedMessage[0]) {
            case "exitTuto" :
                removeTutoMask();
                break;
            case "startCountdown" :
                startCountdown();
                break;
            case "enableVote" :
                enableVote();
                break;
            case "updatePercentage":
                updatePercentage(parsedMessage);
                break;
            case "initTuto" :
                resetToTuto();
                break;
            case "resetVote" :
                resetVote();
                break;
            default:
                break;
        }
    });
});
