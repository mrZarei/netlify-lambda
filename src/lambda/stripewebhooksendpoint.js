'use strict';
import helperscript from 'helperscripts';

// Copy default.env to .env in the local directory and fill in the blanks.
// Note! There is also a .env file in the parent directory, but that one is for the client.
require('dotenv').config();


//  globals
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Dont exit without calling this function.
// It responds with a format API Gateway can understand
const runCallback = (error, success, callback) => {
  let statusCode, message
  if (error) {
    statusCode = error.code ? error.code : 500
    message = error.message ? error.message : ""
  }
  else {
    statusCode = success.code ? success.code : 200
    message = success.message ? success.message : ""
  }
  if (typeof message !== "string"){
    message = JSON.stringify(message)
  }
  let headers = {
    "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
  }
  console.log("Running callback with status %s and message %s", statusCode, message)

  callback(null, {
    statusCode,
    headers,
    body: message
  })
}

// Parsing a signed Stripe event. Docs: https://stripe.com/docs/webhooks/signatures
const getStripeEvent = (event) => {
  let stripeEvent
  try {
    let sig = event.headers["Stripe-Signature"]
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }
  catch(error){
    return {error, stripeEvent: null}
  }
  return {error: null, stripeEvent}
}

const handleUnrecognizedEvent = (stripeEvent, callback) => {
  let code = 400
  let message = `Unrecognized event: ${stripeEvent.type}`
  runCallback({code, message}, null, callback)
}

const handleEvent = (topic, stripeEvent, callback) => {
  // We dont handle invoice.created events yet, but we can't treat it like
  // an unrecognized event and send an error back to Stripe, because Stripe won't
  // attempt to pay the invoice until we respond with 200.
  if (stripeEvent.type == "invoice.created") {
    runCallback(null, {code: 200, message: "ok"}, callback)
  }
  else {
    publishEvent (topic, stripeEvent, callback)
  }
}

const publishEvent = (topic, stripeEvent, callback) => {

  const senderEmail = process.env.SENDER_EMAIL;
  const receiveAllEventsEmailList = process.env.RECEIVE_ALL_EVENTS_EMAIL.split(",");
  const receiveImportantEventsEmailList = process.env.RECEIVE_IMPORTANT_EVENTS_EMAIL.split(",");

  const receiveList = [];

  receiveList.push(...receiveAllEventsEmailList);

  const callbackFn = function(message, statusCode){
    callback(null, {
      statusCode:statusCode,
      headers:{
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({message:message}),
    });
  };

  helperscript.smtp2go(stripeEvent.type, JSON.stringify(stripeEvent),senderEmail, receiveList, callbackFn);

};



/**
 * Stripe Webhooks Endpoint Handler – main lambda function
 */
module.exports.handler = async (event, context, callback) => {
  let {error, stripeEvent} = getStripeEvent(event)
  if (error){
    runCallback(error, null, callback)
    return
  }

  let topics = {
    "customer.subscription.created": "stripe-subscription-created",
    "invoice.created": "stripe-invoice-created"
  }
  if (topics[stripeEvent.type]){
    handleEvent(topics[stripeEvent.type], stripeEvent, callback)
  }
  else {
    handleUnrecognizedEvent(stripeEvent, callback)
  }
};
