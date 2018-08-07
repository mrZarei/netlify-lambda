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
  }
  