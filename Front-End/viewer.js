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

let params = (new URL(document.location)).searchParams;
let platform = params.get("platform");

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    setHeadZone: createRequest('POST', 'cubi/HeadZone', displayTotalVotes),
    setLFLegZone: createRequest('POST', 'cubi/LFLegZone', displayTotalVotes),
    setLBLegZone: createRequest('POST', 'cubi/LBLegZone', displayTotalVotes),
    setRFLegZone: createRequest('POST', 'cubi/RFLegZone', displayTotalVotes),
    setRBLegZone: createRequest('POST', 'cubi/RBLegZone', displayTotalVotes),
    setTailZone: createRequest('POST', 'cubi/TailZone', displayTotalVotes),
	setChestZone: createRequest('POST', 'cubi/ChestZone', displayTotalVotes),
    getGameStatus: createRequest('POST', 'cubi/gameStatus', checkGameStatus)
};

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

function setAuth(token) {
    Object.keys(requests).forEach((req) => {
        twitch.rig.log('Setting auth headers');
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}

twitch.onContext(function(context) {
    twitch.rig.log(context);
});

twitch.onAuthorized(function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    tcId = auth.channelId;

    setAuth(token);
    $.ajax(requests.get);
    tokenInitiated = true;
});

function displayTotalVotes(votes) {
    voteOK = true;
    twitch.rig.log('Number of votes : ' + votes);
}

function checkGameStatus(status) {
    gameStatusHandler(status);
}

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

function gameStatusCheckLoop(){
    if(!token || !tokenInitiated){setTimeout(gameStatusCheckLoop,1000)}
    else{
        console.log("request sent for channel " + tcId);
        $.ajax(requests.getGameStatus);
    }
}

$(function() {

    gameStatusCheckLoop();

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
				twitch.rig.log("dafuq");
				break;
		}
		if(meshName !== ""){
            var button = $('#SelectZone');
            button.prop('disabled', true);
            var text = $('#SelectZoneText');
            text.hide();
            var loader = $('#loader');
            loader.show();
            window.setTimeout(function () {
                loader.hide();
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
                    }else{
                        text.text(buttonText);
                    }
                    button.prop('disabled', false);
                }, 1000)
            }, 1000)
        }
    });

    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, message) {
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
            default:
                break;
        }
    });
});
