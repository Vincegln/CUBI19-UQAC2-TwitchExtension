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
const colorWheelRotation = 30;
const channelColors = {};
const channelCooldowns = {};                // rate limit compliance
let userCooldowns = {};                     // spam prevention

var votes = {};
var totalVotes = {"HeadZone": 0, "LFLegZone": 0, "LBLegZone": 0, "RFLegZone": 0, "RBLegZone": 0, "TailZone": 0, "BodyZone": 0}
var mostVoted = "Empty";
var maxVotes = 0;
var nbVotes = 0;

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
  port: 8081,
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
    path: '/cubi/HeadZone',
    handler: headZoneButtonHandler,
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
    path: '/cubi/BodyZone',
    handler: bodyZoneButtonHandler,
  });

    // Handle a new viewer requesting the color.
  server.route({
      method: 'GET',
      path: '/cubi/voteResult',
      handler: voteResultHandler,
  });

  server.route({
      method: 'GET',
      path: '/cubi/resetVote',
      handler: resetVoteHandler,
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
  return `Extension ${name} required.\nUse argument "-${option} <${name}>" or environment variable "${variable}".`;
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

function headZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  
  if(votes[opaqueUserId]!=null)
  {
	  totalVotes[votes[opaqueUserId]]-=1;
	  nbVotes--;
  }
  votes[opaqueUserId]="HeadZone";
  totalVotes[votes[opaqueUserId]]+=1;
  
  nbVotes++;

  return nbVotes;
}

function lFLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(votes[opaqueUserId]!=null)
  {
	  totalVotes[votes[opaqueUserId]]-=1;
	  nbVotes--;
  }
  votes[opaqueUserId]="LFLegZone";
  totalVotes[votes[opaqueUserId]]+=1;
  
  nbVotes++;

  return nbVotes;
}

function lBLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(votes[opaqueUserId]!=null)
  {
	  totalVotes[votes[opaqueUserId]]-=1;
	  nbVotes--;
  }
  votes[opaqueUserId]="LBLegZone";
  totalVotes[votes[opaqueUserId]]+=1;
  
  nbVotes++;

  return nbVotes;
}

function rFLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(votes[opaqueUserId]!=null)
  {
	  totalVotes[votes[opaqueUserId]]-=1;
	  nbVotes--;
  }
  votes[opaqueUserId]="RFLegZone";
  totalVotes[votes[opaqueUserId]]+=1;
  
  nbVotes++;

  return nbVotes;
}

function rBLegZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(votes[opaqueUserId]!=null)
  {
	  totalVotes[votes[opaqueUserId]]-=1;
	  nbVotes--;
  }
  votes[opaqueUserId]="RBLegZone";
  totalVotes[votes[opaqueUserId]]+=1;
  
  nbVotes++;

  return nbVotes;
}

function tailZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(votes[opaqueUserId]!=null)
  {
	  totalVotes[votes[opaqueUserId]]-=1;
	  nbVotes--;
  }
  votes[opaqueUserId]="TailZone";
  totalVotes[votes[opaqueUserId]]+=1;
  
  nbVotes++;

  // return req.headers.data.content;
  return nbVotes;
}

function bodyZoneButtonHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  if(votes[opaqueUserId]!=null)
  {
	  totalVotes[votes[opaqueUserId]]-=1;
	  nbVotes--;
  }
  votes[opaqueUserId]="BodyZone";
  totalVotes[votes[opaqueUserId]]+=1;
  
  nbVotes++;

  // return req.headers.data.content;
  return nbVotes;
}

function voteResultHandler(req){
	maxVotes = 0;
	mostVoted = "Empty";
	
	for(var vote in totalVotes)
	{
		if(totalVotes[vote] > maxVotes)
		{
			maxVotes = totalVotes[vote];
			mostVoted = vote;
		}
	}

	return mostVoted;
}

function resetVoteHandler(req){
    votes = {};
	totalVotes = {"HeadZone": 0, "LFLegZone": 0, "LBLegZone": 0, "RFLegZone": 0, "RBLegZone": 0, "TailZone": 0, "BodyZone": 0}
	mostVoted = "Empty";
	maxVotes = 0;
	nbVotes = 0;
	
	return "Reset completed";
}

// Create and return a JWT for use by this service.
function makeServerToken(channelId) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
    channel_id: channelId,
    user_id: ownerId, // extension owner ID for the call to Twitch PubSub
    role: 'external',
    pubsub_perms: {
      send: ['*'],
    },
  };
  return jsonwebtoken.sign(payload, secret, { algorithm: 'HS256' });
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
