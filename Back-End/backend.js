const fs = require('fs');
const Hapi = require('hapi');
const path = require('path');
const Boom = require('boom');
const ext = require('commander');
const jsonwebtoken = require('jsonwebtoken');
const request = require('request');

// Accepting self-signed certificates for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Verbose logging for development
const verboseLogging = true;
const verboseLog = verboseLogging ? console.log.bind(console) : () => {
};

/*
*  Service state variables
*/
// Our tokens for pubsub expire after 30 seconds
const serverTokenDurationSec = 30;
// HTTP authorization headers have this prefix
const bearerPrefix = 'Bearer ';

// Data structure
var streams = {};

const STRINGS = {
    secretEnv: usingValue('secret'),
    clientIdEnv: usingValue('client-id'),
    ownerIdEnv: usingValue('owner-id'),
    serverStarted: 'Server running at %s',
    secretMissing: missingValue('secret', 'EXT_SECRET'),
    clientIdMissing: missingValue('client ID', 'EXT_CLIENT_ID'),
    ownerIdMissing: missingValue('owner ID', 'EXT_OWNER_ID'),
    messageSendError: 'Error sending message to channel %s: %s',
    pubsubResponse: 'Message to c:%s returned %s',
    cooldown: 'Please wait before clicking again',
    invalidAuthHeader: 'Invalid authorization header',
    invalidJwt: 'Invalid JWT',
};

ext.version(require('../package.json').version)
    .option('-s, --secret <secret>',
        'Extension secret')
    .option('-c, --client-id <client_id>',
        'Extension client ID')
    .option('-o, --owner-id <owner_id>',
        'Extension owner ID').parse(process.argv);

// Auth IDs
const ownerId = getOption('ownerId',
    'ENV_OWNER_ID');
const secret = Buffer.from(getOption('secret',
    'ENV_SECRET'), 'base64');
const clientId = getOption('clientId',
    'ENV_CLIENT_ID');

// Server configuration
const serverOptions = {
    host: 'localhost',
    port: 8005,
    routes: {
        cors: {
            origin: ['*'],
        },
    },
};
const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'server');

// Check for certificates
if (fs.existsSync(serverPathRoot + '.crt') &&
    fs.existsSync(serverPathRoot + '.key'))
{
    serverOptions.tls = {
        cert: fs.readFileSync(serverPathRoot + '.crt'),
        key: fs.readFileSync(serverPathRoot + '.key'),
    };
}
const server = new Hapi.Server(serverOptions);

// Server routes
(async () => {
    /*
    * Game <-> Server communications
    */

    // Create a stream sub-object
    server.route({
        method: 'POST',
        path: '/cubi/streamInit',
        handler: streamInitHandler,
    });

    // Delete this stream sub-object
    server.route({
        method: 'POST',
        path: '/cubi/streamDelete',
        handler: streamDeleteHandler,
    });

    //Delete all stream sub-objects
    server.route({
        method: 'POST',
        path: '/cubi/streamClean',
        handler: streamCleanHandler,
    });

    // Return the result of the votes, alongside the total number of votes and
    // the number of votes for the winning bodyPart
    server.route({
        method: 'POST',
        path: '/cubi/voteResult',
        handler: voteResultHandler,
    });

    // Reset the vote counters to 0
    server.route({
        method: 'POST',
        path: '/cubi/resetVote',
        handler: resetVoteHandler,
    });

    /*
    * Game <-> Server <-> Twitch Extension communications
    */

    // PubSub message for revealing the voodoo doll to viewers
    // and enabling vote
    server.route({
        method: 'POST',
        path: '/cubi/exitTuto',
        handler: exitTutoHandler,
    });

    // PubSub message to start the pin countdown
    server.route({
        method: 'POST',
        path: '/cubi/startCountdown',
        handler: startCountdownHandler,
    });

    // PubSub message to re-enable vote after pinned phase
    server.route({
        method: 'POST',
        path: '/cubi/enableVote',
        handler: enableVoteHandler,
    });

    /*
    * Twitch Extension <-> Server communications
    */

    // PubSub message to sync the extension status with the game phases
    server.route({
        method: 'POST',
        path: '/cubi/gameStatus',
        handler: gameStatusHandler,
    });

    // Viewer vote for left front leg
    server.route({
        method: 'POST',
        path: '/cubi/LFLegZone',
        handler: lFLegZoneButtonHandler,
    });

    // Viewer vote for left back leg
    server.route({
        method: 'POST',
        path: '/cubi/LBLegZone',
        handler: lBLegZoneButtonHandler,
    });

    // Viewer vote for right front leg
    server.route({
        method: 'POST',
        path: '/cubi/RFLegZone',
        handler: rFLegZoneButtonHandler,
    });

    // Viewer vote for right back leg
    server.route({
        method: 'POST',
        path: '/cubi/RBLegZone',
        handler: rBLegZoneButtonHandler,
    });

    // Viewer vote for tail
    server.route({
        method: 'POST',
        path: '/cubi/TailZone',
        handler: tailZoneButtonHandler,
    });

    // Viewer vote for chest
    server.route({
        method: 'POST',
        path: '/cubi/ChestZone',
        handler: chestZoneButtonHandler,
    });

    // Simple hello world, always comes in handy
    server.route({
        method: 'GET',
        path: '/',
        handler: function (request, h) {

            return 'Hello!';
        }
    });

    // Start the server.
    await server.start();
    console.log(STRINGS.serverStarted, server.info.uri);
})();

// Ease debugging
function usingValue(name) {
    return `Using environment variable for ${name}`;
}

// Ease debugging
function missingValue(name, variable) {
    const option = name.charAt(0);
    return `Extension ${name} required.\nUse argument "-${option} <${name}>
        " or environment variable "${variable}".`;
}

// Get options from the command line or the environment.
function getOption(optionName, environmentName) {
    const option = (() => {
        if (ext[optionName]) {
            return ext[optionName];
        } else if (process.env[environmentName]) {
            console.log(STRINGS[optionName + 'Env']);
            return process.env[environmentName];
        }
        console.log(STRINGS[optionName + 'Missing']);
        process.exit(1);
    })();
    console.log(`Using "${option}" for ${optionName}`);
    return option;
}

// Verify the header and the enclosed JWT.
function verifyAndDecode(header) {
    if (header.startsWith(bearerPrefix)) {
        try {
            const token = header.substring(bearerPrefix.length);
            return jsonwebtoken.verify(token, secret, {algorithms: ['HS256']});
        } catch (ex) {
            throw Boom.unauthorized(STRINGS.invalidJwt);
        }
    }
    throw Boom.unauthorized(STRINGS.invalidAuthHeader);
}

/*
* Game <-> Server communications
*
*/

function streamInitHandler(req) {
    const channelId = req.payload;

    // Clean any previous data for this channelId
    if (streams[channelId] != null) {
        if(streams[channelId]["status"] !== "tuto")
        {
            // Send a PubSub message to the extension
            makePubSubMessage(channelId, "initTuto");
        }
        if (streams[channelId]["percentageTimer"] !== null) {
            clearInterval(streams[channelId]["percentageTimer"]);
        }
        delete streams[channelId];
    }

    //Create the sub-object for the channel Id and instantiates fields
    streams[channelId] = {};
    streams[channelId]["votes"] = {};
    streams[channelId]["totalVotes"] = {
        "LFLegZone": 0, "LBLegZone": 0, "RFLegZone": 0,
        "RBLegZone": 0, "TailZone": 0, "ChestZone": 0
    };
    streams[channelId]["mostVoted"] = "Empty";
    streams[channelId]["maxVotes"] = 0;
    streams[channelId]["nbVotes"] = 0;
    streams[channelId]["status"] = "tuto";

    return channelId + " info created";
}

function streamDeleteHandler(req) {
    const channelId = req.payload;

    // Clear the updatePercentage timer if need be
    if (streams[channelId]["percentageTimer"] !== null) {
        clearInterval(streams[channelId]["percentageTimer"]);
    }

    // Delete the sub-object related to the channelId
    delete streams[channelId];

    return channelId + " info deleted";
}

function streamCleanHandler(req) {

    // Delete all stream sub-objects and clear timers if need be
    streams.forEach(function (item, index) {
        if (item["percentageTimer"] == null) {
            clearInterval(streams[channelId]["percentageTimer"]);
        }
        delete streams[index];
    });

    return "Streams structure cleaned";
}

function voteResultHandler(req) {
    var channelId = req.payload;

    // Clean results values
    streams[channelId]["mostVoted"] = "Empty";
    streams[channelId]["maxVotes"] = 0;

    // Get the most voted part
    for (var vote in streams[channelId]["totalVotes"]) {
        if (streams[channelId]["totalVotes"][vote] >
            streams[channelId]["maxVotes"])
        {
            streams[channelId]["maxVotes"] =
                streams[channelId]["totalVotes"][vote];
            streams[channelId]["mostVoted"] = vote;
        }
    }

    return streams[channelId]["mostVoted"] + ","
        + streams[channelId]["nbVotes"] +
        "," + streams[channelId]["maxVotes"];
}

function resetVoteHandler(req) {
    var channelId = req.payload;

    // Reset all vote-related values
    streams[channelId]["votes"] = {};
    streams[channelId]["totalVotes"] = {
        "LFLegZone": 0, "LBLegZone": 0, "RFLegZone": 0,
        "RBLegZone": 0, "TailZone": 0, "ChestZone": 0
    };
    streams[channelId]["mostVoted"] = "Empty";
    streams[channelId]["maxVotes"] = 0;
    streams[channelId]["nbVotes"] = 0;

    // Send a PubSub message to the extension
    makePubSubMessage(channelId, "resetVote");

    return "Reset completed for " + channelId;
}

/*
* Twitch Extension <-> Server communications
*
*/

function gameStatusHandler(req) {
    const payload = verifyAndDecode(req.headers.authorization);
    const {channel_id: channelId, opaque_user_id: opaqueUserId} = payload;

    console.log(channelId + " requested status");

    // Check if the stream sub-object has been instantiated
    if (streams[channelId] !== undefined
        && streams[channelId]["status"] !== undefined) {
        return streams[channelId]["status"];
    } else {
        return "null";
    }
}

function exitTutoHandler(req) {
    var channelId = req.payload;

    // Send a PubSub message to the extension
    makePubSubMessage(channelId, "exitTuto");

    // Start the updatePercentage Timer
    if (streams[channelId]["percentageTimer"] !== null) {
        clearInterval(streams[channelId]["percentageTimer"]);
        streams[channelId]["percentageTimer"] =
            setInterval(updatePercentage.bind(null, channelId), 1000);
    }
    streams[channelId]["status"] = "vote";

    return channelId + "exitTuto";
}

function startCountdownHandler(req) {
    var channelId = req.payload;

    // Send a PubSub message to the extension
    makePubSubMessage(channelId, "startCountdown");

    // Start the 5 seconds timer before the pin event and clear the
    // updatePercentage time
    setTimeout(function () {
        clearInterval(streams[channelId]["percentageTimer"]);
        streams[channelId]["percentageTimer"] = null;
        streams[channelId]["status"] = "pinned";
    }, 5000);

    return channelId + "startCountdown";
}

function enableVoteHandler(req) {
    var channelId = req.payload;

    // Start the updatePercentage timer if need be
    if (streams[channelId]["percentageTimer"] == null) {
        streams[channelId]["percentageTimer"] =
            setInterval(updatePercentage.bind(null, channelId), 1000);
    }

    // Send a PubSub message to the extension
    makePubSubMessage(channelId, "enableVote");
    streams[channelId]["status"] = "vote";

    return channelId + "enableVote";
}

function updatePercentage(channelId) {
    var message = "updatePercentage";

    if(streams[channelId]["nbVotes"]!=0)
    {
        // Get all votes counts
        for (var k in streams[channelId]["totalVotes"]) {
            message += " " + streams[channelId]["totalVotes"][k];
        }

        // Get the grand total of the votes
        message += " " + streams[channelId]["nbVotes"];

        // Send a PubSub message to the extension
        makePubSubMessage(channelId, message);
    }
}

function lFLegZoneButtonHandler(req) {
    const payload = verifyAndDecode(req.headers.authorization);
    const {channel_id: channelId, opaque_user_id: opaqueUserId} = payload;

    // Check if the viewer already voted, and cancel his previous vote if so
    if (streams[channelId]["votes"][opaqueUserId] != null) {
        streams[channelId]["totalVotes"]
            [streams[channelId]["votes"][opaqueUserId]]--;
        streams[channelId]["nbVotes"]--;
    }

    // Increase the vote number for the voted part and store the viewer
    // opaque ID
    streams[channelId]["votes"][opaqueUserId] = "LFLegZone";
    streams[channelId]["totalVotes"]["LFLegZone"]++;

    // Increase the grand total of votes
    streams[channelId]["nbVotes"]++;

    return streams[channelId]["nbVotes"];
}

function lBLegZoneButtonHandler(req) {
    const payload = verifyAndDecode(req.headers.authorization);
    const {channel_id: channelId, opaque_user_id: opaqueUserId} = payload;

    // Check if the viewer already voted, and cancel his previous vote if so
    if (streams[channelId]["votes"][opaqueUserId] != null) {
        streams[channelId]["totalVotes"]
            [streams[channelId]["votes"][opaqueUserId]]--;
        streams[channelId]["nbVotes"]--;
    }

    // Increase the vote number for the voted part and store the viewer
    // opaque ID
    streams[channelId]["votes"][opaqueUserId] = "LBLegZone";
    streams[channelId]["totalVotes"]["LBLegZone"]++;

    // Increase the grand total of votes
    streams[channelId]["nbVotes"]++;

    return streams[channelId]["nbVotes"];
}

function rFLegZoneButtonHandler(req) {
    const payload = verifyAndDecode(req.headers.authorization);
    const {channel_id: channelId, opaque_user_id: opaqueUserId} = payload;

    // Check if the viewer already voted, and cancel his previous vote if so
    if (streams[channelId]["votes"][opaqueUserId] != null) {
        streams[channelId]["totalVotes"]
            [streams[channelId]["votes"][opaqueUserId]]--;
        streams[channelId]["nbVotes"]--;
    }

    // Increase the vote number for the voted part and store the viewer
    // opaque ID
    streams[channelId]["votes"][opaqueUserId] = "RFLegZone";
    streams[channelId]["totalVotes"]["RFLegZone"]++;

    // Increase the grand total of votes
    streams[channelId]["nbVotes"]++;

    return streams[channelId]["nbVotes"];
}

function rBLegZoneButtonHandler(req) {
    const payload = verifyAndDecode(req.headers.authorization);
    const {channel_id: channelId, opaque_user_id: opaqueUserId} = payload;

    // Check if the viewer already voted, and cancel his previous vote if so
    if (streams[channelId]["votes"][opaqueUserId] != null) {
        streams[channelId]["totalVotes"]
            [streams[channelId]["votes"][opaqueUserId]]--;
        streams[channelId]["nbVotes"]--;
    }

    // Increase the vote number for the voted part and store the viewer
    // opaque ID
    streams[channelId]["votes"][opaqueUserId] = "RBLegZone";
    streams[channelId]["totalVotes"]["RBLegZone"]++;

    // Increase the grand total of votes
    streams[channelId]["nbVotes"]++;

    return streams[channelId]["nbVotes"];
}

function tailZoneButtonHandler(req) {
    const payload = verifyAndDecode(req.headers.authorization);
    const {channel_id: channelId, opaque_user_id: opaqueUserId} = payload;

    // Check if the viewer already voted, and cancel his previous vote if so
    if (streams[channelId]["votes"][opaqueUserId] != null) {
        streams[channelId]["totalVotes"]
            [streams[channelId]["votes"][opaqueUserId]]--;
        streams[channelId]["nbVotes"]--;
    }

    // Increase the vote number for the voted part and store the viewer
    // opaque ID
    streams[channelId]["votes"][opaqueUserId] = "TailZone";
    streams[channelId]["totalVotes"]["TailZone"]++;

    // Increase the grand total of votes
    streams[channelId]["nbVotes"]++;

    return streams[channelId]["nbVotes"];
}

function chestZoneButtonHandler(req) {
    const payload = verifyAndDecode(req.headers.authorization);
    const {channel_id: channelId, opaque_user_id: opaqueUserId} = payload;

    // Check if the viewer already voted, and cancel his previous vote if so
    if (streams[channelId]["votes"][opaqueUserId] != null) {
        streams[channelId]["totalVotes"]
            [streams[channelId]["votes"][opaqueUserId]]--;
        streams[channelId]["nbVotes"]--;
    }

    // Increase the vote number for the voted part and store the viewer
    // opaque ID
    streams[channelId]["votes"][opaqueUserId] = "ChestZone";
    streams[channelId]["totalVotes"]["ChestZone"]++;

    // Increase the grand total of votes
    streams[channelId]["nbVotes"]++;

    return streams[channelId]["nbVotes"];
}

// Create and return a JWT for use by this service.
function makeServerToken(channelId) {
    const payload = {
        exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
        channel_id: channelId,
        user_id: ownerId, // Extension owner ID for the call to Twitch PubSub
        role: 'external',
        // Set PubSub messages to be sent to all viewers at once
        pubsub_perms: {
            send: [
                'broadcast'
            ],
        },
    };
    return jsonwebtoken.sign(payload, secret, {algorithm: 'HS256'});
}

function makePubSubMessage(channelId, message) {
    let token = makeServerToken(channelId);

    request.post({
        url: 'https://api.twitch.tv/extensions/message/' + channelId,
        headers: {
            Authorization: 'Bearer ' + token,
            'Client-ID': clientId,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content_type: 'application/json',
            message: message,
            targets: ['broadcast']
        }),
        gzip: true
    }, function (e, r, b) {
        if (e) {
            console.log(e);
        } else if (r.statusCode === 204) {
            // console.log(channelId+""+message+" OK");
        } else {
            console.log('Got ' + r.statusCode + ' to ' + channelId);
            console.log(b);
        }
    });
}