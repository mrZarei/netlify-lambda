// import uuid from 'uuid/v4'
import axios from 'axios'

insertStripeScript(document)

// Bundling the stripe script into our own code and can result in unexpected behaviour and is unsupported.
// So we create a script tag and wait for it to execute before we continue
// (this is the same solution Facebook uses for injecting it's script)
function insertStripeScript(d){
  if (d.getElementById('card-element')){ return; }
  var wrapperdiv = d.getElementById("etc-stripe");
  if (!wrapperdiv){
    console.error("Div with id etc-stripe not found in page", wrapperdiv)
    return
  }
  else {
    appendTags(d, wrapperdiv)
  }
}

function createStripeTag(d) {
  var element
  element = d.createElement('script')
  element.id = 'stripesrc';
  element.onload = function () {
    init(getForm(d));
  };
  element.src = "https://js.stripe.com/v3/"
  return element
}

// We also inject the "card-elements" and "card-errors" elements into the form before Stripe loads.
// Those elements are used by Stripe to inject the card input field and to display errors, respecitvely
function appendTags(d, w){
  var cardelement = d.createElement("div") // Stripe will insert a card element here
  cardelement.id = "card-element"
  var errorelement = d.createElement("div") // Stripe will display errors here
  errorelement.id = "card-errors"
  errorelement.role = "alert"
  w.appendChild(cardelement);
  w.appendChild(errorelement);
  w.appendChild(createStripeTag(d));
}

// Specify form-id as a get-parameter to this script. Default: "payment-form"
function getForm(d) {
  let s = d.getElementById("etc-stripe-script")
  let  query = s.src.match(/\?.*form=([^&|;|#]+)/)
  let formid = (typeof query == "object" && query && query.length > 1) ?  query[1] : 'payment-form'
  let form = d.getElementById(formid)
  if (!form) console.log("No form with id %s found in the document", formid)
  return form
}

function disableSubmitButton (form, disable) {
  function _disableSubmitButton (form, disable){
    if (!this.prototype.button) {
      let element = form.querySelector('button[type="submit"], input[type="submit"]')
      let attr = (element.tagName.toLowerCase() == "input") ? "value" : "textContent"
      let txt = element[attr]
      this.prototype.button = {
        element,
        attr,
        txt
      }
    }
    let { element, attr, txt } = this.prototype.button;
    element.disabled = disable
    element[attr] = disable ? "Skickar ..." : txt;
  }

  _disableSubmitButton.call(disableSubmitButton, form, disable)
}

// For some reason - maybe a bug in the webform-attributes module ? it's not possible
// to set the data-stripe-etc attribute on email elements in webforms (at least not on etc.se)
// Hence, we do a check for the email element even if data-stripe-etc is not set.
// Note that this means that the first field with one of the id attributes listed below is always passed on to Stripe!
function drupalEmailHack(stripedata, form){
  if (!stripedata.email){
    let emailElement = form.querySelector("#edit-submitted-epost,#edit-submitted-e-post,#edit-submitted-email,#edit-submitted-e-mail")
    if (emailElement){
      stripedata.email = emailElement.value ? emailElement.value : null
    }
  }
}

function getStripeData (form) {
  function _getStripeData (form){
    if (!this.prototype.stripeData) {
      this.prototype.stripeData = {}
      let dataElements = form.querySelectorAll('input[data-etc-stripe]')
      let _this = this
      // Traverse the domlist in an IE compatible way:
      Array.prototype.forEach.call(dataElements, function (element) {
        let attr = element.getAttribute("data-etc-stripe")
        _this.prototype.stripeData[attr] = element.value
      });
      let planElement = form.querySelector("[data-etc-stripe-plan]")
      drupalEmailHack(this.prototype.stripeData, form)
      this.prototype.stripeData.plan = planElement.getAttribute("data-etc-stripe-plan")
    }
    return this.prototype.stripeData;
  }

  return _getStripeData.call(getStripeData, form)
}


// the rest of our code is wrapped in this init function, to make sure it's not executed
// before stripe has loaded
function init(form) {
  const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  const elements = stripe.elements();

  const addCardInputField = () => {
    // Create an instance of the card Element.
    var card = elements.create('card');

    // Add an instance of the card Element into the `card-element` <div>.
    card.mount('#card-element');
    card.addEventListener('change', ({error}) => {
      let cardErrors = document.getElementById('card-errors');
    cardErrors.textContent = error ? error.message: ''
  });

    return card
  }

  async function submitHandler (event) {
    event.preventDefault();
    // We only want to disable submit when we use stripe. If we e.g. have a
    // radio button in the form for payment methods, we don't have to disable
    // the submit button if we don't use stripe
    // If we want to disable stripe, we have to add a field in the form called
    // 'disable-stripe' where the value is "true"
    var disableStripeElement = document.getElementById('disable-stripe');
    var disableStripe = "false";
    if (disableStripeElement !== null) {
      disableStripe = disableStripeElement.value;
    }
    if (disableStripe == 'true') {
      disableSubmitButton(form, false);
      form.submit();
      return ;
    }

    disableSubmitButton(form, true)
    try {
      const { error, token } = await stripe.createToken(card);
      if (error){
        disableSubmitButton(form, false)
      }
      else {
        stripeTokenHandler(token, form);
      }
    } catch (err) {
      disableSubmitButton(form, false)
      console.log('error', err);
      // Inform the customer that there was an error.
      var errorElement = document.getElementById('card-errors');
      errorElement.textContent = err.message;
    }
  }

  function stripeTokenHandler(token, form) {
    submitToken(token, form)
      .then(response => {
      disableSubmitButton(form, false)
    console.log(response)
    form.submit()
  })
  .catch(error => {
      disableSubmitButton(form, false)
    console.error('Error:', error)
    // we want the form to be submitted even if we could not process the card
    // so we don't loose a subscriber.
    form.submit()
  })
  }

  const submitToken = (token, form) => {
    let stripedata = getStripeData(form)
    console.log("token", token, stripedata)
    var config = {
      headers: { 'Content-Type': 'application/json' }
    }
    var data = JSON.stringify({
      token,
      url: window.location.href,
      stripedata
      // idempotency_key: uuid()
    })
    return axios.post(`${LAMBDA_ENDPOINT}purchase`, data, config)
  }







  const card = addCardInputField()
  // Create a token or display an error when the form is about to be submitted.
  form.addEventListener('submit', submitHandler)
}
