exports.handler = function(event, context, callback){
  const response = {
    statusCode: 200,
    body: 'Hello',
  };
  callback(null, response);
};