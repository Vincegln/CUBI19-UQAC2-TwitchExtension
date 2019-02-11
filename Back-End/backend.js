/**
 *    Copyright 2018 Amazon.com, Inc. or its affiliates
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const fs = require('fs');
const Hapi = require('hapi');
const path = require('path');
const Boom = require('boom');
const color = require('color');
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
const initialColor = color('#6441A4');      // super important; bleedPurple, etc.
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
var totalVotes = {"HeadZone": 0, "LFLegZone": 0, "cubi/LBLegZone": 0, "cubi/RFLegZone": 0, "cubi/RBLegZone": 0, "cubi/TailZone": 0}
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
    path: '/color/cycle',
    handler: colorCycleHandler,
  });

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

    // Handle a new viewer requesting the color.
    server.route({
        method: 'GET',
        path: '/cubi/voteResult',
        handler: voteResultHandler,
    });

	server.route({
        method: 'GET',
        path: '/cubi/resetVotes',
        handler: resetVotesHandler,
    });

  // Handle a new viewer requesting the color.
  server.route({
    method: 'GET',
    path: '/color/query',
    handler: colorQueryHandler,
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

function colorCycleHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  // Store the color for the channel.
  let currentColor = channelColors[channelId] || initialColor;

  // Bot abuse prevention:  don't allow a user to spam the button.
  if (userIsInCooldown(opaqueUserId)) {
    throw Boom.tooManyRequests(STRINGS.cooldown);
  }

  // Rotate the color as if on a color wheel.
  verboseLog(STRINGS.cyclingColor, channelId, opaqueUserId);
  currentColor = color(currentColor).rotate(colorWheelRotation).hex();

  // Save the new color for the channel.
  channelColors[channelId] = currentColor;

  // Broadcast the color change to all other extension instances on this channel.
  attemptColorBroadcast(channelId);

  return currentColor;
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

function voteResultHandler(req){
	maxVotes = 0;
	mostVoted = "Empty";
	
	for(var vote in votes)
	{
		if(votes[vote] > maxVotes)
		{
			maxVotes = votes[vote];
			mostVoted = vote;
		}
	}

	return mostVoted;
}

function resetVotesHandler(req){
    var votes = {};
	var totalVotes = {"HeadZone": 0, "LFLegZone": 0, "cubi/LBLegZone": 0, "cubi/RFLegZone": 0, "cubi/RBLegZone": 0, "cubi/TailZone": 0}
	var mostVoted = "Empty";
	var maxVotes = 0;
	var nbVotes = 0;
}

function colorQueryHandler(req) {
  // Verify all requests.
  const payload = verifyAndDecode(req.headers.authorization);

  // Get the color for the channel from the payload and return it.
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  const currentColor = color(channelColors[channelId] || initialColor).hex();
  verboseLog(STRINGS.sendColor, currentColor, opaqueUserId);
  return currentColor;
}

function attemptColorBroadcast(channelId) {
  // Check the cool-down to determine if it's okay to send now.
  const now = Date.now();
  const cooldown = channelCooldowns[channelId];
  if (!cooldown || cooldown.time < now) {
    // It is.
    sendColorBroadcast(channelId);
    channelCooldowns[channelId] = { time: now + channelCooldownMs };
  } else if (!cooldown.trigger) {
    // It isn't; schedule a delayed broadcast if we haven't already done so.
    cooldown.trigger = setTimeout(sendColorBroadcast, now - cooldown.time, channelId);
  }
}

function sendColorBroadcast(channelId) {
  // Set the HTTP headers required by the Twitch API.
  const headers = {
    'Client-ID': clientId,
    'Content-Type': 'application/json',
    'Authorization': bearerPrefix + makeServerToken(channelId),
  };

  // Create the POST body for the Twitch API request.
  const currentColor = color(channelColors[channelId] || initialColor).hex();
  const body = JSON.stringify({
    content_type: 'application/json',
    message: currentColor,
    targets: ['broadcast'],
  });

  // Send the broadcast request to the Twitch API.
  verboseLog(STRINGS.colorBroadcast, currentColor, channelId);
  request(
    `https://api.twitch.tv/extensions/message/${channelId}`,
    {
      method: 'POST',
      headers,
      body,
    }
    , (err, res) => {
      if (err) {
        console.log(STRINGS.messageSendError, channelId, err);
      } else {
        verboseLog(STRINGS.pubsubResponse, channelId, res.statusCode);
      }
    });
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
