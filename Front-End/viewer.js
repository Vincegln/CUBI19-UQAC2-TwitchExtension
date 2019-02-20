var token = "";
var tuid = "";
var ebs = "";
var meshName = "";

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
	setChestZone: createRequest('POST', 'cubi/ChestZone', displayTotalVotes)
};

function createRequest(type, method, successMethod) {

	twitch.rig.log(method);
    return {
        type: type,
        url: 'https://cubi19uqac2.finch4.xyz/' + method,/*location.protocol + '//localhost:8005/' + method,*/
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

    // enable the buttons
    $('#SelectZone').removeAttr('disabled');

    setAuth(token);
    $.ajax(requests.get);
});

function displayTotalVotes(votes) {
    twitch.rig.log('Number of votes : ' + votes);
}

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

function logSuccess(hex, status) {
  // we could also use the output to update the block synchronously here,
  // but we want all views to get the same broadcast response at the same time.
  twitch.rig.log('EBS request returned '+hex+' ('+status+')');
}

$(function() {

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
    });

    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, color) {
        twitch.rig.log('Received broadcast color');
        updateBlock(color);
    });
});
