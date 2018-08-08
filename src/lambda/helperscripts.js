import request from 'request';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Should return true for important events
// See more here: https://stripe.com/docs/api#event_types
exports.isImportantEvent = function(type) {
    importantEvents = [
      "customer.created",
      "customer.deleted",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "order.payment_failed",
      "order.payment_succeeded",
      "charge.expired"
    ];
    return importantEvents.includes(type);
  };

exports.smtp2go = function(subject, body, sender, receiveList, callback){

  const api_key = process.env.SMTP2GO_API_KEY;

  const data = {
    url: "https://api.smtp2go.com/v3/email/send",
    headers: {
      'Content-Type': "application/json"
    },
    body: JSON.stringify({
      'api_key': api_key,
      'sender': sender,
      'to': receiveList,
      'subject': subject,
      'text_body': body
    }),
  };

  request.post(data, function (err, response, body){
    var message = "Email sent successfully";
    var statusCode = 200;
    if (err) {
      message = "Error occured";
      statusCode = 500;
    }
    if (response.statusCode != 200) {
      message = "Error occured in call to smtp2go";
      statusCode = 400;
    }
    callback(message, statusCode);
  });

};

// Parsing a signed Stripe event. Docs: https://stripe.com/docs/webhooks/signatures
exports.getStripeEvent = function(event, WEBHOOK_SECRET) {
  let stripeEvent;
  console.log('event', event);
  try {
    let sig = event.headers["Stripe-Signature"];
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, WEBHOOK_SECRET);
  }
  catch (error) {
    return {error, stripeEvent: null}
  }
  return {error: null, stripeEvent}

};