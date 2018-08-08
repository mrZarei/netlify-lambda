import request from 'request';
import dateformat from 'dateformat';
import helperscripts from './helperscripts';


exports.handler = function(event, context, callback) {

  // TODO: This validation method should be replaced by checking signature instead
  // Check https://stripe.com/docs/webhooks/signatures
  // It has been implemented once on commit #515ce05 but it did not work because Stripe-Signature does not
  // exist in the request headers
  if (!event.queryStringParameters.key) {
    return callback(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: "You need to supply 'key' parameter" }),
    });
  }

  if (event.queryStringParameters.key !== process.env.MAIL_WEBHOOK_API_KEY) {
    return callback(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: "The 'key' parameter is invalid" }),
    });
  }

  const senderEmail = process.env.SENDER_EMAIL;
  const receiveAllEventsEmailList = process.env.RECEIVE_ALL_EVENTS_EMAIL.split(",");
  const receiveImportantEventsEmailList = process.env.RECEIVE_IMPORTANT_EVENTS_EMAIL.split(",");

  const receiveList = [];

  receiveList.push(...receiveAllEventsEmailList);

  // Body
  const event_string = JSON.stringify(event, null, 4);
  const context_string = JSON.stringify(context, null, 4);
  let email_type = "Stripe event";
  let subject = "";
  let id = "no-id";
  let eventBodyErr = "";

  const header_str = '{"accept":"*/*; q=0.5, application/xml","accept-encoding":"gzip","cache-control":"no-cache","connection":"keep-alive","content-length":"1043","content-type":"application/json; charset=utf-8","stripe-signature":"t=1533730990,v1=a8e79ca02cfbb87dccba97037cb75aff6a6e5f96e4e38ec1e66a88a4830bfdad,v0=01099751021024a1106bc3a9babe98362a769be272e3da9641960908ee90ae39","user-agent":"Stripe/1.0 (+https://stripe.com/docs/webhooks)","via":"https/1.1 Netlify[a45af253-6547-4ff0-a318-5fd1448611f8] (ApacheTrafficServer/7.1.2)","x-bb-ab":"0.434904","x-bb-client-request-uuid":"a45af253-6547-4ff0-a318-5fd1448611f8-1307526","x-bb-ip":"54.187.216.72","x-cdn-domain":"www.bitballoon.com","x-country":"US","x-datadog-parent-id":"3836502393196773259","x-datadog-trace-id":"3257241176268373332","x-forwarded-for":"54.187.216.72","x-forwarded-proto":"https"}''
  const headers = JSON.parse(header_str);
  const sig = headers["stripe-signatur"];
  // Check event's signature to be confident that request comes from stripe
  const {error, stripeEvent} = helperscripts.getStripeEvent(event, process.env.STRIPE_MAIL_WEBHOOK_SECRET);
  let sEvent = JSON.stringify(stripeEvent);
  if(error){
    sEvent=error;

  }

  try {
    const eventBody = JSON.parse(event.body);
    if (helperscripts.isImportantEvent(eventBody.type)) {
      receiveList.push(...receiveImportantEventsEmailList);
    }

    email_type = "Stripe - " + eventBody.type;

    subject = "Stripe payment mail - " + email_type;
    id = eventBody.id;
  } catch(error) {
    email_type = "Other event";
    eventBodyErr=error;
    subject = "Webhook mail - "+email_type;
  }

  var now = new Date();
  let date_str = dateformat(now, "yyyy-mm-dd, HH:MM");
  subject += " - "+date_str;

  let event_link = "https://dashboard.stripe.com/events/"+id;

  const body_text = `A webhook mail

email type: ${email_type}

event link: ${event_link}

StripEvent: ${sEvent}

Singature: ${sig}

event body json error: ${eventBodyErr}

header: ${header_str}

------------------------

event: ${event_string}

-----------------------

context: ${context_string}
  `;

  const callbackFn = function(message, statusCode){
    callback(null, {
      statusCode: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: message }),
    });
  };
  helperscripts.smtp2go(subject, body_text, senderEmail, receiveList, callbackFn);
};
