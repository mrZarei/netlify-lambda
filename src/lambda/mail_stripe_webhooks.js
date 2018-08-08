import request from 'request';
import dateformat from 'dateformat';
import helperscripts from './helperscripts';


exports.handler = function(event, context, callback) {

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
  // Check event's signature to be confident that request comes from stripe
  const {error, stripeEvent} = helperscripts.getStripeEvent(event, process.env.STRIPE_MAIL_WEBHOOK_SECRET);
  if(error){
    return callback(null, {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: error }),
    });
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

event body json error: ${eventBodyErr}

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
