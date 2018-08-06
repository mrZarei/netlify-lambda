'use strict';

// const SUBSCRIPTION_PLAN='plan_D9SNI0Rd7zgjLS' // Dagens TEST Digital - standard-firstmonthfree

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Dont exit without calling this function.
// It responds with a format API Gateway can understand
const runCallback = (error, success, callback) => {
  let statusCode, message
  if (error) {
    statusCode = error.code ? error.code : 500
    message = error.message ? error.message : (typeof error == "string") ? error : ""
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


const rejectData = (e, errorMessage) => {
  console.error(errorMessage)
  return { error: errorMessage }
}

const validateRequest = (event) => {
  let data
  try { data = JSON.parse(event.body) }
  catch(e){
    return rejectData(e, "Error parsing event.body (type of event.body is " + (typeof event.body) + ")")
  }
  if (typeof data !== "object") {
    try { data = JSON.parse(data)}
    catch(e){
      return rejectData(e, "Error parsing post data (type of post data is " + (typeof data) + ")" )
    }
  }
  //-- Make sure we have all required data. Otherwise, escape.
  if (typeof data === "undefined" || !data.token || !data.stripedata ) {
    let message = 'Required information is missing. Data object must have a "token" and a "stripedata" property.'
    console.error("This is the input we got: ", data)
    return rejectData({message, code: 400}, message)
  }

  return { data }
}

const getShipping = ({ name = null, phone = null, line1 = null, line2 = null, postal_code = null, city = null, state = null, country = null }) => ({
  name,
  phone,
  address: {
    line1,
    line2,
    postal_code,
    city,
    state,
    country
  }
})

const createCustomer = ({ token, stripedata, url = "" }) => {
  let customerData = {
    metadata: {
      "name": (stripedata.name ? stripedata.name : null),
      "conversionurl": url
    },
    source: token.id,
    email: (stripedata.email ? stripedata.email : null),
    shipping: getShipping(stripedata)
  }
  console.log ("Customer data sent to Stripe: ", customerData)
  return stripe.customers.create(customerData)
}

const createSubscription = (customer, plan) => stripe.subscriptions.create({
  customer: customer.id,
  items: [{ plan }],
  trial_period_days: 31,
})


/**
 * Purchase Handler – main lambda function
 */
module.exports.handler = (event, context, callback) => {
  let { error, data } = validateRequest(event)
  if (error) {
    runCallback(error, null, callback)
    return
  }
  createCustomer(data)
    .then((customer) => createSubscription(customer, data.stripedata.plan)
    .then((subscription) => runCallback(null, subscription, callback))
.catch((error) => runCallback({ message: "Error when creating Stripe subscription" }, null, callback))
)
.catch((error) => runCallback({ message: "Error creating Stripe customer. " + error.message }, null, callback))
};
