const fs = require('fs');
const Hapi = require('hapi');
const path = require('path');
const Boom = require('boom');
const ext = require('commander');
const jsonwebtoken = require('jsonwebtoken');
const request = require('request');

// The developer rig uses self-signed certificates.  Node doesn't accept them
// by default.  Do not use this in production.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use verbose logging during development.  Set this to false for production.
const verboseLogging = true;
const verboseLog = verboseLogging ? console.log.bind(console) : () => { };

// Service state variables
const serverTokenDurationSec = 30;          // our tokens for pubsub expire after 30 seconds
const userCooldownMs = 1000;                // maximum input rate per user to prevent bot abuse
const userCooldownClearIntervalMs = 60000;  // interval to reset our tracking object
const channelCooldownMs = 1000;             // maximum broadcast rate per channel
const bearerPrefix = 'Bearer ';             // HTTP authorization headers have this prefix
let userCooldowns = {};                     // spam prevention

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
  cyclingColor: 'Cycling color for c:%s on behalf of u:%s',
  colorBroadcast: 'Broadcasting color %s for c:%s',
  sendColor: 'Sending color %s to c:%s',
  cooldown: 'Please wait before clicking again',
  invalidAuthHeader: 'Invalid authorization header',
  invalidJwt: 'Invalid JWT',
};

ext.
  version(require('../package.json').version).
  option('-s, --secret <secret>', 'Extension secret').
  option('-c, --client-id <client_id>', 'Extension client ID').
  option('-o, --owner-id <owner_id>', 'Extension owner ID').
  parse(process.argv);

const ownerId = getOption('ownerId', 'ENV_OWNER_ID');
const secret = Buffer.from(getOption('secret', 'ENV_SECRET'), 'base64');
const clientId = getOption('clientId', 'ENV_CLIENT_ID');

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

if (fs.existsSync(serverPathRoot + '.crt') && fs.existsSync(serverPathRoot + '.key')) {
  serverOptions.tls = {
    // If you need a certificate, execute "npm run cert".
    cert: fs.readFileSync(serverPathRoot + '.crt'),
    key: fs.readFileSync(serverPathRoot + '.key'),
  };
}
const server = new Hapi.Server(serverOptions);

(async () => {
  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/cubi/streamInit',
    handler: streamInitHandler,
  });

  server.route({
    method: 'POST',
    path: '/cubi/streamDelete',
    handler: streamDeleteHandler,
  });

  // Handle a new viewer requesting the color.
  server.route({
    method: 'POST',
    path: '/cubi/voteResult',
    handler: voteResultHandler,
  });

  server.route({
    method: 'POST',
    path: '/cubi/resetVote',
    handler: resetVoteHandler,
  });

  /*
  * Twitch Extension <-> Server communications
  *
  */

    server.route({
        method: 'POST',
        path: '/cubi/gameStatus',
        handler: gameStatusHandler,
    });

  server.route({
    method: 'POST',
    path: '/cubi/exitTuto',
    handler: exitTutoHandler,
  });

  server.route({
    method: 'POST',
    path: '/cubi/startCountdown',
    handler: startCountdownHandler,
  });

  server.route({
    method: 'POST',
    path: '/cubi/enableVote',
    handler: enableVoteHandler,
  });

  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/cubi/LFLegZone',
    handler: lFLegZoneButtonHandler,
  });

  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/cubi/LBLegZone',
    handler: lBLegZoneButtonHandler,
  });

  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/cubi/RFLegZone',
    handler: rFLegZoneButtonHandler,
  });

  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/cubi/RBLegZone',
    handler: rBLegZoneButtonHandler,
  });

  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/cubi/TailZone',
    handler: tailZoneButtonHandler,
  });
  
  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/cubi/ChestZone',
    handler: chestZoneButtonHandler,
  });

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

  // Periodically clear cool-down tracking to prevent unbounded growth due to
  // per-session logged-out user tokens.
  setInterval(() => { userCooldowns = {}; }, userCooldownClearIntervalMs);
})();

function usingValue(name) {
  return `Using environment variable for ${name}`;
}

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
      return jsonwebtoken.verify(token, secret, { algorithms: ['HS256'] });
    }
    catch (ex) {
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

  if(streams[channelId]!=null)
  {
    delete streams[channelId];
  }

  streams[channelId] = {};
  streams[channelId]["votes"] = {};
  streams[channelId]["totalVotes"] = {"LFLegZone": 0, "LBLegZone": 0, "RFLegZone": 0,
      "RBLegZone": 0, "TailZone": 0, "ChestZone": 0};
  streams[channelId]["mostVoted"] = "Empty";
  streams[channelId]["maxVotes"] = 0;
  streams[channelId]["nbVotes"] = 0;
  streams[channelId]["status"] ="tuto";

  return req.payload+" info created";
}

function streamDeleteHandler(req) {
  if(streams[req.payload]["percentageTimer"]==null) {
    clearInterval(streams[channelId]["percentageTimer"]);
  }
  delete streams[req.payload];

  return req.payload+" info deleted";
}

function voteResultHandler(req){
  var channelId = req.payload;

  streams[channelId]["mostVoted"] = "Empty";
  streams[channelId]["maxVotes"] = 0;

  for(var vote in streams[channelId]["totalVotes"])
  {
    if(streams[channelId]["totalVotes"][vote] > streams[channelId]["maxVotes"])
    {
      streams[channelId]["maxVotes"] = streams[channelId]["totalVotes"][vote];
      streams[channelId]["mostVoted"] = vote;
    }
  }

  return streams[channelId]["mostVoted"]+","+streams[channelId]["nbVotes"]+
      ","+streams[channelId]["maxVotes"];
}

function resetVoteHandler(req){
  var channelId = req.payload;

  streams[channelId]["votes"] = {};
  streams[channelId]["totalVotes"] = {"LFLegZone": 0, "LBLegZone": 0, "RFLegZone": 0,
      "RBLegZone": 0, "TailZone": 0, "ChestZone": 0};
  streams[channelId]["mostVoted"] = "Empty";
  streams[channelId]["maxVotes"] = 0;
  streams[channelId]["nbVotes"] = 0;

  return "Reset completed for "+channelId;
}

/*
* Twitch Extension <-> Server communications
*
*/

function gameStatusHandler(req){
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

    console.log(channelId +" requested status");

    if(streams[channelId] !== undefined && streams[channelId]["status"] !== undefined){
        return streams[channelId]["status"];
    }else{
        return "null";
    }
}

function exitTutoHandler(req){
  var channelId = req.payload;
  makePubSubMessage(channelId,"exitTuto");
  if(streams[channelId]["percentageTimer"]==null)
  {
    clearInterval(streams[channelId]["percentageTimer"]);
    streams[channelId]["percentageTimer"] = setInterval(updatePercentage.bind(null,channelId),1000);
  }
    streams[channelId]["status"] ="vote";
  return channelId + "exitTuto";
}

function startCountdownHandler(req){
  var channelId = req.payload;

  makePubSubMessage(channelId,"startCountdown");
  setTimeout(function () {
    clearInterval(streams[channelId]["percentageTimer"]);
    streams[channelId]["percentageTimer"] = null;
    streams[channelId]["status"] ="pinned";
  },5000);

  return channelId + "startCountdown";
}

function enableVoteHandler(req){
  var channelId = req.payload;
  if(streams[channelId]["percentageTimer"]==null)
  {
    streams[channelId]["percentageTimer"] = setInterval(updatePercentage.bind(null,channelId),1000);
  }
  makePubSubMessage(channelId,"enableVote");
  streams[channelId]["status"] ="vote";

  return channelId + "enableVote";
}

function updatePercentage(channelId){
  var message = "updatePercentage";
  for (var k in streams[channelId]["totalVotes"]){
    message+=" " + streams[channelId]["totalVotes"][k];
  }
  message+=" "+streams[channelId]["nbVotes"];
  makePubSubMessage(channelId,message);
}

function lFLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(streams[channelId]["votes"][opaqueUserId]!=null)
  {
    streams[channelId]["totalVotes"][streams[channelId]["votes"][opaqueUserId]]--;
    streams[channelId]["nbVotes"]--;
  }
  streams[channelId]["votes"][opaqueUserId]="LFLegZone";
  streams[channelId]["totalVotes"]["LFLegZone"]++;

  streams[channelId]["nbVotes"]++;

  return streams[channelId]["nbVotes"];
}

function lBLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(streams[channelId]["votes"][opaqueUserId]!=null)
  {
    streams[channelId]["totalVotes"][streams[channelId]["votes"][opaqueUserId]]--;
    streams[channelId]["nbVotes"]--;
  }
  streams[channelId]["votes"][opaqueUserId]="LBLegZone";
  streams[channelId]["totalVotes"]["LBLegZone"]++;

  streams[channelId]["nbVotes"]++;

  return streams[channelId]["nbVotes"];
}

function rFLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(streams[channelId]["votes"][opaqueUserId]!=null)
  {
    streams[channelId]["totalVotes"][streams[channelId]["votes"][opaqueUserId]]--;
    streams[channelId]["nbVotes"]--;
  }
  streams[channelId]["votes"][opaqueUserId]="RFLegZone";
  streams[channelId]["totalVotes"]["RFLegZone"]++;

  streams[channelId]["nbVotes"]++;

  return streams[channelId]["nbVotes"];
}

function rBLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(streams[channelId]["votes"][opaqueUserId]!=null)
  {
    streams[channelId]["totalVotes"][streams[channelId]["votes"][opaqueUserId]]--;
    streams[channelId]["nbVotes"]--;
  }
  streams[channelId]["votes"][opaqueUserId]="RBLegZone";
  streams[channelId]["totalVotes"]["RBLegZone"]++;

  streams[channelId]["nbVotes"]++;

  return streams[channelId]["nbVotes"];
}

function tailZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(streams[channelId]["votes"][opaqueUserId]!=null)
  {
    streams[channelId]["totalVotes"][streams[channelId]["votes"][opaqueUserId]]--;
    streams[channelId]["nbVotes"]--;
  }
  streams[channelId]["votes"][opaqueUserId]="TailZone";
  streams[channelId]["totalVotes"]["TailZone"]++;

  streams[channelId]["nbVotes"]++;

  return streams[channelId]["nbVotes"];
}

function chestZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(streams[channelId]["votes"][opaqueUserId]!=null)
  {
    streams[channelId]["totalVotes"][streams[channelId]["votes"][opaqueUserId]]--;
    streams[channelId]["nbVotes"]--;
  }
  streams[channelId]["votes"][opaqueUserId]="ChestZone";
  streams[channelId]["totalVotes"]["ChestZone"]++;

  streams[channelId]["nbVotes"]++;

  return streams[channelId]["nbVotes"];
}

// Create and return a JWT for use by this service.
function makeServerToken(channelId) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
    channel_id: channelId,
    user_id: ownerId, // extension owner ID for the call to Twitch PubSub
    role: 'external',
    pubsub_perms: {
      send: [
          'broadcast'
      ],
    },
  };
  return jsonwebtoken.sign(payload, secret, { algorithm: 'HS256' });
}

function makePubSubMessage (channelId, message) {
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
  }, function(e, r, b) {
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

function userIsInCooldown(opaqueUserId) {
  // Check if the user is in cool-down.
  const cooldown = userCooldowns[opaqueUserId];
  const now = Date.now();
  if (cooldown && cooldown > now) {
    return true;
  }

  // Voting extensions must also track per-user votes to prevent skew.
  userCooldowns[opaqueUserId] = now + userCooldownMs;
  return false;
}
