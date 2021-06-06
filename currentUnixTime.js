
/* getCurrentUnixTime function get current time in Unix format */

function getCurrentUnixTime(){
  return Math.floor(new Date().getTime() / 1000);
}

module.exports = getCurrentUnixTime;
