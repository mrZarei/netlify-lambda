'use strict';

// Copy default.env to .env in the local directory and fill in the blanks.
// Note! There is also a .env file in the parent directory, but that one is for the client.
require('dotenv').config();


//  globals
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const AWS = require('aws-sdk')
// AWS.config.update({region:'eu-west-1'});

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
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SUB_UPDATED_SECRET);
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

const prepareMessage = (stripeEvent) => {
  console.log(stripeEvent.data.object)
  let message = "Hej kundtjänst! Stripe misslyckades just för tredje gången att dra pengar från en kunds kort. Prenumerationen bör därför avslutas. Den är märkt som unpaid i Stripe. IT-avdelningen har inte hunnit fixa så att ni får ett fint mail om detta. Ni får därför be dem om hjälp med att tolka nedanstående information, som innehåller allt ni behöver veta: \n\n\n"
  message = message +  JSON.stringify(stripeEvent)
  return message
}

const handleEvent = (topic, stripeEvent, callback) => {
  // We dont handle invoice.created events yet, but we can't treat it like
  // an unrecognized event and send an error back to Stripe, because Stripe won't
  // attempt to pay the invoice until we respond with 200.
  // Note: Stripe should not be configured to send an invoice.created event to this endpoint,
  // but if it does, we don't want to break anything by responding with an error.
  if (stripeEvent.type == "invoice.created") {
    runCallback(null, {code: 200, message: "ok"}, callback)
  }
  // else event is customer.subscription.updated
  else {
    if (stripeEvent.data.object.status == "unpaid"){
      publishEvent (topic, prepareMessage(stripeEvent), callback)
    }
    else {
      // do nothing
      runCallback(null, {code: 200, message: "ok"}, callback)
    }
  }
}

const publishEvent = (topic, stripeEvent, callback) => {
  return false;
//   const sns = new AWS.SNS()
//   const params = {
//     Message: JSON.stringify(stripeEvent),
//     TopicArn: `arn:aws:sns:eu-west-1:${process.env.AWS_ACCOUNT_ID}:${topic}`,
//   }
//   sns.publish(params).promise()
//     .then(runCallback(null, {message: "ok", code: 200}, callback))
//     .catch((error) => {
//     console.error("Error when trying to publish to SNS", error)
//   runCallback(error, null, callback)
// })
}



/**
 * Stripe Webhooks Endpoint Handler – main lambda function
 * This one should just handle the stripe event customer.subscription.updated
 */
module.exports.handler = async (event, context, callback) => {
  let {error, stripeEvent} = getStripeEvent(event)
  if (error){
    runCallback(error, null, callback)
    return
  }

  let topics = {
    "customer.subscription.updated": "stripe-subscription-unpaid", // yes, the mismatch is intended!
    "invoice.created": "stripe-invoice-created" // we don't have this topic set up, but maybe in the future ...
  }
  if (topics[stripeEvent.type]){
    handleEvent(topics[stripeEvent.type], stripeEvent, callback)
  }
  else {
    handleUnrecognizedEvent(stripeEvent, callback)
  }
};
