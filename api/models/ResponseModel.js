module.exports = ResponseWrapper;

function ResponseWrapper() {
  this.Response = new Object();
  this.Response.success = false;
  this.Response.result;
  this.Response.message;
}
