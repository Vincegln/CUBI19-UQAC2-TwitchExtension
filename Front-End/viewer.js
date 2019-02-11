var token = "";
var tuid = "";
var ebs = "";

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    setCycle: createRequest('POST', 'color/cycle', updateBlock),
    setHeadZone: createRequest('POST', 'cubi/HeadZone', displayTotalVotes),
    setLFLegZone: createRequest('POST', 'cubi/LFLegZone', displayTotalVotes),
    setLBLegZone: createRequest('POST', 'cubi/LBLegZone', displayTotalVotes),
    setRFLegZone: createRequest('POST', 'cubi/RFLegZone', displayTotalVotes),
    setRBLegZone: createRequest('POST', 'cubi/RBLegZone', displayTotalVotes),
    setTailZone: createRequest('POST', 'cubi/TailZone', displayTotalVotes),
    get: createRequest('GET', 'color/query')
};

function createRequest(type, method, successMethod) {

    return {
        type: type,
        url: location.protocol + '//localhost:8081/' + method,
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
    $('#cycle').removeAttr('disabled');
    $('#HeadZone').removeAttr('disabled');
    $('#LFLegZone').removeAttr('disabled');
    $('#LBLegZone').removeAttr('disabled');
    $('#RFLegZone').removeAttr('disabled');
    $('#RBLegZone').removeAttr('disabled');
    $('#TailZone').removeAttr('disabled');

    setAuth(token);
    $.ajax(requests.get);
});

function updateBlock(hex) {
    twitch.rig.log('Updating block color');
    $('#color').css('background-color', hex);
}

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

    $('#cycle').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Color thingy ' + tuid);
        $.ajax(requests.setCycle);
    });

    // when we click the HeadZone button
    $('#HeadZone').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('HeadZone button pressed by ' + tuid);
        $.ajax(requests.setHeadZone);
    });

    $('#LFLegZone').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('LFLegZone button pressed by ' + tuid);
        $.ajax(requests.setLFLegZone);
    });

    $('#LBLegZone').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('LBLegZone button pressed by ' + tuid);
        $.ajax(requests.setLBLegZone);
    });

    $('#RFLegZone').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('RFLegZone button pressed by ' + tuid);
        $.ajax(requests.setRFLegZone);
    });

    $('#RBLegZone').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('RBLegZone button pressed by ' + tuid);
        $.ajax(requests.setRBLegZone);
    });

    $('#TailZone').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('TailZone button pressed by ' + tuid);
        $.ajax(requests.setTailZone);
    });

    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, color) {
        twitch.rig.log('Received broadcast color');
        updateBlock(color);
    });
});
