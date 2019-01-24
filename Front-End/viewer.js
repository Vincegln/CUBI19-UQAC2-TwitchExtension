var token = "";
var tuid = "";
var ebs = "";

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    setCycle: createRequest('POST', 'color/cycle', updateBlock),
    setHead: createRequest('POST', 'cubi/head', displayTotalVotes),
    setLeftFront: createRequest('POST', 'cubi/left_front', displayTotalVotes),
    setLeftBack: createRequest('POST', 'cubi/left_back', displayTotalVotes),
    setRightFront: createRequest('POST', 'cubi/right_front', displayTotalVotes),
    setRightBack: createRequest('POST', 'cubi/right_back', displayTotalVotes),
    setTail: createRequest('POST', 'cubi/tail', displayTotalVotes),
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
    $('#head').removeAttr('disabled');
    $('#left_front').removeAttr('disabled');
    $('#left_back').removeAttr('disabled');
    $('#right_front').removeAttr('disabled');
    $('#right_back').removeAttr('disabled');
    $('#tail').removeAttr('disabled');

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

    // when we click the head button
    $('#head').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Head button pressed by ' + tuid);
        $.ajax(requests.setHead);
    });

    $('#left_front').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Left front button pressed by ' + tuid);
        $.ajax(requests.setLeftFront);
    });

    $('#left_back').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Left back button pressed by ' + tuid);
        $.ajax(requests.setLeftBack);
    });

    $('#right_front').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Right front button pressed by ' + tuid);
        $.ajax(requests.setRightFront);
    });

    $('#right_back').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Right back button pressed by ' + tuid);
        $.ajax(requests.setRightBack);
    });

    $('#tail').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Tail button pressed by ' + tuid);
        $.ajax(requests.setTail);
    });

    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, color) {
        twitch.rig.log('Received broadcast color');
        updateBlock(color);
    });
});
