import request from 'request';
import dateformat from 'dateformat';
import helperscripts from './helperscripts';


exports.handler = function(event, context, callback) {
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

  const api_key = process.env.SMTP2GO_API_KEY;
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
  let eventBodyStr = "";


  try {
    const eventBody = JSON.parse(event.body);
    if (helperscripts.isImportantEvent(eventBody.type)) {
      receiveList.push(...receiveImportantEventsEmailList);
    }

    email_type = "Stripe - " + eventBody.type;

    subject = "Stripe payment mail - " + email_type;
    id = eventBody.id;
    eventBodyStr = JSON.stringify(eventBody, null, 4);
  } catch(error) {
    email_type = "Other event";
    subject = "Webhook mail - "+email_type;
  }

  var now = new Date();
  let date_str = dateformat(now, "yyyy-mm-dd, HH:MM");
  subject += " - "+date_str;

  let event_link = "https://dashboard.stripe.com/events/"+id;

  const body_text = `A webhook mail

email type: ${email_type}

event link: ${event_link}

event body json pretty print: ${eventBodyStr}

------------------------

event: ${event_string}

-----------------------

context: ${context_string}
  `;

  request.post({
    url: "https://api.smtp2go.com/v3/email/send",
    headers: {
      'Content-Type': "application/json"
    },
    body: JSON.stringify({
      'api_key': api_key,
      'sender': senderEmail,
      'to': receiveList,
      'subject': subject,
      'text_body': body_text
    }),
  }, function(err, response, body) {
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

    callback(null, {
      statusCode: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: message }),
    });
  })
};
